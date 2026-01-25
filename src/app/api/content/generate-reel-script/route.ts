import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateReelScript } from '@/ai/replicate';

const schema = z.object({
  service: z.string().min(1, "'service' is required."),
  vehicle: z.string().min(1, "'vehicle' is required."),
  duration: z.coerce.number().min(5, "Duration must be at least 5 seconds."),
});

export async function POST(request: Request) {
    let data;
    const contentType = request.headers.get('content-type') || '';
    
    try {
        if (contentType.includes('application/json')) {
          data = await request.json();
        } else { // Default to form data
          const formData = await request.formData();
          data = Object.fromEntries(formData);
        }
    } catch (error) {
        return NextResponse.json({
            message: 'Failed to parse request body.',
            script: null,
            error: true,
        }, { status: 400 });
    }

  const validated = schema.safeParse(data);

  if (!validated.success) {
    const errorMessages = Object.values(validated.error.flatten().fieldErrors).flat().join(' ');
    return NextResponse.json({
      message: `Invalid request. ${errorMessages}`,
      script: null,
      error: true,
    }, { status: 400 });
  }

  try {
    const result = await generateReelScript(validated.data);
    return NextResponse.json({
      message: 'Successfully generated reel script.',
      script: result,
      error: false,
    });
  } catch (e: any) {
    console.error('[API_ERROR] /api/content/generate-reel-script:', e);
    return NextResponse.json({
      message: e.message || 'An unexpected error occurred while generating the script.',
      script: null,
      error: true,
    }, { status: 500 });
  }
}
