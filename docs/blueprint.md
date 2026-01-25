# **App Name**: AutoMarkAI

## Core Features:

- Intelligent Content Generation: Leverage the OpenAI GPT-4 API and Google Gemini API to generate multiple caption variations for photos and videos based on service type, vehicle details, and location.  It acts as a tool for the automated generation of marketing content tailored to specific platforms (Instagram, TikTok, Facebook, Google Business) to drive engagement and optimize for SEO.
- Automated Media Processing: Automatically process before/after photos with cropping, brightness/contrast adjustments, watermark placement, and aspect ratio conversion. Upload to Firebase storage.
- AI Video/Reel Generator: Generate short, engaging video reels by pulling service photos/clips, adding transitions and text overlays, and incorporating trending audio using FFmpeg.
- Smart Scheduling System: Enable admins to approve/reject/edit generated content, schedule posts based on optimal posting times determined by audience analytics, and automatically retry failed posts.
- Intelligent Push Notification Engine: Trigger push notifications based on weather conditions (rain, snow, UV index, pollen), customer history (ceramic coating due, tint anniversary), seasonal events, and loyalty program milestones, fostering customer engagement and retention.
- Backend API Endpoints: Provide RESTful API endpoints for the Flutter app to access processed data, trigger content generation, schedule posts, and send notifications. The main purpose is for interaction between front-end and back-end of the application.
- Data Storage and Management: Utilize Firestore for storing data related to vehicles, services, customers, generated content, scheduled posts, analytics, push notifications, and the media library. The storage is automatically managed by Google Cloud.

## Style Guidelines:

- Primary color: Deep indigo (#4B0082) to convey expertise and instill a sense of confidence in automated solutions.
- Background color: Light lavender (#E6E6FA) with low saturation to create a muted background.
- Accent color: Electric violet (#8F00FF) to add flair.
- Font: 'Inter', a sans-serif font, for both headlines and body text due to its neutral and modern look.
- Use a set of minimalistic icons to visually represent content and service categories.
- Employ a clean, card-based layout with a clear visual hierarchy for generated content previews.
- Subtle loading animations and transitions to indicate background content processing and provide smooth user feedback.