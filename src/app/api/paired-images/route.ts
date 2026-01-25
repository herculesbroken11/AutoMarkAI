
import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

const PAIRED_IMAGES_COLLECTION = 'paired_images';

// GET: Fetches all paired image IDs
export async function GET(req: NextRequest) {
    try {
        const pairedImagesRef = collection(galleryFirestore, PAIRED_IMAGES_COLLECTION);
        const snapshot = await getDocs(pairedImagesRef);

        const pairedIds: string[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.beforeId) pairedIds.push(data.beforeId);
            if (data.afterId) pairedIds.push(data.afterId);
        });
        
        return NextResponse.json({ success: true, pairedIds: Array.from(new Set(pairedIds)) });
    } catch (error: any) {
        console.error("Error fetching paired images:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch paired image data." }, { status: 500 });
    }
}


// POST: Saves a new pair of image IDs
export async function POST(req: NextRequest) {
    try {
        const { beforeId, afterId, beforeName, afterName, score, contextName } = await req.json();

        if (!beforeId || !afterId) {
            return NextResponse.json({ success: false, error: 'Both beforeId and afterId are required.' }, { status: 400 });
        }

        const pairedImagesRef = collection(galleryFirestore, PAIRED_IMAGES_COLLECTION);

        // Optional: Check if either image is already part of a pair to prevent duplicates
        const qBefore = query(pairedImagesRef, where('beforeId', '==', beforeId));
        const qAfter = query(pairedImagesRef, where('afterId', '==', afterId));
        const [beforeSnap, afterSnap] = await Promise.all([getDocs(qBefore), getDocs(qAfter)]);

        if (!beforeSnap.empty || !afterSnap.empty) {
            return NextResponse.json({ success: false, error: 'One or both of these images are already part of a pair.' }, { status: 409 });
        }

        await addDoc(pairedImagesRef, {
            beforeId,
            afterId,
            beforeName,
            afterName,
            score,
            contextName,
            createdAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true, message: 'Image pair saved successfully.' });

    } catch (error: any) {
        console.error("Error saving paired image:", error);
        return NextResponse.json({ success: false, error: "Failed to save image pair." }, { status: 500 });
    }
}
