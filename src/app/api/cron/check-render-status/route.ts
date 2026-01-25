// This API route has been deprecated and replaced by in-browser video processing
// in the /dashboard/reels page. It is no longer used and can be safely removed.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    return NextResponse.json({ 
        message: "This endpoint is deprecated. Video processing now occurs in the browser on the Reels page." 
    }, { status: 410 });
}
