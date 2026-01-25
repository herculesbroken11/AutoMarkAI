
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { galleryFirestore as firestore } from '@/firebase/config';
import { postNowAction } from '@/app/actions';

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

        // The logic finds the oldest post with 'scheduled' status.
        // It does not check for a specific time, assuming the cron job itself is scheduled to run at the desired posting time.
        const postsRef = collection(firestore, 'posts');
        const q = query(
            postsRef,
            where('status', '==', 'scheduled'),
            orderBy('createdAt', 'asc'), // Get the oldest scheduled post
            limit(1)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            logs.push('No scheduled posts found to publish.');
            return NextResponse.json({ message: 'No scheduled posts found.', logs });
        }

        const postDoc = querySnapshot.docs[0];
        const post = { id: postDoc.id, ...postDoc.data() };

        logs.push(`Found post to publish: ${post.id} for platform ${post.platform}`);

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
            
            return NextResponse.json({ message: `Successfully posted content ${post.id}.`, logs });
        } else {
            logs.push(`Failed to post to ${post.platform}. Reason: ${result.error}`);
            
            const postRef = doc(firestore, 'posts', post.id);
             await updateDoc(postRef, {
                status: 'failed',
                error: result.error,
            });
            logs.push(`Updated Firestore status to 'failed' for doc ${post.id}`);

            return NextResponse.json({ error: `Failed to publish post ${post.id}: ${result.error}`, logs }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[CRON_POST_ERROR]', error);
        logs.push(`An unexpected error occurred: ${error.message}`);
        return NextResponse.json({ error: 'An unexpected error occurred during the cron job.', logs }, { status: 500 });
    }
}
    
