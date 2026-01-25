import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateBeforeAfterCaption } from '@/ai/replicate';

const schema = z.object({
  service: z.string().min(1, "'service' is required."),
  vehicle: z.string().min(1, "'vehicle' is required."),
  beforeDescription: z.string().min(1, "'beforeDescription' is required."),
  afterDescription: z.string().min(1, "'afterDescription' is required."),
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
      caption: null,
      error: true,
    }, { status: 400 });
  }

  const validated = schema.safeParse(data);

  if (!validated.success) {
    const errorMessages = Object.values(validated.error.flatten().fieldErrors).flat().join(' ');
    return NextResponse.json({
      message: `Invalid request. ${errorMessages}`,
      caption: null,
      error: true,
    }, { status: 400 });
  }

  try {
    const result = await generateBeforeAfterCaption(validated.data);
    return NextResponse.json({
      message: 'Successfully generated before/after caption.',
      caption: result,
      error: false,
    });
  } catch (e: any) {
    console.error('[API_ERROR] /api/content/generate-before-after-caption:', e);
    return NextResponse.json({
      message: e.message || 'An unexpected error occurred while generating the caption.',
      caption: null,
      error: true,
    }, { status: 500 });
  }
}
