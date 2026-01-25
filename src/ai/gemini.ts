
'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
}
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});

/**
 * Parses the raw text output from the AI into a structured format.
 * @param text The raw text from the AI.
 * @returns An array of caption objects.
 */
function parseCaptions(text: string) {
  const platforms = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "GOOGLE_BUSINESS"];
  const captions: any[] = [];
  
  const sections = text.split(/\[(INSTAGRAM|FACEBOOK|TIKTOK|GOOGLE_BUSINESS)\]/i).slice(1);

  for (let i = 0; i < sections.length; i += 2) {
    const platform = sections[i].toLowerCase().replace('_', ' ');
    const content = sections[i+1].trim();
    
    const textMatch = content.split('#')[0].trim();
    const hashtags = (content.match(/#\w+/g) || []).map(h => h.trim());

    captions.push({
      platform: platform,
      text: textMatch,
      hashtags: hashtags,
    });
  }
  
  return captions;
}

async function generateWithGemini(prompt: string): Promise<string> {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}


/**
 * Generate social media captions using Gemini
 */
export async function generateCaptions(params: {
  vehicle: string;
  service: string;
  package: string;
  location?: string;
}) {
  const prompt = `
Generate social media posts for a car detailing service based on the following details. Only generate a post for Instagram.

**Details:**
- Vehicle: ${params.vehicle}
- Service: ${params.service}
- Package: ${params.package}
${params.location ? `- Location: ${params.location}` : ''}

**Instructions:**
Create a unique post for the following platform: Instagram.
Use the format exactly as specified below, including the platform header.

[INSTAGRAM]
- Tone: Engaging and visually focused.
- Content: A caption under 150 words.
- Includes: 10-15 relevant hashtags, 2-3 emojis, and a call-to-action.
- Format: Just the caption text, followed by hashtags.
  `.trim();

  const generatedText = await generateWithGemini(prompt);
  return parseCaptions(generatedText);
}

/**
 * Generate push notification message
 */
export async function generatePushNotification(params: {
  trigger: 'weather' | 'service_due' | 'promotion';
  context: string;
}) {
  const prompt = `
Generate a short push notification message (under 100 characters) for:

Trigger: ${params.trigger}
Context: ${params.context}

Requirements:
- Urgent and action-oriented
- Include 1 emoji
- Create curiosity
- Professional tone
  `.trim();

  return await generateWithGemini(prompt);
}

/**
 * Generate SEO keywords
 */
export async function generateSEOKeywords(params: {
  service: string;
  location: string;
  vehicle?: string;
}) {
  const prompt = `
Generate 10 SEO keywords for:
Service: ${params.service}
Location: ${params.location}
${params.vehicle ? `Vehicle: ${params.vehicle}` : ''}

Include:
- Location-based keywords (e.g., "ceramic coating ${params.location}")
- Service-specific keywords
- Long-tail keywords (e.g., "best ${params.service.toLowerCase()} near me")

Return as comma-separated list.
  `.trim();

  const keywordsString = await generateWithGemini(prompt);
  return keywordsString.split(',').map(k => k.trim());
}

/**
 * Generate a before/after caption
 */
export async function generateBeforeAfterCaption(params: {
  service: string;
  vehicle: string;
  beforeDescription: string;
  afterDescription: string;
}) {
  const prompt = `
Generate a compelling social media caption for a before-and-after post.

Vehicle: ${params.vehicle}
Service: ${params.service}
Before State: ${params.beforeDescription}
After State: ${params.afterDescription}

Requirements:
- Start with a hook.
- Mention the transformation and the service.
- End with a call to action.
- Include 3-5 relevant emojis.
- Include 5-8 relevant hashtags.
- Keep it under 280 characters.
  `.trim();

  return await generateWithGemini(prompt);
}

/**
 * Generate a reel script
 */
export async function generateReelScript(params: {
  service: string;
  vehicle: string;
  duration: number;
}) {
  const prompt = `
Create a script outline for a ${params.duration}-second Instagram Reel or TikTok video about a car detailing service.

Vehicle: ${params.vehicle}
Service: ${params.service}
Duration: ${params.duration} seconds

Requirements:
- Provide a scene-by-scene breakdown (e.g., 0-2s, 2-10s, 10-15s).
- Include suggestions for on-screen text.
- Suggest a type of music (e.g., "upbeat electronic", "trending hip-hop").
  `.trim();

  return await generateWithGemini(prompt);
}
