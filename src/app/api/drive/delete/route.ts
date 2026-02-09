import { NextRequest, NextResponse } from 'next/server';
import { getGoogleApiCredentials, getRefreshedAccessToken, GoogleDriveAuthError } from '@/lib/google-drive-auth';

export async function POST(req: NextRequest) {
    try {
        const { fileId } = await req.json();
        if (!fileId) {
            return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
        }

        const creds = await getGoogleApiCredentials();
        const accessToken = await getRefreshedAccessToken(creds);

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        // DELETE often returns 204 No Content on success
        if (response.status === 204 || response.ok) {
             return NextResponse.json({ success: true }, { status: 200 });
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Failed to delete file');

    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            const status = error.code === 'INVALID_GRANT' ? 401 : 400;
            return NextResponse.json({ error: error.message, code: error.code }, { status });
        }
        console.error('Error deleting file:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete file' }, { status: 500 });
    }
}

    