// This file is no longer needed as the folder setup logic
// has been moved to a server action in `src/app/actions.ts`.
// This file can be safely deleted.
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    return NextResponse.json({ 
        message: "This endpoint is deprecated. Folder setup is now handled by the `setupGoogleDriveFolders` server action." 
    }, { status: 410 });
}
