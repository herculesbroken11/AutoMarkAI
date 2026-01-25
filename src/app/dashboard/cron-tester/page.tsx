
"use client";

import { useState } from "react";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Play, Loader2, AlertCircle, Bot, Bell, Send, CloudSun, Film, CloudCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type CronType = 'post-scheduled' | 'generate-content' | 'generate-notifications' | 'send-notifications' | 'sync-weather' | 'generate-from-drive';

interface CronJob {
    type: CronType;
    title: string;
    description: string;
    endpoint: string;
    icon: React.ElementType;
    method?: 'POST' | 'GET';
}

const cronJobs: CronJob[] = [
    { type: 'generate-from-drive', title: 'Drive Content Generator', description: "Processes one image from the 'detailing pics' Drive folder.", endpoint: '/api/cron/generate-from-drive', icon: CloudCog, method: 'GET' },
    { type: 'post-scheduled', title: 'Post Scheduler', description: "Finds the oldest 'scheduled' post and publishes it.", endpoint: '/api/cron/post-scheduled', icon: Send, method: 'GET' },
    { type: 'generate-content', title: 'Gallery Content Generator', description: "Finds a new gallery item and generates content.", endpoint: '/api/cron/generate-content', icon: Bot, method: 'GET' },
    { type: 'generate-notifications', title: 'AI Notification Generator', description: "Analyzes triggers and creates smart notifications.", endpoint: '/api/cron/generate-notifications', icon: Bell, method: 'GET' },
    { type: 'send-notifications', title: 'Notification Sender', description: "Sends all pending notifications via Email/SMS.", endpoint: '/api/cron/send-notifications', icon: Send, method: 'GET' },
    { type: 'sync-weather', title: 'Weather Sync', description: "Syncs weather data for bookings without it.", endpoint: '/api/cron/sync-weather', icon: CloudSun, method: 'GET' },
];

const CronJobCard = ({ job, onTest, isTesting }: { job: CronJob, onTest: (type: CronType, result: { success: boolean, message: string }) => void, isTesting: boolean }) => {
    const { type, title, description, icon: Icon, method = 'GET' } = job;
    const [logs, setLogs] = useState<string[]>(["Logs will appear here."]);

    const handleTest = async () => {
        setLogs([`Starting ${title} test...`]);
        const secret = process.env.NEXT_PUBLIC_CRON_SECRET;
        try {
            const response = await fetch(job.endpoint, {
                method: method,
                headers: { 'Authorization': `Bearer ${secret}` }
            });
            const result = await response.json();
            
            if (result.logs) {
                setLogs(prev => [prev[0], ...result.logs]);
            }
            if (!response.ok) {
                throw new Error(result.error || `Unknown error during ${title} cron test.`);
            }
            const successMessage = result.message || `Successfully ran ${title} job.`;
            setLogs(prev => [...prev, `✅ ${successMessage}`]);
            return { success: true, message: successMessage };
        } catch (error: any) {
            setLogs(prev => [...prev, `❌ ERROR: ${error.message}`]);
            return { success: false, message: error.message };
        }
    };

    const runTest = () => {
        onTest(type, { success: false, message: 'Starting...' }); // Notify parent that test started
        handleTest().then(result => {
             onTest(type, result); // Notify parent of completion
        });
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <Button className="w-full" onClick={runTest} disabled={isTesting}>
                    {isTesting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>
                    ) : (
                        <><Play className="mr-2 h-4 w-4" /> Run Test</>
                    )}
                </Button>
                <Card className="h-full min-h-[250px] flex flex-col bg-muted/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4" /> Log
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden text-xs">
                        <ScrollArea className="h-full max-h-[300px]">
                            <div className="font-mono space-y-2">
                                {logs.map((log, index) => (
                                    <p key={index} className="whitespace-pre-wrap">
                                        <span className="text-muted-foreground mr-2">{index}</span>
                                        {log}
                                    </p>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    );
};

export default function CronTesterPage() {
    const [testingCron, setTestingCron] = useState<CronType | null>(null);
    const { toast } = useToast();
    
    const handleTest = (type: CronType, result: { success: boolean, message: string }) => {
        if (result.message === 'Starting...') {
            setTestingCron(type);
        } else {
            toast({
                title: `Test ${result.success ? 'Complete' : 'Failed'}: ${cronJobs.find(j => j.type === type)?.title}`,
                description: result.message,
                variant: result.success ? "default" : "destructive",
            });
            setTestingCron(null);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Cron Job Tester"
                description="Manually trigger automated jobs to ensure they're working correctly."
            />

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>What are Cron Jobs?</AlertTitle>
                <AlertDescription>
                    Cron jobs are scheduled tasks that run automatically. You must configure your hosting provider (like Vercel) to send requests to the API endpoints below at your desired schedule (e.g., once daily). This page lets you run them on demand for testing.
                </AlertDescription>
            </Alert>
            
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                {cronJobs.map(job => (
                    <CronJobCard 
                        key={job.type} 
                        job={job}
                        onTest={handleTest}
                        isTesting={testingCron === job.type}
                    />
                ))}
            </div>
        </div>
    );
}
