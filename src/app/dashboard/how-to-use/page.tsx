

import PageHeader from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Film, Megaphone, Bot, Server, Workflow, FileSearch, Sparkles, PencilRuler, Video, Clock, Image as ImageIcon, CloudCog, Trash2, FolderPlus, Edit, Folder, File, Download, Package, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata = {
    title: "Porters AutoMarkAI - API Guide",
};

const CodeBlock = ({ code }: { code: string }) => (
    <pre className="bg-gray-900 text-white p-4 rounded-md overflow-x-auto text-xs">
        <code>{code}</code>
    </pre>
);

const RequestTable = ({ headers, rows }: { headers: string[], rows: (string | React.ReactNode)[][] }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-muted">
                <tr>
                    {headers.map(header => (
                         <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="bg-background divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                             <td key={cellIndex} className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                                {cellIndex === 0 ? <code className="font-mono bg-muted px-1 py-0.5 rounded">{cell}</code> : cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
)

const features = [
    {
        icon: Megaphone,
        title: "Generate Captions from Gallery",
        endpoint: "/api/content/generate-from-gallery",
        description: "Generates multiple social media posts based on a 'before & after' gallery item and saves them to Firestore for approval.",
        request: {
            method: "POST",
            info: "Accepts `application/json`. This endpoint orchestrates image stitching and caption generation.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["galleryItem.id", "string", "✅ Yes", "ID of the item in the 'gallery' Firestore collection."],
                ["galleryItem.title", "string", "✅ Yes", "Title of the item (e.g., vehicle name)."],
                ["galleryItem.category", "string", "✅ Yes", "Service category (e.g., 'Ceramic Coating')."],
                ["galleryItem.description", "string", "⚪ Optional", "Description of the package or service."],
                ["galleryItem.stitchedImageUrl", "string", "✅ Yes", "Public URL of the final stitched before/after image."],
            ],
        },
        responses: {
            success: `{
  "message": "Successfully generated captions and saved for approval.",
  "captions": [
    { "platform": "instagram", "text": "...", "hashtags": [...] },
    { "platform": "facebook", "text": "...", "hashtags": [...] }
  ],
  "error": false
}`,
            error: `{
  "message": "Image Processing Failed: ...",
  "error": true
}`
        }
    },
    {
        icon: Sparkles,
        title: "Generate Single Before/After Caption",
        endpoint: "/api/content/generate-before-after-caption",
        description: "Generates a single, compelling caption focusing on a before/after transformation.",
         request: {
            method: "POST",
            info: "This API endpoint accepts `application/x-www-form-urlencoded` or `application/json`.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["service", "text", "✅ Yes", "Type of detailing service performed"],
                ["vehicle", "text", "✅ Yes", "Make and model of the vehicle"],
                ["beforeDescription", "text", "✅ Yes", "Brief description of the 'before' state"],
                ["afterDescription", "text", "✅ Yes", "Brief description of the 'after' state"],
            ],
        },
        responses: {
            success: `{
  "message": "Successfully generated before/after caption.",
  "caption": "You won't believe it's the same car! ...",
  "error": false
}`,
            error: `{
  "message": "Invalid request. 'service', 'vehicle', 'beforeDescription', and 'afterDescription' are required.",
  "caption": null,
  "error": true
}`
        }
    },
    {
        icon: ImageIcon,
        title: "Stitch Before/After Image",
        endpoint: "/api/image/overlay-text",
        description: "Stitches a 'before' and 'after' image side-by-side into a single image with a graphical overlay, then saves it to storage.",
        request: {
            method: "POST",
            info: "Accepts `application/json`. Fetches images from public URLs.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["beforeUrl", "string", "✅ Yes", "Public URL for the 'before' image."],
                ["afterUrl", "string", "✅ Yes", "Public URL for the 'after' image."],
            ],
        },
        responses: {
            success: `{
  "success": true,
  "message": "Images stitched and labeled successfully.",
  "stitchedImageUrl": "https://firebasestorage.googleapis.com/..."
}`,
            error: `{
  "error": true,
  "message": "Failed to fetch beforeUrl: ..."
}`
        }
    },
    {
        icon: PencilRuler,
        title: "Generate Reel/Video Script",
        endpoint: "/api/content/generate-reel-script",
        description: "Generates a script outline for a short-form video (TikTok/Instagram Reel).",
         request: {
            method: "POST",
            info: "This API endpoint accepts `application/x-www-form-urlencoded` or `application/json`.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["service", "text", "✅ Yes", "The main service to highlight"],
                ["vehicle", "text", "✅ Yes", "The vehicle featured in the reel"],
                ["duration", "number", "✅ Yes", "Target duration of the reel in seconds"],
            ],
        },
        responses: {
            success: `{
  "message": "Successfully generated reel script.",
  "script": "0-2s: Swirl marks ruining this Porsche's shine? ...",
  "error": false
}`,
            error: `{
  "message": "Invalid request. 'duration' is required.",
  "script": null,
  "error": true
}`
        }
    },
    {
        icon: FileSearch,
        title: "Generate SEO Keywords",
        endpoint: "/api/content/generate-keywords",
        description: "Generates 10 SEO-optimized keywords for a specific service and location.",
         request: {
            method: "POST",
            info: "This API endpoint accepts `application/x-www-form-urlencoded` or `application/json`.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["service", "text", "✅ Yes", "The service to generate keywords for"],
                ["location", "text", "✅ Yes", "The target city or area"],
                ["vehicle", "text", "⚪ Optional", "Specific vehicle type to target"],
            ],
        },
        responses: {
            success: `{
  "message": "Successfully generated SEO keywords.",
  "keywords": [ "window tinting Austin TX", ... ],
  "error": false
}`,
            error: `{
  "message": "Invalid request. 'service' and 'location' are required.",
  "keywords": null,
  "error": true
}`
        }
    },
    {
        icon: Film,
        title: "Server-Side Reel Rendering (Remotion)",
        endpoint: "/api/render-reel",
        description: "Uses Remotion to programmatically render a video on the server. Ideal for complex compositions.",
        request: {
            method: "POST",
            info: "This endpoint accepts `application/json` and uses the Remotion rendering engine on the backend.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["beforeVideoUrl", "string", "✅ Yes", "Public URL of the 'before' video clip"],
                ["afterVideoUrl", "string", "✅ Yes", "Public URL of the 'after' video clip"],
                ["productName", "string", "⚪ Optional", "Name of the product used"],
                ["serviceDescription", "string", "⚪ Optional", "Short description of the service"],
            ],
        },
        responses: {
            success: `{
  "success": true,
  "videoUrl": "https://example.com/rendered-reel.mp4",
  "message": "Reel successfully rendered."
}`,
            error: `{
  "success": false,
  "error": "Both before and after videos are required.",
  "videoUrl": null
}`
        }
    },
    {
        icon: Video,
        title: "AI Image Animation (Replicate)",
        endpoint: "/api/generate-reel",
        description: "Uses the Replicate API to animate a still image using AI (Stable Video Diffusion).",
        request: {
            method: "POST",
            info: "This endpoint accepts `multipart/form-data` and is designed for animating a single image.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["image", "file", "✅ Yes", "The source image to animate"],
                ["prompt", "text", "✅ Yes", "A text prompt describing the desired motion"],
            ],
        },
        responses: {
            success: `{
  "success": true,
  "videoUrl": "https://replicate.delivery/pbxt/...",
  "message": "Video generated successfully with Stable Video Diffusion!"
}`,
            error: `{
  "success": false, 
  "error": "Insufficient Replicate credits." 
}`
        }
    },
];

