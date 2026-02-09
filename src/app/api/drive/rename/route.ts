import { NextRequest, NextResponse } from 'next/server';
import { getGoogleApiCredentials, getRefreshedAccessToken, GoogleDriveAuthError } from '@/lib/google-drive-auth';

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

    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            const status = error.code === 'INVALID_GRANT' ? 401 : 400;
            return NextResponse.json({ error: error.message, code: error.code }, { status });
        }
        console.error('Error renaming file:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to rename file' }, { status: 500 });
    }
}

    