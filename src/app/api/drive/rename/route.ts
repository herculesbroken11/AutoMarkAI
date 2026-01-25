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
        const { fileId, newName } = await req.json();
        if (!fileId || !newName) {
            return NextResponse.json({ error: 'File ID and new name are required' }, { status: 400 });
        }

        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);

        const fileMetadata = {
            name: newName,
        };

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fileMetadata),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Failed to rename file');
        }

        const updatedFile = await response.json();
        return NextResponse.json(updatedFile, { status: 200 });

    } catch (error: any) {
        console.error('Error renaming file:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

    