const driveFeatures = [
    {
        icon: Folder,
        title: "List Files & Folders",
        endpoint: "/api/drive/files",
        description: "Retrieves a list of files and folders from a specified Google Drive folder, including breadcrumbs for navigation.",
        request: {
            method: "GET",
            info: "Requires a valid Google OAuth access token with Drive scope in the Authorization header.",
            headers: ["Query Param", "Type", "Required", "Description"],
            rows: [
                ["folderId", "string", "⚪ Optional", "The ID of the folder to list. Defaults to 'root'."],
            ],
        },
        responses: {
            success: `{
  "files": [ { "id": "...", "name": "...", "mimeType": "..." } ],
  "breadcrumbs": [ { "id": "root", "name": "My Drive" } ]
}`,
            error: `{
  "error": "Failed to fetch files from Google Drive."
}`
        }
    },
    {
        icon: FolderPlus,
        title: "Create Folder",
        endpoint: "/api/drive/create-folder",
        description: "Creates a new folder in Google Drive.",
        request: {
            method: "POST",
            info: "Accepts `application/json` and requires a valid Google OAuth access token.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["name", "string", "✅ Yes", "The name of the new folder."],
                ["parentId", "string", "⚪ Optional", "The ID of the parent folder. Defaults to 'root'."],
            ],
        },
        responses: {
            success: `{
  "id": "1a2b3c...",
  "name": "New Folder",
  "mimeType": "application/vnd.google-apps.folder"
}`,
            error: `{
  "error": "Folder name is required"
}`
        }
    },
    {
        icon: Edit,
        title: "Rename File/Folder",
        endpoint: "/api/drive/rename",
        description: "Renames a file or folder in Google Drive.",
        request: {
            method: "POST",
            info: "Accepts `application/json` and requires a valid Google OAuth access token.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["fileId", "string", "✅ Yes", "The ID of the file or folder to rename."],
                ["newName", "string", "✅ Yes", "The new name for the item."],
            ],
        },
        responses: {
            success: `{
  "id": "1a2b3c...",
  "name": "My Renamed File.jpg",
  "mimeType": "image/jpeg"
}`,
            error: `{
  "error": "File ID and new name are required"
}`
        }
    },
    {
        icon: Trash2,
        title: "Delete File/Folder",
        endpoint: "/api/drive/delete",
        description: "Permanently deletes a file or folder from Google Drive.",
        request: {
            method: "POST",
            info: "Accepts `application/json` and requires a valid Google OAuth access token.",
            headers: ["Field", "Type", "Required", "Description"],
            rows: [
                ["fileId", "string", "✅ Yes", "The ID of the file or folder to delete."],
            ],
        },
        responses: {
            success: `{
  "success": true
}`,
            error: `{
  "error": "File ID is required"
}`
        }
    },
    {
        icon: Download,
        title: "Download File",
        endpoint: "/api/drive/download",
        description: "Downloads a file from Google Drive by streaming its content.",
        request: {
            method: "GET",
            info: "Requires a valid Google OAuth access token.",
            headers: ["Query Param", "Type", "Required", "Description"],
            rows: [
                ["fileId", "string", "✅ Yes", "The ID of the file to download."],
            ],
        },
        responses: {
            success: `// Returns the raw file content stream
// (e.g., image/jpeg, video/mp4)`,
            error: `{
  "error": "Failed to download file from Google Drive."
}`
        }
    },
];

