import axios from 'axios';

const HEYGEN_API_URL = 'https://api.heygen.com/v1';
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a video from a text prompt using the HeyGen API.
 * @param text The text prompt for the video.
 * @returns The URL of the generated video.
 */
export async function generateReelFromText(text: string): Promise<string | null> {
  if (!HEYGEN_API_KEY) {
    throw new Error('HeyGen API key is not configured.');
  }

  try {
    // Step 1: Initiate video generation
    const createResponse = await axios.post(
      `${HEYGEN_API_URL}/video/generate`,
      {
        video_inputs: [
          {
            text: text,
          },
        ],
        test: true, // Use test mode to avoid consuming credits
        // In a real scenario, you might configure aspect ratio, voice, avatar, etc.
        // aspect_ratio: '9:16', 
      },
      {
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const videoId = createResponse.data?.data?.video_id;
    if (!videoId) {
      console.error('HeyGen API did not return a video_id:', createResponse.data);
      throw new Error('Failed to initiate video generation.');
    }

    console.log(`Started video generation with ID: ${videoId}`);

    // Step 2: Poll for video status
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 5 seconds = 2.5 minutes timeout
    const pollInterval = 5000; // 5 seconds

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Polling for video status... Attempt ${attempts}`);
      
      await sleep(pollInterval);
      
      const statusResponse = await axios.get(`${HEYGEN_API_URL}/video_status.get`, {
        params: { video_id: videoId },
        headers: { 'X-Api-Key': HEYGEN_API_KEY },
      });

      const videoStatus = statusResponse.data?.data?.status;

      if (videoStatus === 'completed') {
        console.log('Video generation completed!');
        const videoUrl = statusResponse.data.data.video_url;
        return videoUrl;
      }

      if (videoStatus === 'failed' || statusResponse.data?.error) {
        console.error('Video generation failed:', statusResponse.data);
        throw new Error(`Video generation failed: ${statusResponse.data?.error?.message || 'Unknown error'}`);
      }

      // Continue polling if status is 'processing' or another intermediate state
    }

    throw new Error('Video generation timed out.');

  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('HeyGen API Error:', error.response.data);
      throw new Error(`HeyGen API Error: ${error.response.data.message || 'An unknown error occurred'}`);
    }
    console.error('Error in generateReelFromText:', error);
    throw error; // Rethrow the original error
  }
}
