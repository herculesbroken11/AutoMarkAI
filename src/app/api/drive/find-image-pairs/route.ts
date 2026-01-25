
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, collection, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

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

async function listSubfolders(accessToken: string, parentFolderId: string) {
    const query = `mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    const response = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error('Failed to list subfolders.');
    const data = await response.json();
    return data.files || [];
}

async function listImagesInFolder(accessToken: string, folderId: string) {
    const query = `mimeType contains 'image/' and '${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Failed to find images in folder ${folderId}.`);
    const data = await response.json();
    return data.files || [];
}


// --- Scan State Management ---

const SCAN_STATE_COLLECTION = 'drive_scan_state';

async function getScanStates() {
    const states: { [key: string]: Date } = {};
    const q = query(collection(galleryFirestore, SCAN_STATE_COLLECTION));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        states[doc.id] = doc.data().lastScannedAt.toDate();
    });
    return states;
}

async function updateScanState(folderId: string) {
    const stateRef = doc(galleryFirestore, SCAN_STATE_COLLECTION, folderId);
    await setDoc(stateRef, { lastScannedAt: new Date() });
}

// --- Recursive Search Logic ---

async function* findBeforeAfterPairRecursive(accessToken: string, folderId: string): AsyncGenerator<any> {
    const subfolders = await listSubfolders(accessToken, folderId);

    for (const folder of subfolders) {
        const folderNameLower = folder.name.toLowerCase();
        if (folderNameLower === 'before' || folderNameLower === 'after' || folderNameLower.startsWith('processed')) continue;

        const beforeSubfolder = await findFolder(accessToken, 'Before', folder.id);
        const afterSubfolder = await findFolder(accessToken, 'After', folder.id);

        if (beforeSubfolder && afterSubfolder) {
            const beforeImages = await listImagesInFolder(accessToken, beforeSubfolder.id);
            const afterImages = await listImagesInFolder(accessToken, afterSubfolder.id);

            // This check is now performed before yielding, preventing the bug.
            if (beforeImages.length > 0 && afterImages.length > 0) {
                yield {
                    contextName: folder.name,
                    beforeFiles: beforeImages,
                    afterFiles: afterImages,
                };
            }
        }
        
        yield* findBeforeAfterPairRecursive(accessToken, folder.id);
    }
}


export async function GET(req: NextRequest) {
    try {
        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);

        const mainFolder = await findFolder(accessToken, 'detailing pics');
        if (!mainFolder) {
            return NextResponse.json({ error: "Main folder 'detailing pics' not found." }, { status: 404 });
        }

        // 1. Get all service folders and their last scan times
        const serviceFolders = await listSubfolders(accessToken, mainFolder.id);
        const scanStates = await getScanStates();

        // 2. Sort folders: unscanned first, then by oldest scan time
        serviceFolders.sort((a, b) => {
            const timeA = scanStates[a.id]?.getTime() || 0;
            const timeB = scanStates[b.id]?.getTime() || 0;
            return timeA - timeB;
        });

        // 3. Iterate through sorted folders and find the first valid pair
        for (const serviceFolder of serviceFolders) {
             // Use the async generator to find the first valid pair within this service folder
            for await (const pair of findBeforeAfterPairRecursive(accessToken, serviceFolder.id)) {
                // The generator now only yields if the folders are not empty.
                if (pair) {
                    // 4. Update scan time and return the pair
                    await updateScanState(serviceFolder.id);
                    return NextResponse.json(pair);
                }
            }
        }
        
        // If the loop completes without finding any pairs in any service folder
        return NextResponse.json({ error: "No subfolders with both 'Before' and 'After' image folders were found in any service directory." }, { status: 404 });

    } catch (error: any) {
        console.error('Error finding image pairs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
