
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, addDoc, collection, writeBatch, updateDoc } from 'firebase/firestore';
import { galleryFirestore, storage } from '@/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateCaptions } from '@/ai/replicate';
import sharp from 'sharp';

// --- Google Drive API Helpers ---

async function getGoogleApiCredentials() {
    const settingsRef = doc(galleryFirestore, 'settings', 'googleDrive');
    const docSnap = await getDoc(settingsRef);
    if (!docSnap.exists()) throw new Error("Google Drive API credentials are not configured in settings.");
    return docSnap.data();
}

async function getRefreshedAccessToken(creds: any) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            refresh_token: creds.refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Failed to refresh access token.');
    return data.access_token;
}

async function findFolder(accessToken: string, name: string, parentId = 'root') {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    const searchResponse = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!searchResponse.ok) return null;
    const data = await searchResponse.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
}

async function findOrCreateFolder(accessToken: string, name: string, parentId = 'root') {
    let folder = await findFolder(accessToken, name, parentId);
    if (folder) return folder.id;
    const fileMetadata = { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] };
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fileMetadata)
    });
    if (!createResponse.ok) throw new Error(`Failed to create folder '${name}'.`);
    return (await createResponse.json()).id;
}

async function listImagesInFolder(accessToken: string, folderId: string) {
    const query = `mimeType contains 'image/' and '${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents,mimeType)&orderBy=name`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Failed to find images in folder ${folderId}.`);
    const data = await response.json();
    return data.files || [];
}

async function moveFile(accessToken: string, fileId: string, toFolderId: string, fromFolderId: string) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}&fields=id,parents`;
    await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } });
}

async function downloadFileAsBuffer(accessToken: string, fileId: string): Promise<Buffer> {
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const imageResponse = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!imageResponse.ok) throw new Error(`Failed to download image ${fileId} from Drive.`);
    return Buffer.from(await imageResponse.arrayBuffer());
}

async function uploadToStorage(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, buffer, { contentType: mimeType });
    return getDownloadURL(storageRef);
}

// --- Recursive Search for 'After' Folders ---
async function* findAfterFolders(accessToken: string, folderId: string, logs: string[]): AsyncGenerator<any> {
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,parents)`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
        logs.push(`Warning: Could not list folders in ${folderId}`);
        return;
    }
    const data = await response.json();
    const subfolders = data.files || [];

    for (const folder of subfolders) {
        const folderNameLower = folder.name.toLowerCase();
        if (folderNameLower === 'after') {
            const images = await listImagesInFolder(accessToken, folder.id);
            if (images.length > 0) {
                logs.push(`Found 'After' folder with ${images.length} images in parent ID: ${folder.parents[0]}`);
                yield { folder, images };
            }
        } else if (folderNameLower !== 'before' && !folderNameLower.startsWith('processed')) {
            // Continue searching recursively
            yield* findAfterFolders(accessToken, folder.id, logs);
        }
    }
}

async function getFolderPath(accessToken: string, folderId: string): Promise<string> {
    let path = [];
    let currentId = folderId;
    while (currentId) {
        const fileUrl = `https://www.googleapis.com/drive/v3/files/${currentId}?fields=id,name,parents`;
        const fileResponse = await fetch(fileUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!fileResponse.ok) break;
        const fileData = await fileResponse.json();
        path.unshift(fileData.name);
        currentId = fileData.parents ? fileData.parents[0] : null;
    }
    // Remove "My Drive" and "detailing pics"
    return path.slice(2).join(' / ');
}


// --- Main Cron Job Logic ---
export async function GET(request: NextRequest) {
    const logs: string[] = [];

    const authToken = (request.headers.get('authorization') || '').split('Bearer ').at(1);
    if (process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
        logs.push('Authentication failed: Invalid cron secret.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        logs.push('Cron job started: Processing from Google Drive...');
        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);
        
        const mainFolder = await findFolder(accessToken, 'detailing pics');
        if (!mainFolder) {
            logs.push("Main folder 'detailing pics' not found. Exiting.");
            return NextResponse.json({ message: "Main folder 'detailing pics' not found.", logs });
        }
        logs.push(`Found main folder 'detailing pics' (ID: ${mainFolder.id})`);

        for await (const result of findAfterFolders(accessToken, mainFolder.id, logs)) {
            const { folder: afterFolder, images: availableImages } = result;

            // Randomly decide to take 1, 2, or 3 images
            const imageCount = Math.min(availableImages.length, Math.floor(Math.random() * 3) + 1);
            // Shuffle and pick
            const selectedImages = availableImages.sort(() => 0.5 - Math.random()).slice(0, imageCount);

            logs.push(`Selected ${selectedImages.length} images from folder ${afterFolder.name}.`);

            const imageUrls: string[] = [];
            for (const image of selectedImages) {
                logs.push(`Processing image: ${image.name}`);
                const imageBuffer = await downloadFileAsBuffer(accessToken, image.id);
                const processedBuffer = await sharp(imageBuffer)
                    .resize(1080, 1350, { fit: 'cover', position: 'center' })
                    .jpeg({ quality: 90 })
                    .toBuffer();
                const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                const storageFilename = `automark/drive-processed/${image.name.split('.')[0]}-${uniqueSuffix}.jpg`;
                const uploadedUrl = await uploadToStorage(processedBuffer, storageFilename, 'image/jpeg');
                imageUrls.push(uploadedUrl);
                logs.push(`Uploaded to: ${uploadedUrl}`);
            }

            const contextPath = await getFolderPath(accessToken, afterFolder.parents[0]);
            logs.push(`Generating captions with context: '${contextPath}'`);

            const captions = await generateCaptions({
                vehicle: contextPath,
                service: contextPath,
                package: 'Premium Detailing Service',
            });
            if (!captions || captions.length === 0) throw new Error("AI failed to generate captions.");

            const batch = writeBatch(galleryFirestore);
            captions.forEach(post => {
                const newPostRef = doc(collection(galleryFirestore, "posts"));
                batch.set(newPostRef, {
                    ...post,
                    imageUrls: imageUrls, // Save array of URLs
                    vehicle: contextPath,
                    service: contextPath,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    originalDriveIds: selectedImages.map(img => img.id),
                });
            });
            await batch.commit();
            logs.push(`Saved ${captions.length} posts for approval.`);

            const processedAfterFolderId = await findOrCreateFolder(accessToken, "processed after", afterFolder.parents[0]);
            for (const image of selectedImages) {
                await moveFile(accessToken, image.id, processedAfterFolderId, afterFolder.id);
            }
            logs.push(`Moved ${selectedImages.length} images to 'processed after' folder.`);

            // Process only one 'After' folder per cron run to distribute work.
            return NextResponse.json({ message: `Successfully processed ${selectedImages.length} images from ${contextPath}.`, logs });
        }
        
        logs.push("No new 'After' folders with images found to process. Exiting.");
        return NextResponse.json({ message: 'No new images to process.', logs });

    } catch (error: any) {
        console.error('[CRON_DRIVE_GENERATE_ERROR]', error);
        logs.push(`An unexpected error occurred: ${error.message}`);
        return NextResponse.json({ error: 'An unexpected error occurred during the cron job.', logs }, { status: 500 });
    }
}
