"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudCog, Play, Loader2, FileCheck, FolderSearch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SyncEnginePage() {
    const { accessToken } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [logs, setLogs] = useState<string[]>(["Sync engine logs will appear here."]);
    const [stats, setStats] = useState({ fileCount: 0, syncedCount: 0 });
    const { toast } = useToast();

    const handleSync = async () => {
        if (!accessToken) {
            toast({
                title: "Authentication Error",
                description: "Cannot sync without a valid session.",
                variant: "destructive",
            });
            return;
        }

        setIsSyncing(true);
        setLogs(["Starting sync..."]);
        setStats({ fileCount: 0, syncedCount: 0 });

        try {
            const response = await fetch('/api/drive/sync', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            
            if (!response.body) {
                throw new Error("The response body is empty.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                lines.forEach(line => {
                    try {
                        const data = JSON.parse(line);

                        if (data.log) {
                            setLogs(prev => [...prev, data.log]);
                        }
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        if (data.status === 'completed') {
                            setStats({ fileCount: data.fileCount, syncedCount: data.syncedCount });
                            toast({
                                title: "Sync Complete",
                                description: `Found ${data.fileCount} files, synced ${data.syncedCount}.`,
                            });
                        }
                    } catch (e) {
                        console.warn("Could not parse log line:", line);
                    }
                });
            }

        } catch (error: any) {
            console.error("Sync failed:", error);
            toast({
                title: "Sync Failed",
                description: error.message,
                variant: "destructive",
            });
            setLogs(prev => [...prev, `ERROR: ${error.message}`]);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Google Drive Sync Engine"
                description="Keep your local assets perfectly in sync with your Drive folders."
            />

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Control Panel */}
                <div className="lg:col-span-1 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sync Control</CardTitle>
                            <CardDescription>Start the process to sync files from Google Drive.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                The engine will look for the <strong>AutoMarkAI Shop Photos</strong> folder in your Google Drive and sync its contents.
                            </p>
                            <Button className="w-full" onClick={handleSync} disabled={isSyncing}>
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Syncing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-4 w-4" />
                                        Start Manual Sync
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sync Status</CardTitle>
                            <CardDescription>A summary of the latest sync operation.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                                <FolderSearch className="h-8 w-8 text-primary mb-2" />
                                <p className="text-2xl font-bold">{stats.fileCount}</p>
                                <p className="text-sm text-muted-foreground">Files Found</p>
                            </div>
                             <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg">
                                <FileCheck className="h-8 w-8 text-green-500 mb-2" />
                                <p className="text-2xl font-bold">{stats.syncedCount}</p>
                                <p className="text-sm text-muted-foreground">Files Synced</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Log Viewer */}
                <div className="lg:col-span-2">
                    <Card className="h-full min-h-[400px] flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CloudCog />
                                Real-time Sync Log
                            </CardTitle>
                            <CardDescription>Monitor the sync engine's activity as it happens.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full max-h-[500px] bg-muted rounded-lg p-4">
                                <div className="font-mono text-xs space-y-2">
                                    {logs.map((log, index) => (
                                        <p key={index} className="whitespace-pre-wrap animate-in fade-in">
                                            <span className="text-muted-foreground mr-2">{index + 1}</span>
                                            {log}
                                        </p>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
