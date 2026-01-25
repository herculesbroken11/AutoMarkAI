
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, limit, doc, updateDoc, addDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { generateCaptions } from '@/ai/replicate';

// This function processes a single gallery item: stitches images and generates content.
async function processGalleryItem(item: any) {
    // Step 1: Stitch images by calling the existing API route
    // Note: In a production environment, you might want to call this function directly
    // instead of making an HTTP request to your own API.
    const imageResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/image/overlay-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            beforeUrl: item.beforeImageUrl,
            afterUrl: item.afterImageUrl,
        }),
    });

    const imageResult = await imageResponse.json();
    if (imageResult.error) {
        throw new Error(`Image Stitching Failed for ${item.id}: ${imageResult.message}`);
    }
    const stitchedImageUrl = imageResult.stitchedImageUrl;

    // Step 2: Generate captions for the stitched image
    const captions = await generateCaptions({
        vehicle: item.title,
        service: item.category,
        package: item.description || 'Not specified',
        location: 'Your Location', // This can be made dynamic later
        isCron: true,
    });

    // Step 3: Save generated posts to the 'posts' collection
    for (const post of captions) {
        await addDoc(collection(galleryFirestore, 'posts'), {
            ...post,
            vehicle: item.title,
            service: item.category,
            package: item.description,
            stitchedImageUrl: stitchedImageUrl,
            status: 'pending', // Add to pending queue for approval
            createdAt: new Date().toISOString(),
            originalGalleryId: item.id,
        });
    }

    // Step 4: Mark the gallery item as generated
    const galleryItemRef = doc(galleryFirestore, 'gallery', item.id);
    await updateDoc(galleryItemRef, {
        isGenerated: true,
    });
    
    return `Successfully generated ${captions.length} posts for gallery item: ${item.title} (${item.id})`;
}


export async function GET(request: Request) {
    const logs: string[] = [];

    // Secure the endpoint with a secret key
    const authToken = (request.headers.get('authorization') || '').split('Bearer ').at(1);
    if (process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
        logs.push('Authentication failed: Invalid cron secret.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        logs.push('Cron job started: Looking for a gallery item to process...');

        let querySnapshot;

        // Query 1: Look for items explicitly marked as not generated.
        const queryGeneratedFalse = query(
            collection(galleryFirestore, 'gallery'),
            where('isBeforeAfter', '==', true),
            where('isGenerated', '==', false),
            limit(1)
        );
        querySnapshot = await getDocs(queryGeneratedFalse);

        // Query 2: If none found, look for items where the field doesn't exist yet.
        if (querySnapshot.empty) {
            const allBeforeAfterQuery = query(
                collection(galleryFirestore, 'gallery'),
                where('isBeforeAfter', '==', true),
                limit(20) // Limit to a reasonable number to check
            );
            const allDocsSnapshot = await getDocs(allBeforeAfterQuery);
            const unprocessedDoc = allDocsSnapshot.docs.find(doc => doc.data().isGenerated !== true);

            if (unprocessedDoc) {
                const item = { id: unprocessedDoc.id, ...unprocessedDoc.data() };
                logs.push(`Found gallery item to process: ${item.title} (ID: ${item.id})`);
                const resultMessage = await processGalleryItem(item);
                logs.push(resultMessage);
                return NextResponse.json({ message: 'Content generation process completed.', logs });
            }
        }

        if (querySnapshot.empty) {
            logs.push('No new gallery items to generate content from.');
            return NextResponse.json({ message: 'No new gallery items found.', logs });
        }
        
        // This part runs if the first query for `isGenerated == false` was successful.
        const galleryDoc = querySnapshot.docs[0];
        const item = { id: galleryDoc.id, ...galleryDoc.data() };

        logs.push(`Found gallery item to process: ${item.title} (ID: ${item.id})`);

        const resultMessage = await processGalleryItem(item);
        logs.push(resultMessage);
        
        return NextResponse.json({ message: 'Content generation process completed.', logs });
        
    } catch (error: any) {
        console.error('[CRON_GENERATE_ERROR]', error);
        logs.push(`An unexpected error occurred: ${error.message}`);
        return NextResponse.json({ error: 'An unexpected error occurred during the content generation cron job.', logs }, { status: 500 });
    }
}
