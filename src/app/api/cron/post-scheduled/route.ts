import { NextResponse } from 'next/server';
import { adminFirestore, isAdminSDKAvailable } from '@/firebase/admin';
import { postNowAction } from '@/app/actions';
import { isPostingPaused, POSTING_PAUSED_ERROR } from '@/lib/posting-control';
import { logBlockedPublish, logPublishAttempt } from '@/lib/audit-log';
import { canPublish, mapLegacyStatus, NOT_APPROVED_ERROR } from '@/lib/post-status';
import { isScheduledTimeDue } from '@/lib/timezone';

export async function GET(request: Request) {
    const logs: string[] = [];

    const authToken = (request.headers.get('authorization') || '').split('Bearer ').at(1);
    if (process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
        logs.push('Authentication failed: Invalid cron secret.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdminSDKAvailable() || !adminFirestore) {
        logs.push('Firebase Admin SDK not configured.');
        return NextResponse.json(
            { error: 'Firebase Admin SDK not configured', logs },
            { status: 503 }
        );
    }

    try {
        logs.push('Cron job started: Looking for a scheduled post to publish...');

        if (await isPostingPaused()) {
            logs.push(`Posting is paused globally. Blocking all publish attempts.`);
            await logBlockedPublish({
                actor: 'cron:post-scheduled',
                platform: 'all',
                reason: POSTING_PAUSED_ERROR,
            });
            return NextResponse.json({
                message: 'Posting is paused. No posts will be published.',
                error: POSTING_PAUSED_ERROR,
                logs,
            }, { status: 503 });
        }

        const nowUTC = new Date();

        // Query for both legacy 'scheduled' and new 'SCHEDULED' statuses
        // Firestore doesn't support OR queries easily, so we'll query both and merge
        const scheduledQuery = adminFirestore
            .collection('posts')
            .where('status', '==', 'SCHEDULED')
            .orderBy('scheduledAt', 'asc')
            .limit(10);
        
        const legacyQuery = adminFirestore
            .collection('posts')
            .where('status', '==', 'scheduled')
            .orderBy('scheduledAt', 'asc')
            .limit(10);
        
        const [scheduledSnapshot, legacySnapshot] = await Promise.all([
            scheduledQuery.get(),
            legacyQuery.get()
        ]);
        
        // Merge results, prioritizing SCHEDULED over scheduled
        const allDocs = [...scheduledSnapshot.docs, ...legacySnapshot.docs];
        
        // Remove duplicates and sort by scheduledAt
        const uniqueDocs = Array.from(
            new Map(allDocs.map(doc => [doc.id, doc])).values()
        ).sort((a, b) => {
            const aTime = a.data().scheduledAt?.toDate ? a.data().scheduledAt.toDate() : new Date(a.data().scheduledAt || 0);
            const bTime = b.data().scheduledAt?.toDate ? b.data().scheduledAt.toDate() : new Date(b.data().scheduledAt || 0);
            return aTime.getTime() - bTime.getTime();
        });
        
        const querySnapshot = {
            docs: uniqueDocs.slice(0, 10),
            empty: uniqueDocs.length === 0
        };

        if (querySnapshot.empty) {
            logs.push('No scheduled posts found to publish.');
            return NextResponse.json({ message: 'No scheduled posts found.', logs });
        }

        // Phase 1: Timezone Correctness - Filter by scheduled time (UTC)
        // nowUTC already defined above, reuse it
        let postToPublish: any = null;
        
        for (const docSnap of querySnapshot.docs) {
            const postData = docSnap.data();
            const scheduledAt = postData.scheduledAt || postData.scheduled_at;
            
            // If no scheduledAt, treat as due (backward compatibility)
            if (!scheduledAt) {
                postToPublish = { id: docSnap.id, ...postData };
                logs.push(`Found post without scheduledAt (legacy): ${docSnap.id}`);
                break;
            }
            
            // Convert to Date if it's a Firestore Timestamp
            const scheduledDate = scheduledAt?.toDate ? scheduledAt.toDate() : new Date(scheduledAt);
            
            // Check if scheduled time has passed (UTC comparison)
            if (isScheduledTimeDue(scheduledDate)) {
                postToPublish = { id: docSnap.id, ...postData };
                logs.push(`Found post due for publishing: ${docSnap.id} (scheduled: ${scheduledDate.toISOString()})`);
                break;
            } else {
                logs.push(`Post ${docSnap.id} not yet due (scheduled: ${scheduledDate.toISOString()}, now: ${nowUTC.toISOString()})`);
            }
        }

        if (!postToPublish) {
            logs.push('No scheduled posts are due for publishing yet.');
            return NextResponse.json({ message: 'No posts due for publishing.', logs });
        }

        const post = postToPublish;

        logs.push(`Found post to publish: ${post.id} for platform ${post.platform}`);

        // Phase 1: Backend-Enforced Approval Check (double-check before posting)
        const postStatus = mapLegacyStatus(post.status || 'DRAFT');
        if (!canPublish(postStatus)) {
            logs.push(`Post ${post.id} blocked: Status ${postStatus} does not allow publishing`);
            
            await logBlockedPublish({
                actor: 'cron:post-scheduled',
                platform: post.platform || 'unknown',
                content_id: post.id,
                reason: `${NOT_APPROVED_ERROR}: Status is ${postStatus}, must be SCHEDULED or APPROVED`,
            });
            
            return NextResponse.json({ 
                error: `Post ${post.id} is not approved for publishing. Status: ${postStatus}`, 
                logs 
            }, { status: 400 });
        }

        // Use the existing server action to post the content
        const result = await postNowAction(post);

        if (result.success) {
            logs.push(`Successfully posted to ${post.platform}. Post ID: ${result.postId}`);

            await adminFirestore.collection('posts').doc(post.id).update({
                status: 'posted',
                postedAt: new Date().toISOString(),
                platformPostId: result.postId,
            });
            logs.push(`Updated Firestore status to 'posted' for doc ${post.id}`);
            
            // Log successful publish
            await logPublishAttempt({
                actor: 'cron:post-scheduled',
                platform: post.platform || 'unknown',
                content_id: post.id,
                action: 'posted',
                reason: `Successfully posted via scheduled cron job`,
                platform_response: {
                    post_id: result.postId,
                },
            });
            
            return NextResponse.json({ message: `Successfully posted content ${post.id}.`, logs });
        } else {
            // Check if this is a duplicate block (expected behavior, not an error)
            const { DUPLICATE_BLOCKED_ERROR } = await import('@/lib/duplicate-protection');
            const isDuplicateBlocked = result.error === DUPLICATE_BLOCKED_ERROR;
            
            if (isDuplicateBlocked) {
                logs.push(`Post ${post.id} blocked: Duplicate detected (this is expected behavior)`);
                logs.push(`Post was already published or a duplicate attempt was detected`);
                
                // Don't update status to 'failed' for duplicates - leave it as 'scheduled' or check if already posted
                // Check if post was already successfully posted
                const postSnap = await adminFirestore.collection('posts').doc(post.id).get();
                const postData = postSnap.data();
                
                if (postData?.platformPostId || postData?.status === 'posted' || postData?.status === 'POSTED') {
                    logs.push(`Post ${post.id} was already successfully posted. No action needed.`);
                    return NextResponse.json({ 
                        message: `Post ${post.id} was already published (duplicate blocked).`, 
                        logs 
                    });
                }
                
                // If not posted yet, update to failed but log it as expected behavior
                await adminFirestore.collection('posts').doc(post.id).update({
                    status: 'failed',
                    error: result.error,
                });
                logs.push(`Updated Firestore status to 'failed' for doc ${post.id} (duplicate blocked)`);
                
                // Log blocked publish (not a failure, but a successful prevention)
                await logPublishAttempt({
                    actor: 'cron:post-scheduled',
                    platform: post.platform || 'unknown',
                    content_id: post.id,
                    action: 'blocked',
                    reason: `Duplicate blocked: ${result.error}`,
                });
                
                return NextResponse.json({ 
                    message: `Post ${post.id} blocked (duplicate detected - this is expected behavior).`, 
                    logs 
                });
            }
            
            // For other errors, treat as failure
            logs.push(`Failed to post to ${post.platform}. Reason: ${result.error}`);

            await adminFirestore.collection('posts').doc(post.id).update({
                status: 'failed',
                error: result.error,
            });
            logs.push(`Updated Firestore status to 'failed' for doc ${post.id}`);
            
            // Log failed publish
            await logPublishAttempt({
                actor: 'cron:post-scheduled',
                platform: post.platform || 'unknown',
                content_id: post.id,
                action: 'failed',
                reason: `Failed to post: ${result.error}`,
                platform_response: {
                    error: result.error,
                },
            });
            
            return NextResponse.json({ error: `Failed to publish post ${post.id}: ${result.error}`, logs }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[CRON_POST_ERROR]', error);
        logs.push(`An unexpected error occurred: ${error.message}`);
        return NextResponse.json({ error: 'An unexpected error occurred during the cron job.', logs }, { status: 500 });
    }
}
    
