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

async function getBreadcrumbs(accessToken: string, folderId: string) {
    if (folderId === 'root') return [];
    
    let breadcrumbs = [];
    let currentId: string | null = folderId;

    try {
        while(currentId && currentId !== 'root') {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${currentId}?fields=id,name,parents`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!response.ok) break;

            const data = await response.json();
            breadcrumbs.unshift({ id: data.id, name: data.name });
            
            currentId = (data.parents && data.parents.length > 0) ? data.parents[0] : null;
        }
    } catch (e) {
        console.error("Breadcrumb fetch error:", e);
    }

    return breadcrumbs;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId') || 'root';
    const mimeType = searchParams.get('mimeType');

    try {
        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);

        const fields = "files(id,name,mimeType,parents)";
        let query = `'${folderId}' in parents and trashed = false`;
        if (mimeType) {
            query += ` and mimeType contains '${mimeType}'`
        }

        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=folder,name`;
        
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Google Drive API Error:", errorData);
            return NextResponse.json({ error: errorData.error?.message || 'Failed to fetch files from Google Drive.' }, { status: response.status });
        }

        const data = await response.json();
        
        const breadcrumbs = await getBreadcrumbs(accessToken, folderId);

        return NextResponse.json({ files: data.files || [], breadcrumbs });
    } catch (error: any) {
        console.error('Server-side error fetching files:', error);
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

    