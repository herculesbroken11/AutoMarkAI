import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

async function fileToDataUri(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${file.type};base64,${base64}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const prompt = formData.get('prompt') as string;
    const imageFile = formData.get('image') as File | null;
    
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'No prompt provided.' },
        { status: 400 }
      );
    }
    
    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: 'No image provided.' },
        { status: 400 }
      );
    }

    const imageUri = await fileToDataUri(imageFile);

    console.log('Calling Replicate API to generate video from image...');
    
    // Using Stable Video Diffusion
    const output = await replicate.run(
      "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
      {
        input: {
          input_image: imageUri,
          video_length: "25_frames_with_svd_xt",
          sizing_strategy: "maintain_aspect_ratio",
          frames_per_second: 6,
          motion_bucket_id: 127,
          cond_aug: 0.02,
        }
      }
    ) as string | string[];
    
    const videoUrl = Array.isArray(output) ? output[0] : output;

    if (!videoUrl) {
      throw new Error('Replicate API did not return a video URL.');
    }

    console.log('Video generated successfully:', videoUrl);
    return NextResponse.json({
      success: true,
      videoUrl: videoUrl,
      message: 'Video generated successfully with Stable Video Diffusion!',
    });

  } catch (error: any) {
    console.error('❌ API Error in /api/generate-reel:', error);
    
    if (error.message?.includes('credit')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient Replicate credits. Please add credits to your account.' 
        },
        { status: 402 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An unknown error occurred.' 
      },
      { status: 500 }
    );
  }
}
