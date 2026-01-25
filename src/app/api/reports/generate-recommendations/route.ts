import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithReplicate } from '@/ai/replicate'; // Using a simplified replicate helper

const schema = z.object({
  totalRevenue: z.number(),
  totalServices: z.number(),
  topServices: z.array(z.object({
    name: z.string(),
    count: z.number(),
  })),
  recentBookingsCount: z.number(),
});

export async function POST(request: Request) {
  let data;
  try {
    data = await request.json();
  } catch (error) {
    return NextResponse.json({
      message: 'Failed to parse request body.',
      recommendations: null,
      error: true,
    }, { status: 400 });
  }

  const validated = schema.safeParse(data);

  if (!validated.success) {
    const errorMessages = Object.values(validated.error.flatten().fieldErrors).flat().join(' ');
    return NextResponse.json({
      message: `Invalid request. ${errorMessages}`,
      recommendations: null,
      error: true,
    }, { status: 400 });
  }

  try {
    const { totalRevenue, totalServices, topServices, recentBookingsCount } = validated.data;
    
    const topServiceNames = topServices.map(s => `${s.name} (${s.count} bookings)`).join(', ') || 'none';

    const prompt = `
You are a business consultant for a car detailing company. Based on the following data from the last 30 days, provide 3-4 actionable recommendations for the next month.

**Last 30-Day Analytics:**
- Total Revenue: $${totalRevenue.toFixed(2)}
- Total Vehicles Serviced: ${totalServices}
- Recent Bookings: ${recentBookingsCount}
- Top Services: ${topServiceNames}

**Instructions:**
- Keep recommendations concise and easy to understand.
- Focus on marketing, operations, and customer engagement.
- If revenue is high, suggest how to build on that momentum.
- If a specific service is popular, suggest a promotion for it.
- If activity seems low, suggest ways to increase bookings.
- Format the output as a simple, unformatted text string with each recommendation on a new line, prefixed with a dash.
- Do not add any introductory or concluding text.

Example format:
- Since 'Premium Full Detail' is your most popular service, consider running a "Summer Shine" promotion for it next month with a 10% discount.
- Engage past customers by sending a follow-up email campaign to clients who haven't visited in over 60 days.
- Feature more before/after photos of your top services on social media to attract new clients.
    `.trim();

    const result = await generateWithReplicate(prompt);
    
    // Split the raw string into an array of recommendations
    const recommendationsArray = result.split('- ').filter(rec => rec.trim() !== '');

    return NextResponse.json({
      message: 'Successfully generated recommendations.',
      recommendations: recommendationsArray,
      error: false,
    });
  } catch (e: any) {
    console.error('[API_ERROR] /api/reports/generate-recommendations:', e);
    return NextResponse.json({
      message: e.message || 'An unexpected error occurred while generating recommendations.',
      recommendations: null,
      error: true,
    }, { status: 500 });
  }
}

// Simplified replicate helper to avoid re-writing the whole file.
// In a real scenario, this would be a shared utility.
async function generateWithReplicate(prompt: string): Promise<string> {
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY,
    });

    const output = await replicate.run(
        "meta/meta-llama-3-70b-instruct",
        {
          input: {
            prompt: prompt,
            temperature: 0.75,
            top_p: 1,
            max_tokens: 512, // More tokens for recommendations
          }
        }
      ) as string[];
      
      return output.join("");
}