const cronJobs = [
    {
        icon: Clock,
        title: "Post Scheduled Content",
        endpoint: "/api/cron/post-scheduled",
        description: "This job runs on a schedule (e.g., daily). It finds the oldest post with a 'scheduled' status, publishes it to the appropriate social media platform using the `postNowAction`, and updates its status to 'posted' or 'failed' in Firestore.",
    },
    {
        icon: Bot,
        title: "Generate Content from Gallery",
        endpoint: "/api/cron/generate-content",
        description: "This job runs on a schedule, finds one unprocessed 'before/after' item from the gallery, stitches the images, generates captions using Replicate, saves the new posts to Firestore with a 'pending' status, and marks the gallery item as processed.",
    },
    {
        icon: Bell,
        title: "Generate Smart Notifications",
        endpoint: "/api/cron/generate-notifications",
        description: "This scheduled job iterates through all customer bookings, checks for triggers (e.g., weather, time since last service, ceramic coating maintenance), generates a personalized notification message using AI for any met triggers, and saves it to the 'notifications' collection in Firestore.",
    },
     {
        icon: Bell,
        title: "Send Pending Notifications",
        endpoint: "/api/cron/send-notifications",
        description: "This job runs frequently (e.g., every 5 minutes). It finds all notifications with a 'pending' status, sends them via the configured channels (Email/SMTP and SMS/Twilio), and updates their status to 'sent' or 'failed'.",
    },
];

