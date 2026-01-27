
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { galleryFirestore as firestore } from '@/firebase/config';
import { postNowAction } from '@/app/actions';
import { isPostingPaused, POSTING_PAUSED_ERROR } from '@/lib/posting-control';
import { logBlockedPublish, logPublishAttempt } from '@/lib/audit-log';
import { canPublish, mapLegacyStatus, NOT_APPROVED_ERROR } from '@/lib/post-status';
import { isScheduledTimeDue, getCurrentUTC } from '@/lib/timezone';

export async function GET(request: Request) {
    const logs: string[] = [];

    // Optional: Add a secret to protect your cron job endpoint
    const authToken = (request.headers.get('authorization') || '').split('Bearer ').at(1);
    if (process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
        logs.push('Authentication failed: Invalid cron secret.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        logs.push('Cron job started: Looking for a scheduled post to publish...');

        // Phase 1: Global Kill Switch Check
        if (await isPostingPaused()) {
            logs.push(`Posting is paused globally. Blocking all publish attempts.`);
            
            // Log blocked attempt
            await logBlockedPublish({
                actor: 'cron:post-scheduled',
                platform: 'all',
                reason: POSTING_PAUSED_ERROR,
            });
            
            return NextResponse.json({ 
                message: 'Posting is paused. No posts will be published.', 
                error: POSTING_PAUSED_ERROR,
                logs 
            }, { status: 503 });
        }

        // Phase 1: Timezone Correctness - Find posts scheduled for now or earlier (UTC)
        const nowUTC = getCurrentUTC();
        const nowTimestamp = Timestamp.fromDate(new Date(nowUTC));
        
        const postsRef = collection(firestore, 'posts');
        // Query: status='scheduled' AND (scheduledAt <= now OR scheduledAt is null)
        // Note: Firestore doesn't support OR easily, so we'll filter after query
        const q = query(
            postsRef,
            where('status', '==', 'scheduled'),
            orderBy('scheduledAt', 'asc'), // Order by scheduled time (UTC)
            limit(10) // Get more candidates, filter by time
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            logs.push('No scheduled posts found to publish.');
            return NextResponse.json({ message: 'No scheduled posts found.', logs });
        }

        // Phase 1: Timezone Correctness - Filter by scheduled time (UTC)
        const nowUTC = new Date();
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
            
            // Update the post status to 'posted' in Firestore
            const postRef = doc(firestore, 'posts', post.id);
            await updateDoc(postRef, {
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
            logs.push(`Failed to post to ${post.platform}. Reason: ${result.error}`);
            
            const postRef = doc(firestore, 'posts', post.id);
             await updateDoc(postRef, {
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
    
