import { NextRequest, NextResponse } from 'next/server';
import { getGoogleApiCredentials, getRefreshedAccessToken, GoogleDriveAuthError } from '@/lib/google-drive-auth';

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

    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            const status = error.code === 'INVALID_GRANT' ? 401 : 400;
            return NextResponse.json({ error: error.message, code: error.code }, { status });
        }
        console.error('Server-side error downloading file:', error);
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

    