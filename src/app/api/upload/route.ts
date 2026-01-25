import { NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config'; // Use dedicated storage instance
import path from 'node:path';

const saveFile = async (file: File) => {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const fileExtension = path.extname(file.name);
  const filename = `automark/reels/${file.name.replace(
    fileExtension,
    ''
  )}-${uniqueSuffix}${fileExtension}`;
  
  const storageRef = ref(storage, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadBytes(storageRef, buffer, {
    contentType: file.type,
  });

  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};


export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file was uploaded." }, { status: 400 });
        }

        const url = await saveFile(file);

        return NextResponse.json({ success: true, url });

    } catch (e: any) {
        console.error('[UPLOAD_API_ERROR]', e);

        // Provide a more helpful error message for the common CORS issue.
        if (e.code === 'storage/unknown' || (e.message && e.message.includes('storage/unknown'))) {
            const bucket = storage.app.options.storageBucket;
            const detailedError = `Firebase Storage Error: A likely CORS configuration issue is preventing uploads. Please check the CORS policy for the bucket '${bucket}'. You may need to run a command like 'gcloud storage buckets update gs://${bucket} --update-cors-policy=cors-policy.json' with a permissive policy.`;
            return NextResponse.json({ success: false, error: detailedError }, { status: 500 });
        }

        return NextResponse.json({ success: false, error: e.message || 'An unknown error occurred.' }, { status: 500 });
    }
}