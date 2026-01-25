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
        const { fileId, toFolderId, fromFolderId } = await req.json();
        if (!fileId || !toFolderId || !fromFolderId) {
            return NextResponse.json({ error: 'fileId, toFolderId, and fromFolderId are required' }, { status: 400 });
        }

        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}`;
        const response = await fetch(url, { 
            method: 'PATCH', 
            headers: { Authorization: `Bearer ${accessToken}` } 
        });

        if (!response.ok) {
            console.error(`Failed to move file ${fileId}. Status: ${response.status}`);
            const errorData = await response.text();
            console.error('Error details:', errorData);
            throw new Error('Failed to move file in Google Drive.');
        }

        return NextResponse.json({ success: true, message: 'File moved successfully.' });

    } catch (error: any) {
        console.error('Error moving file:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
