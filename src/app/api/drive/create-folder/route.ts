import { NextRequest, NextResponse } from 'next/server';
import { getGoogleApiCredentials, getRefreshedAccessToken, GoogleDriveAuthError } from '@/lib/google-drive-auth';


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

    } catch (error) {
        if (error instanceof GoogleDriveAuthError) {
            const status = error.code === 'INVALID_GRANT' ? 401 : 400;
            return NextResponse.json({ error: error.message, code: error.code }, { status });
        }
        console.error('Error creating/finding folder:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create folder' }, { status: 500 });
    }
}

    