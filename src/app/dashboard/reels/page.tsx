// This is the reel generation page, which uses FFmpeg for in-browser video processing.
"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Film, Sparkles, AlertCircle, Mic, Play, CheckCircle, Video, Upload, Cloud, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { firestore as galleryFirestore } from "@/firebase/config"; // Using the gallery project
import { addDoc, collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { generateCaptions as generateReplicateCaptions } from "@/ai/replicate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import Image from 'next/image';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import GoogleDrivePicker from "@/components/google-drive-picker";
import { firestore } from "@/lib/firebase";

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  file: File;
  preview: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export default function AutomatedReelGenerator() {
  // UI State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [imageForAnimation, setImageForAnimation] = useState<MediaItem | null>(null);
  const [animationPrompt, setAnimationPrompt] = useState("Make the car drive slowly forward with subtle lens flare.");
  const [audioScript, setAudioScript] = useState("Check out this incredible transformation! We gave this car our premium detailing package and the results are absolutely stunning. The difference is truly remarkable from start to finish.\nWhen this vehicle first arrived at our shop, it was in desperate need of some serious attention and care. The exterior was covered in dirt, grime, and environmental contaminants that had built up over months of neglect. The paint had lost its original luster and shine, and the wheels were caked with brake dust and road debris.\nOur expert team went to work with our comprehensive premium detailing package, which includes everything needed to restore a vehicle to showroom condition. We started with a thorough hand wash using pH-balanced solutions, followed by a deep clay bar treatment to remove embedded contaminants. Then we performed a multi-stage paint correction process to eliminate swirls, scratches, and imperfections. Finally, we applied a protective ceramic coating to ensure long-lasting shine and protection.");
  
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Initializing...");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isScheduling, startSchedulingTransition] = useTransition();

  const { toast } = useToast();
  const router = useRouter();
  const { accessToken } = useAuth();
  
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const beforeGifUrl = 'https://text.media.giphy.com/v1/media/giphy.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJwcm9kLTIwMjAtMDQtMjIiLCJzdHlsZSI6InJhZ2UiLCJ0ZXh0IjoiYmVmb3JlIiwiaWF0IjoxNzY3MTgyODcyfQ.oUXBlHPIrAXiyLZWILDF9D9cvuD4KBtEidos6-SPZN4';
  const afterGifUrl = 'https://text.media.giphy.com/v1/media/giphy.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJwcm9kLTIwMjAtMDQtMjIiLCJzdHlsZSI6ImNvb2x6b25lIiwidGV4dCI6ImFmdGVyIiwiaWF0IjoxNzY3MTgyOTc2fQ.8BKuC3Krn0xzUBNzhIWWgaiyNJRMW4xbjoMlB5Q8S9o';

  // --- FFmpeg Loading ---
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        setMessage("Loading video engine...");
        setLoadError(null);
        
        const ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => { /* console.log('FFmpeg:', message); */ });
        ffmpeg.on('progress', ({ progress: p }) => { setProgress(Math.round(p * 100)); });

        await ffmpeg.load({
            coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
        });

        ffmpegRef.current = ffmpeg;
        setFfmpegLoaded(true);
        setMessage("Ready to create reels.");
      } catch (error: any) {
        setLoadError(error.message || 'Failed to load video engine. This may be due to your browser configuration (e.g. strict cross-origin policies). Try a different browser like Chrome or Firefox.');
        setMessage("Failed to load video engine.");
      }
    };
    
    loadFFmpeg();
  }, []);

  // --- Google Drive API Helpers ---
  const findOrCreateFolder = async (name: string, parentId = 'root'): Promise<string> => {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error('Failed to search for folder.');
    const data = await response.json();
    if (data.files && data.files.length > 0) return data.files[0].id;

    // If not found, create it
    const createResponse = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId })
    });
    if (!createResponse.ok) throw new Error('Failed to create folder.');
    const folder = await createResponse.json();
    return folder.id;
  }

  const findFilesInFolder = async (folderId: string, mimeTypeFilter = 'video/'): Promise<DriveFile[]> => {
      const query = `'${folderId}' in parents and mimeType contains '${mimeTypeFilter}' and trashed=false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Failed to list files in folder ${folderId}`);
      const data = await response.json();
      return data.files || [];
  }

  const downloadFile = async (fileId: string): Promise<File> => {
      const response = await fetch(`/api/drive/download?fileId=${fileId}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error('Failed to download file from Drive.');
      const blob = await response.blob();
      return new File([blob], fileId, { type: blob.type });
  }
  
  const moveFile = (fileId: string, toFolderId: string, fromFolderId: string) => fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
  
  // --- Main Reel Generation Logic ---
  const handleAutomatedRun = async () => {
    if (!accessToken) {
        toast({ title: "Authentication Error", description: "Please log in to use this feature.", variant: "destructive" });
        return;
    }

    setIsProcessing(true);
    setMessage("Starting automated reel production...");
    setProgress(0);

    try {
        // 1. Find main and subfolders
        setMessage("Checking Google Drive structure...");
        const mainFolderId = await findOrCreateFolder("AutoMarkAI Shop Photos");
        const beforeFolderId = await findOrCreateFolder("Before", mainFolderId);
        const afterFolderId = await findOrCreateFolder("After", mainFolderId);
        const processedFolderId = await findOrCreateFolder("Processed Reels", mainFolderId);
        const imagesToAnimateFolderId = await findOrCreateFolder("Images To Animate", mainFolderId);
        const processedImagesFolderId = await findOrCreateFolder("Processed Animated Images", mainFolderId);
        
        // 2. Find an unprocessed pair of videos
        setMessage("Searching for new 'before' and 'after' videos...");
        const beforeVideos = await findFilesInFolder(beforeFolderId);
        const afterVideos = await findFilesInFolder(afterFolderId);

        let finalVideoBlob: Blob | null = null;
        let vehicleName = "AI Generated Reel";
        let processedFileId = '';
        let fromFolderId = '';
        let toFolderId = '';

        if (beforeVideos.length > 0 && afterVideos.length > 0) {
            // --- VIDEO STITCHING PATH ---
            const beforeVideo = beforeVideos[0];
            const afterVideo = afterVideos[0];
            vehicleName = beforeVideo.name.replace(/_before/i, '').split('.')[0];
            
            setMessage(`Found video pair: ${beforeVideo.name} & ${afterVideo.name}`);
            
            // 3a. Download videos
            setMessage("Downloading videos from Google Drive...");
            const beforeFile = await downloadFile(beforeVideo.id);
            const afterFile = await downloadFile(afterVideo.id);

            // 4a. Process and stitch videos
            const stitchedVideoName = await generateReelWithStitcher([
                { id: 'before', type: 'video', file: beforeFile, preview: '' },
                { id: 'after', type: 'video', file: afterFile, preview: '' }
            ]);
            if (!stitchedVideoName) throw new Error("Video stitching failed.");

            // 5a. Add Audio
            const finalVideoName = await addAudioToVideo(stitchedVideoName);
            const data = await ffmpegRef.current!.readFile(finalVideoName);
            finalVideoBlob = new Blob([data], { type: 'video/mp4' });

            // 8a. Archive processed videos
            setMessage("Archiving processed videos in Google Drive...");
            await Promise.all([
                moveFile(beforeVideo.id, processedFolderId, beforeFolderId),
                moveFile(afterVideo.id, processedFolderId, afterFolderId)
            ]);

        } else {
            // --- IMAGE ANIMATION FALLBACK ---
            setMessage("No video pairs found. Checking for images to animate...");
            const imagesToAnimate = await findFilesInFolder(imagesToAnimateFolderId, 'image/');

            if (imagesToAnimate.length > 0) {
                const imageFileToAnimate = imagesToAnimate[0];
                vehicleName = imageFileToAnimate.name.split('.')[0];

                setMessage(`Found image to animate: ${imageFileToAnimate.name}`);

                // 3b. Download image
                setMessage("Downloading image from Google Drive...");
                const imageFile = await downloadFile(imageFileToAnimate.id);

                // 4b. Animate image with Replicate
                setMessage("Generating video from image with AI...");
                const formData = new FormData();
                formData.append('image', imageFile);
                formData.append('prompt', animationPrompt);

                const response = await fetch('/api/generate-reel', { method: 'POST', body: formData });
                const result = await response.json();
                if (!result.success) throw new Error(result.error);
                
                // 5b. Download generated video and add audio
                setMessage("Downloading generated video...");
                const videoBlob = await fetch(result.videoUrl).then(res => res.blob());
                await ffmpegRef.current!.writeFile("ai_video.mp4", await fetchFile(videoBlob));

                const finalVideoName = await addAudioToVideo("ai_video.mp4");
                const data = await ffmpegRef.current!.readFile(finalVideoName);
                finalVideoBlob = new Blob([data], { type: 'video/mp4' });

                // 8b. Archive processed image
                setMessage("Archiving processed image in Google Drive...");
                await moveFile(imageFileToAnimate.id, processedImagesFolderId, imagesToAnimateFolderId);

            } else {
                toast({ title: "No New Media Found", description: "Please add 'before'/'after' videos or an image to the 'Images To Animate' folder in Google Drive.", variant: "destructive" });
                setIsProcessing(false);
                return;
            }
        }

        // 6. Schedule Post (common for both paths)
        if (finalVideoBlob) {
            await schedulePost(finalVideoBlob, vehicleName);
        } else {
            throw new Error("Final video was not created.");
        }
        
        toast({ title: "Automation Complete!", description: "Reel generated and scheduled for approval." });
        setMessage("✨ Process complete! Ready for another run.");

    } catch (error: any) {
      console.error('Automation error:', error);
      toast({ title: "Automation Failed", description: error.message, variant: "destructive" });
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }

  const handleManualGeneration = async () => {
    setIsProcessing(true);
    let finalVideoBlob: Blob | null = null;
    let vehicleName = "Manually Generated Reel";

    try {
        if (activeTab === 'stitcher') {
            if (mediaItems.length < 2) throw new Error("Please select two videos for stitching.");
            const beforeItem = mediaItems.find(i => i.id === 'before');
            if (beforeItem) {
              vehicleName = beforeItem.file.name.replace(/_before/i, '').split('.')[0];
            }

            setMessage("Processing and stitching videos...");
            const stitchedVideoName = await generateReelWithStitcher(mediaItems);
            if (!stitchedVideoName) throw new Error("Video stitching failed.");
            
            setMessage("Adding audio...");
            const finalVideoName = await addAudioToVideo(stitchedVideoName);
            const data = await ffmpegRef.current!.readFile(finalVideoName);
            finalVideoBlob = new Blob([data], { type: 'video/mp4' });

        } else if (activeTab === 'animator') {
            if (!imageForAnimation) throw new Error("Please select an image to animate.");
            vehicleName = imageForAnimation.file.name.split('.')[0];
            setMessage("Generating video from image with AI...");
            const formData = new FormData();
            formData.append('image', imageForAnimation.file);
            formData.append('prompt', animationPrompt);

            const response = await fetch('/api/generate-reel', { method: 'POST', body: formData });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            
            setMessage("Downloading generated video...");
            const videoBlob = await fetch(result.videoUrl).then(res => res.blob());
            await ffmpegRef.current!.writeFile("ai_video.mp4", await fetchFile(videoBlob));

            setMessage("Adding audio...");
            const finalVideoName = await addAudioToVideo("ai_video.mp4");
            const data = await ffmpegRef.current!.readFile(finalVideoName);
            finalVideoBlob = new Blob([data], { type: 'video/mp4' });
        }

        if (finalVideoBlob) {
            await schedulePost(finalVideoBlob, vehicleName);
            toast({ title: "Success!", description: "Your reel has been generated and sent for approval." });
        }
    } catch (error: any) {
        console.error("Manual generation error:", error);
        toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
        setMessage(`Error: ${error.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const generateReelWithStitcher = async (stitchMediaItems: any[]): Promise<string> => {
    const ffmpeg = ffmpegRef.current!;
    const safeDeleteFile = async (filename: string) => {
      try { await ffmpeg.deleteFile(filename); } catch (e) { /* ignore */ }
    };

    const processGif = async (gifUrl: string, outputName: string): Promise<string> => {
        setMessage(`Processing GIF: ${outputName}...`);
        const gifBlob = await fetch(gifUrl).then(r => r.blob());
        await ffmpeg.writeFile('temp.gif', await fetchFile(gifBlob));
        await ffmpeg.exec(['-i', 'temp.gif', '-t', '2', '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-an', '-y', outputName]);
        await safeDeleteFile('temp.gif');
        return outputName;
    };

    const processVideo = async (videoItem: any, outputName: string): Promise<string> => {
         setMessage(`Processing video: ${outputName}...`);
         await ffmpeg.writeFile(videoItem.file.name, await fetchFile(videoItem.file));
         await ffmpeg.exec(['-i', videoItem.file.name, '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30', '-c:v', 'libx264', '-preset', 'ultrafast', '-an', '-pix_fmt', 'yuv420p', '-y', outputName]);
         await safeDeleteFile(videoItem.file.name);
         return outputName;
    };
    
    const finalClips: string[] = [
        await processGif(beforeGifUrl, '0_before_gif.mp4'),
        await processVideo(stitchMediaItems[0], '1_video_before.mp4'),
        await processGif(afterGifUrl, '2_after_gif.mp4'),
        await processVideo(stitchMediaItems[1], '3_video_after.mp4')
    ];
    
    setMessage('Stitching all clips together...');
    const concatFileContent = finalClips.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', concatFileContent);

    const stitchedVideoName = 'stitched_video.mp4';
    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-y', stitchedVideoName]);
    
    for (const fileName of finalClips) await safeDeleteFile(fileName);
    await safeDeleteFile('concat.txt');
    
    return stitchedVideoName;
  };
  
  const addAudioToVideo = async (baseVideoName: string): Promise<string> => {
      const ffmpeg = ffmpegRef.current!;
      if (audioScript.trim()) {
          setMessage("Generating AI voice-over...");
          try {
              const audioResponse = await fetch('/api/generate-audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: audioScript }) });
              const audioResult = await audioResponse.json();
              if (!audioResult.success) throw new Error(audioResult.error);
              
              const audioBlob = await fetch(audioResult.audioUrl).then(r => r.blob());
              await ffmpeg.writeFile('audio.mp3', await fetchFile(audioBlob));
              
              setMessage('Adding voice-over to video...');
              const finalOutputName = 'final_output.mp4';
              await ffmpeg.exec(['-i', baseVideoName, '-i', 'audio.mp3', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', finalOutputName]);
              
              await ffmpeg.deleteFile('audio.mp3');
              // Do not delete baseVideoName here, it might be the final product if audio fails
              return finalOutputName;
          } catch (e: any) {
              toast({ title: "Audio Generation Failed", description: e.message, variant: "destructive" });
          }
      }
      return baseVideoName;
  }
  
  const schedulePost = async (videoBlob: Blob, vehicleName: string) => {
    startSchedulingTransition(async () => {
        try {
            setMessage("Uploading video to storage...");
            const uploadFormData = new FormData();
            uploadFormData.append('file', videoBlob, `reel-${Date.now()}.mp4`);
            const uploadResponse = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
            const uploadResult = await uploadResponse.json();
            if (!uploadResult.success) throw new Error(uploadResult.error);
            
            setMessage("Generating captions...");
            const captionsResult = await generateReplicateCaptions({ vehicle: vehicleName, service: "AI Generated Reel", package: "Before & After" });
            if (!captionsResult || captionsResult.length === 0) throw new Error("AI failed to generate captions.");
            
            setMessage(`Saving ${captionsResult.length} posts...`);
            for (const post of captionsResult) {
                await addDoc(collection(galleryFirestore, 'posts'), {
                    videoUrl: uploadResult.url,
                    platform: post.platform,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    vehicle: vehicleName, 
                    service: 'AI Generated Reel',
                    text: post.text,
                    hashtags: post.hashtags || [],
                });
            }
            router.push('/dashboard/schedule');
        } catch (error: any) {
            console.error("Scheduling error:", error);
            toast({ title: "Scheduling Failed", description: error.message, variant: "destructive" });
        }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, id: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (file) {
      const newItem: MediaItem = {
        id,
        type: file.type.startsWith('video') ? 'video' : 'image',
        file,
        preview: URL.createObjectURL(file),
      };
      setMediaItems(prev => {
        const otherItems = prev.filter(item => item.id !== id);
        return [...otherItems, newItem];
      });
    }
  };

  const handleDriveFileSelect = async (driveFile: DriveFile, id: 'before' | 'after') => {
    try {
        toast({title: "Downloading from Drive...", description: driveFile.name});
        const file = await downloadFile(driveFile.id);
        const newItem: MediaItem = {
            id,
            type: file.type.startsWith('video') ? 'video' : 'image',
            file,
            preview: URL.createObjectURL(file)
        };
        setMediaItems(prev => {
            const otherItems = prev.filter(item => item.id !== id);
            return [...otherItems, newItem];
        });
    } catch(e: any) {
        toast({ title: "Download Failed", description: e.message, variant: "destructive" });
    }
  }

  const handleAnimatorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newItem: MediaItem = {
        id: 'animator-image',
        type: 'image',
        file,
        preview: URL.createObjectURL(file),
      };
      setImageForAnimation(newItem);
    }
  };
  
  const handleDriveImageSelect = async (driveFile: DriveFile) => {
    if (!driveFile.mimeType.startsWith('image/')) {
        toast({ title: "Invalid File Type", description: "Please select an image file for animation.", variant: "destructive" });
        return;
    }
    try {
        toast({title: "Downloading from Drive...", description: driveFile.name});
        const file = await downloadFile(driveFile.id);
        const newItem: MediaItem = {
            id: 'animator-image',
            type: 'image',
            file,
            preview: URL.createObjectURL(file)
        };
        setImageForAnimation(newItem);
    } catch(e: any) {
        toast({ title: "Download Failed", description: e.message, variant: "destructive" });
    }
  }

  const [activeTab, setActiveTab] = useState('stitcher');
  
  const renderMediaInput = (id: 'before' | 'after', label: string) => {
    const item = mediaItems.find(mi => mi.id === id);
    return (
        <Card>
            <CardHeader>
                <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
                {item ? (
                    <div className="relative">
                        <video src={item.preview} className="w-full rounded-md" />
                        <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setMediaItems(prev => prev.filter(i => i.id !== id))}>Remove</Button>
                    </div>
                ) : (
                    <div className="w-full aspect-video rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                        <p className="text-muted-foreground">Select a video</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2">
                 <Button asChild variant="outline">
                    <label>
                        <Upload className="mr-2 h-4 w-4" /> Upload
                        <input type="file" accept="video/*" className="sr-only" onChange={(e) => handleFileChange(e, id)} />
                    </label>
                </Button>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline"><Cloud className="mr-2 h-4 w-4" /> From Drive</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[80vh]">
                       <GoogleDrivePicker onFileSelect={(file) => handleDriveFileSelect(file, id)} />
                    </DialogContent>
                </Dialog>
            </CardFooter>
        </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center bg-primary text-primary-foreground rounded-lg p-6">
        <h1 className="text-3xl font-bold tracking-tight">AI Reel Studio</h1>
        <p className="opacity-90">Generate professional reels with AI voice-overs, animations, and branding.</p>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Engine Load Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

       <Card>
        <CardHeader>
          <CardTitle>Automated Production Line</CardTitle>
          <CardDescription>Click the button to automatically find a new video pair from your Drive, generate a reel, and schedule it.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
              <Video className="h-4 w-4" />
              <AlertTitle>How it Works</AlertTitle>
              <AlertDescription>
                  The system will scan your <code className="font-mono bg-muted px-1 rounded">AutoMarkAI Shop Photos/Before</code> and <code className="font-mono bg-muted px-1 rounded">/After</code> folders in Google Drive. If videos are found, it will process them. If not, it will check the <code className="font-mono bg-muted px-1 rounded">/Images To Animate</code> folder and process an image instead.
              </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4">
           <Button
            onClick={handleAutomatedRun}
            disabled={isProcessing || !ffmpegLoaded || isScheduling || !accessToken}
            className="w-full h-14 text-lg"
          >
            {isProcessing || isScheduling ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Play className="mr-2 h-5 w-5" />
            )}
            Start Reel Production
          </Button>
        </CardFooter>
      </Card>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stitcher">Video Stitcher</TabsTrigger>
            <TabsTrigger value="animator">AI Image Animator</TabsTrigger>
        </TabsList>
        <TabsContent value="stitcher">
            <div className="grid md:grid-cols-2 gap-4 mt-4">
                {renderMediaInput('before', '1. Before Video')}
                {renderMediaInput('after', '2. After Video')}
            </div>
        </TabsContent>
        <TabsContent value="animator">
            <div className="grid md:grid-cols-2 gap-4 mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Upload Image</CardTitle>
                        <CardDescription>Select the image you want to animate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {imageForAnimation ? (
                             <div className="relative">
                                <Image src={imageForAnimation.preview} alt="Image for animation" width={500} height={500} className="w-full rounded-md" />
                                <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setImageForAnimation(null)}>Remove</Button>
                            </div>
                        ) : (
                             <div className="w-full aspect-video rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                                <p className="text-muted-foreground">Select an image</p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="grid grid-cols-2 gap-2">
                         <Button asChild variant="outline">
                            <label>
                                <Upload className="mr-2 h-4 w-4" /> Upload
                                <input type="file" accept="image/*" className="sr-only" onChange={handleAnimatorFileChange} />
                            </label>
                        </Button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline"><Cloud className="mr-2 h-4 w-4" /> From Drive</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl h-[80vh]">
                               <GoogleDrivePicker onFileSelect={handleDriveImageSelect} />
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>2. Animation Prompt</CardTitle>
                        <CardDescription>Describe the motion you want the AI to generate.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            value={animationPrompt} 
                            onChange={(e) => setAnimationPrompt(e.target.value)} 
                            className="h-36"
                            placeholder="e.g., A slow zoom in on the car's headlights..."
                        />
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
                <Mic className="w-5 h-5" />
                AI Voice-over Script
            </CardTitle>
        </CardHeader>
        <CardContent>
            <Textarea
                value={audioScript}
                onChange={(e) => setAudioScript(e.target.value)}
                placeholder="Enter the script for the AI voice-over..."
                className="h-36"
                disabled={!ffmpegLoaded || isProcessing}
            />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Generate & Schedule</CardTitle>
          <CardDescription>This will generate the final video, add audio, and send it to the schedule for approval.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col items-stretch gap-4">
           <Button
            onClick={handleManualGeneration}
            disabled={isProcessing || !ffmpegLoaded || isScheduling}
            className="w-full"
          >
            {isProcessing || isScheduling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Reel
          </Button>

          {(isProcessing || isScheduling) && (
            <div className="space-y-3 text-center">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
