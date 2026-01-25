import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

// --- Google API Helpers ---
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


export async function POST(req: NextRequest) {
    try {
        const { name, parentId, isFind } = await req.json();
        if (!name) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);

        // If isFind is true, first try to find the folder.
        if (isFind) {
            const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId || 'root'}' in parents and trashed=false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
            const searchResponse = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!searchResponse.ok) {
                 const errorData = await searchResponse.json();
                 throw new Error(errorData.error.message || 'Failed to search for folder');
            }
            const data = await searchResponse.json();
            if (data.files && data.files.length > 0) {
                return NextResponse.json(data.files[0], { status: 200 });
            }
        }
        
        // If not found or not a find operation, create it.
        const fileMetadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : ['root'],
        };

        const response = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fileMetadata),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Failed to create folder');
        }

        const createdFolder = await response.json();
        return NextResponse.json(createdFolder, { status: 201 });

    } catch (error: any) {
        console.error('Error creating/finding folder:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

    