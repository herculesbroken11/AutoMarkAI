

'use server';

import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

/**
 * Parses the raw text output from the AI into a structured format.
 * @param text The raw text from the AI.
 * @returns An array of caption objects.
 */
function parseCaptions(text: string): any[] {
  const platforms = [
    "INSTAGRAM", "YOUTUBE", "TIKTOK", "FACEBOOK"
  ];
  const captions: any[] = [];
  
  // Create a regex that is case-insensitive and joins the platforms with |
  const regex = new RegExp(`\\[(${platforms.join('|')})\\]`, 'i');
  const sections = text.split(regex).slice(1);

  for (let i = 0; i < sections.length; i += 2) {
    const platform = sections[i].toLowerCase().replace(/_/g, ' ');
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

export async function generateWithReplicate(prompt: string): Promise<string> {
    const output = await replicate.run(
        "meta/meta-llama-3-70b-instruct",
        {
          input: {
            prompt: prompt,
            temperature: 0.75,
            top_p: 1,
            max_tokens: 4096, // Increased for more platforms
          }
        }
      ) as string[];
      
      return output.join("");
}


/**
 * Generate social media captions using Llama 3
 */
export async function generateCaptions(params: {
  vehicle: string;
  service: string;
  package: string;
  location?: string;
  platforms?: 'all' | 'youtube';
}) {
  const platformInstructions = params.platforms === 'youtube'
    ? `
[YOUTUBE]
- Tone: Informative & descriptive. A detailed video description (2-3 paragraphs) for a before/after video. Include a section for timestamps (e.g., 0:00 Intro, 0:15 Before, 1:00 After). Include relevant keywords in the description.`
    : `
[INSTAGRAM]
- Tone: Engaging & visually focused. A caption under 150 words. Include 10-15 relevant hashtags & a call-to-action.

[FACEBOOK]
- Tone: Community-oriented for a personal profile or group. A slightly more detailed post (2-3 sentences), ending with a question to encourage comments.

[YOUTUBE]
- Tone: Informative & descriptive. A detailed video description (2-3 paragraphs) for a before/after video. Include a section for timestamps (e.g., 0:00 Intro, 0:15 Before, 1:00 After). Include relevant keywords in the description.

[TIKTOK]
- Tone: Trendy & fast-paced. A short, punchy caption for a 15-second video. Include 5-7 trending & relevant hashtags.`;
  
  const prompt = `
You are a witty and professional social media manager for a car detailing business.
Generate social media posts based on the following details.

**Details:**
- Vehicle: ${params.vehicle}
- Service: ${params.service}
- Package: ${params.package}
${params.location ? `- Location: ${params.location}` : ''}

**Instructions:**
Create a unique post for the following platforms.
Use the format exactly as specified below, including the platform headers in all-caps brackets. Do not add any other commentary.

${platformInstructions}
  `.trim();
  
  const generatedText = await generateWithReplicate(prompt);
  return parseCaptions(generatedText);
}

/**
 * Generate push notification message
 */
export async function generatePushNotification(params: {
  trigger: string;
  context: string;
}) {
  const prompt = `
Generate a short push notification message (under 100 characters) for a car detailing app based on the following trigger:

Trigger: ${params.trigger}
Context: ${params.context}

Requirements:
- Urgent and action-oriented
- Include 1 emoji
- Create curiosity
- Professional tone
- Do not include any intro or explanation. Just return the notification text.
  `.trim();

  return await generateWithReplicate(prompt);
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
Generate 10 SEO keywords for a car detailing business with the following specifics:
Service: ${params.service}
Location: ${params.location}
${params.vehicle ? `Vehicle: ${params.vehicle}` : ''}

Instructions:
- Include location-based keywords (e.g., "ceramic coating ${params.location}")
- Include service-specific keywords
- Include long-tail keywords (e.g., "best ${params.service.toLowerCase()} near me")
- Return as comma-separated list. No intro or explanation.
  `.trim();

  const keywordsString = await generateWithReplicate(prompt);
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
Generate a compelling social media caption for a before-and-after post for a car detailing business.

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
- Return only the caption. No extra text or intro.
  `.trim();

  return await generateWithReplicate(prompt);
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
- Do not include any intro or explanation. Just return the script.
  `.trim();

  return await generateWithReplicate(prompt);
}
