
import { NextResponse } from 'next/server';
import { z } from 'zod';
// Use the 'galleryFirestore' instance which points to the 'porters-detailing' project
import { galleryFirestore } from '@/firebase/config';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { generateCaptions } from '@/ai/replicate';

const schema = z.object({
  galleryItem: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional().default(''),
    category: z.string(),
    // The stitched image URL is now expected
    stitchedImageUrl: z.string().url(),
  }),
});

export async function POST(request: Request) {
  let jsonData;
  try {
    jsonData = await request.json();
  } catch (error) {
    return NextResponse.json({
      message: "Failed to parse JSON body.",
      error: true,
    }, { status: 400 });
  }
  
  const validated = schema.safeParse(jsonData);

  if (!validated.success) {
    const errorMessages = Object.values(validated.error.flatten().fieldErrors)
      .flat()
      .join(' ');
    return NextResponse.json({
      message: errorMessages || 'Invalid request data.',
      error: true,
    }, { status: 400 });
  }

  const { galleryItem } = validated.data;

  try {
    const result = await generateCaptions({
      vehicle: galleryItem.title,
      service: galleryItem.category,
      package: galleryItem.description || 'Not specified',
      location: 'Your Location', // You may want to make this dynamic later
    });

    // Save each generated caption to the 'posts' collection in the 'porters-detailing' project's firestore
    for (const post of result) {
      await addDoc(collection(galleryFirestore, 'posts'), {
        ...post,
        vehicle: galleryItem.title,
        service: galleryItem.category,
        package: galleryItem.description,
        location: 'Your Location',
        // Save the single stitched image URL
        stitchedImageUrl: galleryItem.stitchedImageUrl, 
        status: 'pending', // All generated posts start as pending
        createdAt: new Date().toISOString(),
        originalGalleryId: galleryItem.id, // Keep a reference to the source
      });
    }

    // After successfully generating content, mark the gallery item as generated
    const galleryItemRef = doc(galleryFirestore, 'gallery', galleryItem.id);
    await updateDoc(galleryItemRef, {
      isGenerated: true,
    });

    return NextResponse.json({
      message: 'Successfully generated captions and saved for approval.',
      captions: result,
      error: false,
    });
  } catch (e: any) {
    console.error('[API_ERROR] /api/content/generate-from-gallery:', e);
    return NextResponse.json({
      message: e.message || 'An unexpected error occurred while generating captions.',
      error: true,
    }, { status: 500 });
  }
}
    