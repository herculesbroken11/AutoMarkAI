import { NextRequest } from 'next/server';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { ReadableStream } from 'stream/web';
import { getGoogleApiCredentials, getRefreshedAccessToken, GoogleDriveAuthError } from '@/lib/google-drive-auth';

const FOLDER_NAME = "AutoMarkAI Shop Photos";
const SYNC_COLLECTION = 'synced_files';

async function findOrCreateFolder(accessToken: string, name: string): Promise<string> {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and 'root' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error('Failed to search for folder.');

    const data = await response.json();
    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }

    // If not found, create it
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const metadata = { name, mimeType: 'application/vnd.google-apps.folder', parents: ['root'] };
    const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
    });
    if (!createResponse.ok) throw new Error('Failed to create folder.');
    const folder = await createResponse.json();
    return folder.id;
}


async function* recursiveScan(accessToken: string, folderId: string, path: string = ''): AsyncGenerator<any> {
    const query = `'${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,md5Checksum,modifiedTime)`;

    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
        console.error("Failed to list files for folder:", folderId, await response.json());
        return; // Stop this branch of recursion on error
    }

    const data = await response.json();
    const files = data.files || [];

    for (const file of files) {
        const currentPath = `${path}/${file.name}`;
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            yield* recursiveScan(accessToken, file.id, currentPath);
        } else if (file.mimeType.startsWith('image/')) {
            yield { ...file, path: currentPath };
        }
    }
}


export async function POST(req: NextRequest) {
    // This makes the endpoint a streaming response
    const readable = new ReadableStream({
        async start(controller) {
            const send = (data: any) => controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'));

            try {
                const creds = await getGoogleApiCredentials();
                const accessToken = await getRefreshedAccessToken(creds);

                send({ log: `Starting sync process...` });
                
                send({ log: `Looking for main folder: "${FOLDER_NAME}"` });
                const mainFolderId = await findOrCreateFolder(accessToken, FOLDER_NAME);
                send({ log: `Found main folder with ID: ${mainFolderId}` });
                
                send({ log: "Starting recursive scan for all photos..." });
                let fileCount = 0;
                let syncedCount = 0;

                for await (const file of recursiveScan(accessToken, mainFolderId)) {
                    fileCount++;
                    send({ log: `Found file: ${file.path}` });
                    
                    const fileRef = doc(galleryFirestore, SYNC_COLLECTION, file.id);
                    const fileDoc = await getDoc(fileRef);

                    if (fileDoc.exists()) {
                        const existingData = fileDoc.data();
                        if (existingData.md5Checksum === file.md5Checksum) {
                            send({ log: `File is unchanged (checksum match). Skipping.` });
                            continue; // File is a perfect duplicate
                        }
                    }

                    await setDoc(fileRef, {
                        driveId: file.id,
                        name: file.name,
                        path: file.path,
                        md5Checksum: file.md5Checksum,
                        modifiedTime: file.modifiedTime,
                        lastSyncedAt: Timestamp.now(),
                    });
                    syncedCount++;
                    send({ log: `Synced file: ${file.name}` });
                }

                send({ log: `Scan complete. Found ${fileCount} files. Synced ${syncedCount} new or updated files.` });
                send({ status: 'completed', fileCount, syncedCount });

            } catch (error) {
                console.error("Sync Error:", error);
                const message = error instanceof GoogleDriveAuthError
                    ? error.message
                    : (error instanceof Error ? error.message : "An unknown error occurred during sync.");
                send({ error: message, code: error instanceof GoogleDriveAuthError ? error.code : undefined });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(readable, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

    