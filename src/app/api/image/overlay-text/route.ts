// This API route handles the creation of a side-by-side "before and after" image.
// It fetches two images, resizes them, stitches them together, adds a graphic overlay,
// and uploads the final composite image to Firebase Storage.
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config';
import { z } from 'zod';

const schema = z.object({
  beforeUrl: z.string().url(),
  afterUrl: z.string().url(),
});

const overlayImageUrl = 'https://i.postimg.cc/8zYTyyPc/beforafter.png';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const validated = schema.safeParse(body);
        
        if (!validated.success) {
            return NextResponse.json({ 
                error: true, 
                message: 'Invalid request body. Please provide beforeUrl and afterUrl.' 
            }, { status: 400 });
        }

        const { beforeUrl, afterUrl } = validated.data;
        
        // 1. Fetch images (before, after, and the overlay)
        const [beforeResponse, afterResponse, overlayResponse] = await Promise.all([
            fetch(beforeUrl).catch(e => { throw new Error(`Failed to fetch beforeUrl: ${beforeUrl}`); }),
            fetch(afterUrl).catch(e => { throw new Error(`Failed to fetch afterUrl: ${afterUrl}`); }),
            fetch(overlayImageUrl).catch(e => { throw new Error(`Failed to fetch overlay image.`); })
        ]);

        if (!beforeResponse.ok) throw new Error(`HTTP error fetching beforeUrl: ${beforeResponse.statusText}`);
        if (!afterResponse.ok) throw new Error(`HTTP error fetching afterUrl: ${afterResponse.statusText}`);
        if (!overlayResponse.ok) throw new Error(`HTTP error fetching overlay image: ${overlayResponse.statusText}`);

        const [beforeBuffer, afterBuffer, overlayBuffer] = await Promise.all([
            beforeResponse.arrayBuffer().then(b => Buffer.from(b)),
            afterResponse.arrayBuffer().then(b => Buffer.from(b)),
            overlayResponse.arrayBuffer().then(b => Buffer.from(b))
        ]);

        // 2. Process and resize images to a standard size
        const imageSize = { width: 540, height: 960 }; // Vertical aspect ratio (9:16)
        const beforeImage = await sharp(beforeBuffer).resize(imageSize).toBuffer();
        const afterImage = await sharp(afterBuffer).resize(imageSize).toBuffer();

        // 3. Create a new canvas to stitch them together
        const compositeWidth = imageSize.width * 2;
        const compositeHeight = imageSize.height;

        // 4. Stitch images together and add the overlay
        const stitchedBuffer = await sharp({
            create: {
                width: compositeWidth,
                height: compositeHeight,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 }
            }
        })
        .composite([
            { input: beforeImage, left: 0, top: 0 },
            { input: afterImage, left: imageSize.width, top: 0 },
            { 
                input: overlayBuffer,
                gravity: 'north' // Places the overlay at the top center
            }
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

        // 5. Upload the final stitched image to Firebase Storage
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const filename = `automark/stitched-images/stitched-${uniqueSuffix}.jpg`;
        const storageRef = ref(storage, filename);
        
        await uploadBytes(storageRef, stitchedBuffer, { 
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000'
        });
        
        const stitchedImageUrl = await getDownloadURL(storageRef);

        return NextResponse.json({
            success: true,
            message: "Images stitched and labeled successfully.",
            stitchedImageUrl: stitchedImageUrl
        });

    } catch (error: any) {
        console.error('[IMAGE_STITCH_API_ERROR]', error);
        return NextResponse.json({
            error: true,
            message: error.message || "An unknown error occurred during image processing."
        }, { status: 500 });
    }
}
    