const backendArchitecture = [
    {
        icon: Server,
        title: "Next.js API Routes & Server Actions",
        description: "Backend logic is handled via a mix of traditional API routes (for external services and cron jobs) and secure, server-side Server Actions that can be called directly from React components. This simplifies data mutations and integrations.",
    },
    {
        icon: Bot,
        title: "Multi-Provider AI Integration",
        description: "The application leverages multiple AI services for different tasks: Replicate (with Llama 3) for text and caption generation, HeyGen for text-to-video avatars, and Remotion for programmatic video rendering.",
    },
     {
        icon: Workflow,
        title: "Firebase Integration",
        description: "The app uses multiple Firebase projects. The primary project ('automarkai') is for auth and initial data, a second ('crownscope-73c1e') is dedicated to Firebase Storage to isolate media assets, and a third ('porteradmin-55856') is used as the primary database for all operational data (posts, bookings, settings, etc.).",
    },
     {
        icon: CloudCog,
        title: "Google Drive API",
        description: "Securely connects to the user's Google Drive via OAuth 2.0 to browse, create, rename, delete, and download files. All interactions are proxied through Next.js API routes that handle the token authorization.",
    },
];

export default function HowToUsePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Porters AutoMarkAI - API & Developer Guide"
        description="Technical specifications for testing and integration."
      />
      
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                    <Package className="h-8 w-8 text-primary" />
                    What is Porters AutoMarkAI?
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">
                    Porters AutoMarkAI is a comprehensive marketing automation and business management dashboard designed specifically for car detailing professionals. It streamlines content creation, scheduling, customer engagement, and analytics into a single, powerful platform.
                </p>
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-primary" /> AI Content Generation</h4>
                        <p className="text-sm text-muted-foreground">Automatically create engaging social media captions, hashtags, and video scripts from 'before & after' photos of your work.</p>
                    </div>
                     <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-1"><Film className="h-4 w-4 text-primary" /> Automated Reel Creation</h4>
                        <p className="text-sm text-muted-foreground">Stitch video clips, add AI voice-overs, and generate ready-to-post reels for Instagram and TikTok directly in your browser.</p>
                    </div>
                     <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-1"><CalendarClock className="h-4 w-4 text-primary" /> Smart Scheduling & Posting</h4>
                        <p className="text-sm text-muted-foreground">Manage a full content pipeline. Approve AI-generated posts and let the system automatically publish them at optimal times.</p>
                    </div>
                     <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-1"><Bell className="h-4 w-4 text-primary" /> Intelligent CRM Notifications</h4>
                        <p className="text-sm text-muted-foreground">Use weather data and customer history to automatically send smart reminders for service, maintenance, and promotions via email or SMS.</p>
                    </div>
                     <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-1"><CloudCog className="h-4 w-4 text-primary" /> Cloud & Drive Integration</h4>
                        <p className="text-sm text-muted-foreground">Connects directly to your Google Drive to browse and use your existing photos and videos, keeping all your media assets in one place.</p>
                    </div>
                     <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-1"><Server className="h-4 w-4 text-primary" /> Extensible API</h4>
                        <p className="text-sm text-muted-foreground">Provides a robust set of API endpoints for all core features, allowing for custom integrations and third-party tools.</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                    <Workflow className="h-8 w-8 text-primary" />
                    Backend Architecture
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">
                    The backend is a modern system built on Next.js, designed to handle server-side logic and AI interactions seamlessly.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                    {backendArchitecture.map((component) => (
                        <Card key={component.title} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <component.icon className="h-6 w-6" />
                                    {component.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">{component.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
            <CardTitle>Cron Jobs (Automated Tasks)</CardTitle>
            <CardDescription>These endpoints are designed to be called by a scheduling service (like Vercel Cron Jobs or GitHub Actions) to perform automated tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {cronJobs.map(job => (
                    <div key={job.title} className="p-4 border rounded-lg">
                        <h4 className="font-semibold flex items-center gap-2"><job.icon className="h-5 w-5 text-primary" />{job.title}</h4>
                        <code className="text-sm font-mono bg-muted px-2 py-1 rounded my-2 inline-block">{job.endpoint}</code>
                        <p className="text-sm text-muted-foreground">{job.description}</p>
                    </div>
                ))}
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI & Content API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                {features.map((feature, index) => (
                    <AccordionItem value={`item-${index}`} key={index}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-3 text-left">
                                <feature.icon className="h-6 w-6 text-primary flex-shrink-0" />
                                <span className="font-semibold text-lg">{feature.title}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-12 space-y-6">
                             <p className="text-muted-foreground">{feature.description}</p>
                            
                            <Tabs defaultValue="request">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="request">Request</TabsTrigger>
                                    <TabsTrigger value="response">Response</TabsTrigger>
                                </TabsList>
                                <TabsContent value="request" className="space-y-4">
                                     <div>
                                        <h4 className="font-semibold mb-2">Endpoint:</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{feature.request.method}</Badge>
                                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{feature.endpoint}</code>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Testing Info:</h4>
                                        <p className="text-sm text-muted-foreground">{feature.request.info}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Request Body ({feature.request.method === 'POST' && feature.request.rows.some(r => r[1] === 'file') ? <code className="font-mono bg-muted text-sm px-1 py-0.5 rounded">form-data</code> : <code className="font-mono bg-muted text-sm px-1 py-0.5 rounded">application/json</code>}):</h4>
                                        <RequestTable headers={feature.request.headers} rows={feature.request.rows} />
                                    </div>
                                </TabsContent>
                                <TabsContent value="response" className="space-y-4">
                                     <div>
                                        <h4 className="font-semibold mb-2 text-green-600">Example Success Response (200 OK)</h4>
                                        <CodeBlock code={feature.responses.success} />
                                    </div>
                                      <div>
                                        <h4 className="font-semibold mb-2 text-red-600">Example Error Response (400/500)</h4>
                                        <CodeBlock code={feature.responses.error} />
                                    </div>
                                </TabsContent>
                            </Tabs>

                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle>Google Drive API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full">
                {driveFeatures.map((feature, index) => (
                    <AccordionItem value={`drive-item-${index}`} key={index}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-3 text-left">
                                <feature.icon className="h-6 w-6 text-primary flex-shrink-0" />
                                <span className="font-semibold text-lg">{feature.title}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-12 space-y-6">
                             <p className="text-muted-foreground">{feature.description}</p>
                            
                            <Tabs defaultValue="request">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="request">Request</TabsTrigger>
                                    <TabsTrigger value="response">Response</TabsTrigger>
                                </TabsList>
                                <TabsContent value="request" className="space-y-4">
                                     <div>
                                        <h4 className="font-semibold mb-2">Endpoint:</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{feature.request.method}</Badge>
                                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{feature.endpoint}</code>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Auth & Info:</h4>
                                        <p className="text-sm text-muted-foreground">{feature.request.info}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Parameters:</h4>
                                        <RequestTable headers={feature.request.headers} rows={feature.request.rows} />
                                    </div>
                                </TabsContent>
                                <TabsContent value="response" className="space-y-4">
                                     <div>
                                        <h4 className="font-semibold mb-2 text-green-600">Example Success Response (200/201 OK)</h4>
                                        <CodeBlock code={feature.responses.success} />
                                    </div>
                                      <div>
                                        <h4 className="font-semibold mb-2 text-red-600">Example Error Response (400/500)</h4>
                                        <CodeBlock code={feature.responses.error} />
                                    </div>
                                </TabsContent>
                            </Tabs>

                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
