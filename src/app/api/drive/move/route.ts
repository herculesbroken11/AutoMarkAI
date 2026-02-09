import { NextRequest, NextResponse } from 'next/server';
import { getGoogleApiCredentials, getRefreshedAccessToken, GoogleDriveAuthError } from '@/lib/google-drive-auth';

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

    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            const status = error.code === 'INVALID_GRANT' ? 401 : 400;
            return NextResponse.json({ error: error.message, code: error.code }, { status });
        }
        console.error('Error moving file:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to move file' }, { status: 500 });
    }
}
