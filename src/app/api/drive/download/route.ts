
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

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
        return NextResponse.json({ error: 'Bad Request: No fileId provided.' }, { status: 400 });
    }

    try {
        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Google Drive API Error:", errorData);
            return NextResponse.json({ error: errorData.error?.message || 'Failed to download file from Google Drive.' }, { status: response.status });
        }
        
        // Stream the file back to the client
        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Content-Disposition', response.headers.get('Content-Disposition') || `attachment; filename="download"`);

        return new NextResponse(response.body, { headers });

    } catch (error: any) {
        console.error('Server-side error downloading file:', error);
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

    