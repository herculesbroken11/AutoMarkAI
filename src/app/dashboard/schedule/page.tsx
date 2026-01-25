

"use client";

import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Check, Edit, Film, ThumbsUp, X, Instagram, Facebook, Bot, Loader2, CalendarClock, Send, History, Undo2, Clock, Settings, AlertCircle, Trash2, Save, Youtube, Play, Sheet } from "lucide-react";
import { collection, doc, updateDoc, deleteDoc, where, query, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { useCollection, useDocumentData } from 'react-firebase-hooks/firestore';
import { galleryFirestore } from "@/firebase/config";
import { useMemo, useState, useTransition, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";


// A helper component to render platform-specific icons
export const PlatformIcon = ({ platform, className }: { platform: string, className?: string }) => {
    const props = { className: className || "h-4 w-4" };
    switch (platform.toLowerCase()) {
      case 'instagram': return <Instagram {...props} />;
      case 'facebook': return <Facebook {...props} />;
      case 'youtube': return <Youtube {...props} />;
      case 'tiktok': return <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.73-1.61.55-1 .57-2.28.06-3.33-.01-2.92-.01-5.85.02-8.77z"></path></svg>;
      default: return <Bot {...props} />;
    }
};

export const platformDisplay: { [key: string]: { name: string, className: string } } = {
  instagram: { name: "Instagram", className: "bg-pink-500 hover:bg-pink-500" },
  facebook: { name: "Facebook", className: "bg-blue-600 hover:bg-blue-600" },
  youtube: { name: "YouTube", className: "bg-red-600 hover:bg-red-600" },
  tiktok: { name: "TikTok", className: "bg-black hover:bg-black text-white" },
};

const GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwKgz4a_26jpjBv1WQsYhS5rD7G-963PpkiPujVDw6biCBJgtbG9TO_9yG9MgP5ztiOXg/exec';

export async function postToGoogleSheets(posts: any[]) {
  if (posts.length === 0) return { success: true };
  try {
    const requests = posts.map(post => {
      const platformName = platformDisplay[post.platform.toLowerCase()]?.name || post.platform;
      
      const rowData = {
        topic: post.vehicle || '',
        status: 'finished',
        video: post.videoUrl || (post.imageUrls && post.imageUrls[0]) || post.stitchedImageUrl || '',
        posted: false,
        social: platformName,
        text: post.text || '',
      };

      return fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rowData)
      });
    });

    await Promise.all(requests);

    console.log('Data sent to Google Sheets for', posts.length, 'posts');
    return { success: true };
  } catch (error) {
    console.error('Error posting to Google Sheets:', error);
    throw error;
  }
}

const EditPostDialog = ({ post, onSave, isSaving, onCancel }: { post: any, onSave: (id: string, newText: string, newHashtags: string[]) => void, isSaving: boolean, onCancel: () => void }) => {
    const [text, setText] = useState(post.text);
    const [hashtags, setHashtags] = useState((post.hashtags || []).join(' '));
    const mediaUrls = [
      ...(Array.isArray(post.imageUrls) ? post.imageUrls : []),
      post.videoUrl,
      post.stitchedImageUrl
    ].filter(url => typeof url === 'string' && url);


    const handleSave = () => {
        onSave(post.id, text, hashtags.split(' ').filter(h => h.startsWith('#')));
    }

    return (
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Edit Post Content</DialogTitle>
                <DialogDescription>
                    Make changes to the caption and hashtags before approving.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] p-1">
              <div className="grid md:grid-cols-2 gap-6 py-4 pr-4">
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <Label htmlFor="editText">Caption Text</Label>
                          <Textarea
                              id="editText"
                              value={text}
                              onChange={(e) => setText(e.target.value)}
                              className="h-48"
                          />
                      </div>
                       <div className="space-y-2">
                          <Label htmlFor="editHashtags">Hashtags (space-separated)</Label>
                          <Textarea
                              id="editHashtags"
                              value={hashtags}
                              onChange={(e) => setHashtags(e.target.value)}
                              className="h-24"
                          />
                      </div>
                  </div>
                  <div className="flex items-center justify-center bg-muted rounded-lg overflow-hidden">
                      {mediaUrls && mediaUrls.length > 0 ? (
                          <Carousel className="w-full max-w-xs">
                            <CarouselContent>
                              {mediaUrls.map((url: string, index: number) => (
                                <CarouselItem key={index}>
                                  {post.videoUrl ? (
                                      <video src={url} controls className="w-full aspect-square" />
                                  ) : (
                                      <Image src={url} width={500} height={500} className="w-full h-auto object-cover aspect-square" alt={`Post image ${index + 1}`} />
                                  )}
                                </CarouselItem>
                              ))}
                            </CarouselContent>
                            <CarouselPrevious />
                            <CarouselNext />
                          </Carousel>
                      ) : (
                          <div className="text-muted-foreground">No Media</div>
                      )}
                  </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

const CaptionListItem = ({ post, onApprove, onReject, onEdit, isPending }: { post: any, onApprove: (id: string) => void, onReject: (id: string) => void, onEdit: () => void, isPending: boolean }) => {
    const platformKey = post.platform.toLowerCase();
    const platformInfo = platformDisplay[platformKey] || { name: post.platform, className: 'bg-gray-500' };

    return (
        <div className="flex items-start gap-4 p-3 hover:bg-muted/50 rounded-lg">
            <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-white ${platformInfo.className}`}>
                <PlatformIcon platform={platformKey} className="h-5 w-5" />
            </div>
            <div className="flex-grow">
                <p className="font-semibold text-sm">{platformInfo.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{post.text} {post.hashtags?.join(' ')}</p>
            </div>
            <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onApprove(post.id)} disabled={isPending}>
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                </Button>
                 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} disabled={isPending}>
                    <Edit className="h-4 w-4" />
                </Button>
                 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onReject(post.id)} disabled={isPending}>
                    <X className="h-4 w-4 text-red-500" />
                </Button>
            </div>
        </div>
    );
};


const GroupedApprovalCard = ({ posts, onApprove, onReject, onEdit, onApproveAll, isPending }: { posts: any[], onApprove: (id: string) => void, onReject: (id: string) => void, onEdit: (post: any) => void, onApproveAll: (posts: any[]) => void, isPending: boolean }) => {
    if (!posts || posts.length === 0) {
        return null;
    }
    const firstPost = posts[0];
    const isVideo = !!firstPost.videoUrl;
    const createdAt = firstPost.createdAt ? new Date(firstPost.createdAt) : null;
    
    // Consolidate all media URLs from the post object and filter out any invalid ones.
    const mediaUrls = [
      firstPost.videoUrl,
      firstPost.stitchedImageUrl,
      ...(Array.isArray(firstPost.imageUrls) ? firstPost.imageUrls : []),
    ].filter(url => typeof url === 'string' && url.length > 0);
    
    return (
        <Card className="flex flex-col overflow-hidden">
             <CardHeader className="flex-row items-center justify-between p-4">
                <div>
                    <CardTitle className="text-lg">{firstPost.vehicle}</CardTitle>
                    <CardDescription>
                        {firstPost.service} &bull; {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Just now'}
                    </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => onApproveAll(posts)} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Approve All ({posts.length})
                </Button>
             </CardHeader>
            <CardContent className="p-0 grid md:grid-cols-2 gap-0">
                <div className="p-4 flex items-center justify-center bg-black">
                    {mediaUrls.length > 0 ? (
                        <Carousel className="w-full max-w-sm">
                            <CarouselContent>
                                {mediaUrls.map((url, index) => (
                                    <CarouselItem key={index}>
                                        <div className="p-1">
                                            {isVideo ? (
                                                <video src={url} controls className="w-full aspect-video rounded-lg" />
                                            ) : (
                                                <Image src={url} width={1080} height={1080} className="w-full h-auto object-cover rounded-lg aspect-square" alt={`Post image ${index + 1}`} />
                                            )}
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                            <CarouselPrevious />
                            <CarouselNext />
                        </Carousel>
                    ) : (
                        <div className="w-full aspect-square flex items-center justify-center bg-muted rounded-lg">
                            <p className="text-muted-foreground">No Media</p>
                        </div>
                    )}
                </div>
                 <div className="p-2">
                    <ScrollArea className="max-h-[400px]">
                        <div className="space-y-1 pr-2">
                            {posts.map(post => (
                                 <CaptionListItem 
                                    key={post.id}
                                    post={post}
                                    onApprove={onApprove}
                                    onReject={onReject}
                                    onEdit={() => onEdit(post)}
                                    isPending={isPending}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
}


const ScheduledCard = ({ post, onReturnToPending, onDelete, isPending }: { post: any, onReturnToPending: (id: string) => void, onDelete: (id: string) => void, isPending: boolean }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const mediaUrls = [
      ...(Array.isArray(post.imageUrls) ? post.imageUrls : []),
      post.videoUrl,
      post.stitchedImageUrl
    ].filter(url => typeof url === 'string' && url);
    const displayMediaUrl = mediaUrls && mediaUrls[0];
    const isVideo = !!post.videoUrl;
    const platformKey = post.platform.toLowerCase();
    const createdAt = post.createdAt ? new Date(post.createdAt) : null;

    const handleAction = (action: 'return' | 'delete') => {
        setIsSubmitting(true);
        if (action === 'return') onReturnToPending(post.id);
        if (action === 'delete') onDelete(post.id);
    }
    
    return (
        <Card className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {isVideo ? (
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Film className="h-8 w-8 text-muted-foreground" />
                </div>
            ) : (
                displayMediaUrl ? (
                    <Image src={displayMediaUrl} width={64} height={64} className="rounded-lg aspect-square object-cover" alt={post.vehicle} />
                ) : (
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                         <Bot className="h-8 w-8 text-muted-foreground" />
                    </div>
                )
            )}
            <div className="flex-grow sm:hidden">
                <p className="font-semibold">{post.vehicle}</p>
                <p className="text-sm text-muted-foreground">{post.service}</p>
            </div>
          </div>
          <div className="flex-grow hidden sm:block">
            <p className="font-semibold">{post.vehicle}</p>
            <p className="text-sm text-muted-foreground">{post.service}</p>
          </div>
           <div className="flex flex-col items-start sm:items-end w-full sm:w-auto text-left sm:text-right gap-2">
                <Badge className={`text-white ${platformDisplay[platformKey]?.className || 'bg-gray-500'}`}>
                    <PlatformIcon platform={platformKey} className="h-4 w-4 mr-1.5" />
                    {platformDisplay[platformKey]?.name || post.platform}
                </Badge>
                 <p className="text-sm font-medium text-muted-foreground">
                    Scheduled {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : ''}
                </p>
            </div>
            <div className="flex items-center gap-1 self-start sm:self-center">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAction('return')} disabled={isPending && isSubmitting}>
                  {isPending && isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={isPending && isSubmitting}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this scheduled post. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleAction('delete')} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </Card>
    )
};

const PostedCard = ({ post, onDelete, isPending }: { post: any, onDelete: (id: string) => void, isPending: boolean }) => {
    const mediaUrls = [
      ...(Array.isArray(post.imageUrls) ? post.imageUrls : []),
      post.videoUrl,
      post.stitchedImageUrl
    ].filter(url => typeof url === 'string' && url);
    const displayMediaUrl = mediaUrls && mediaUrls[0];
    const isVideo = !!post.videoUrl;
    const platformKey = post.platform.toLowerCase();
    const postedAt = post.postedAt ? new Date(post.postedAt) : null;

    return (
        <Card className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4 bg-muted/50">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                {isVideo ? (
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                ) : (
                    displayMediaUrl ? (
                        <Image src={displayMediaUrl} width={64} height={64} className="rounded-lg aspect-square object-cover" alt={post.vehicle} />
                    ) : (
                         <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                             <Bot className="h-8 w-8 text-muted-foreground" />
                        </div>
                    )
                )}
            </div>
            <div className="flex-grow">
                <p className="font-semibold">{post.vehicle}</p>
                <p className="text-sm text-muted-foreground">{post.service}</p>
            </div>
            <div className="flex flex-col items-start sm:items-end w-full sm:w-auto text-left sm:text-right gap-2">
                <Badge className={`text-white ${platformDisplay[platformKey]?.className || 'bg-gray-500'}`}>
                    <PlatformIcon platform={platformKey} className="h-4 w-4 mr-1.5" />
                    {platformDisplay[platformKey]?.name || post.platform}
                </Badge>
                 <p className="text-sm font-medium text-green-600">
                    Posted {postedAt ? formatDistanceToNow(postedAt, { addSuffix: true }) : 'recently'}
                </p>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={isPending}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete History?</AlertDialogTitle><AlertDialogDescription>This will delete the record of this post. It will not un-post it from the social media platform.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(post.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};

const RejectedCard = ({ post, onReturnToPending, onDelete, isPending }: { post: any, onReturnToPending: (id: string) => void, onDelete: (id: string) => void, isPending: boolean }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const mediaUrls = [
      ...(Array.isArray(post.imageUrls) ? post.imageUrls : []),
      post.videoUrl,
      post.stitchedImageUrl
    ].filter(url => typeof url === 'string' && url);
    const displayMediaUrl = mediaUrls && mediaUrls[0];
    const isVideo = !!post.videoUrl;
    const platformKey = post.platform.toLowerCase();
    const createdAt = post.createdAt ? new Date(post.createdAt) : null;

    const handleAction = (action: 'return' | 'delete') => {
        setIsSubmitting(true);
        if (action === 'return') onReturnToPending(post.id);
        if (action === 'delete') onDelete(post.id);
    }
    
    return (
        <Card className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4 bg-destructive/10 border-destructive/50">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {isVideo ? (
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Film className="h-8 w-8 text-muted-foreground" />
                </div>
            ) : (
                displayMediaUrl ? (
                    <Image src={displayMediaUrl} width={64} height={64} className="rounded-lg aspect-square object-cover" alt={post.vehicle} />
                ) : (
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                         <Bot className="h-8 w-8 text-muted-foreground" />
                    </div>
                )
            )}
          </div>
          <div className="flex-grow">
            <p className="font-semibold">{post.vehicle}</p>
            <p className="text-sm text-muted-foreground">{post.service}</p>
          </div>
           <div className="flex flex-col items-start sm:items-end w-full sm:w-auto text-left sm:text-right gap-2">
                <Badge className={`text-white ${platformDisplay[platformKey]?.className || 'bg-gray-500'}`}>
                    <PlatformIcon platform={platformKey} className="h-4 w-4 mr-1.5" />
                    {platformDisplay[platformKey]?.name || post.platform}
                </Badge>
                 <p className="text-sm font-medium text-destructive">
                    Rejected {createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : ''}
                </p>
            </div>
            <div className="flex items-center gap-1 self-start sm:self-center">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleAction('return')} disabled={isPending && isSubmitting}>
                  {isPending && isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={isPending && isSubmitting}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this rejected post.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleAction('delete')} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </Card>
    )
};


const ScheduleSettings = ({ onSave, isPending, initialSettings }: { onSave: (settings: any) => void, isPending: boolean, initialSettings: any }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [frequency, setFrequency] = useState('daily');
    const [dayOfWeek, setDayOfWeek] = useState('friday');
    const [time, setTime] = useState('19:00');

    useEffect(() => {
        if (initialSettings) {
            setIsEnabled(initialSettings.isEnabled ?? false);
            setFrequency(initialSettings.frequency ?? 'daily');
            setDayOfWeek(initialSettings.dayOfWeek ?? 'friday');
            setTime(initialSettings.time ?? '19:00');
        }
    }, [initialSettings]);

    const handleSaveClick = () => {
        onSave({ isEnabled, frequency, dayOfWeek, time });
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>Scheduling Settings</DialogTitle>
                <DialogDescription>Configure the automated posting schedule. The cron job will post one item from the 'Scheduled' list at the specified time.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6">
                 <div className="flex items-center justify-between">
                    <Label htmlFor="scheduling-enabled" className="flex flex-col gap-1">
                        <span>Automated Posting</span>
                        <span className="font-normal text-muted-foreground text-sm">Enable to automatically post content.</span>
                    </Label>
                    <Switch id="scheduling-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="frequency">Frequency</Label>
                        <Select value={frequency} onValueChange={setFrequency} disabled={!isEnabled}>
                            <SelectTrigger id="frequency"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {frequency === 'weekly' && (
                         <div className="space-y-2">
                            <Label htmlFor="day-of-week">Day of the Week</Label>
                            <Select value={dayOfWeek} onValueChange={setDayOfWeek} disabled={!isEnabled}>
                                <SelectTrigger id="day-of-week"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monday">Monday</SelectItem>
                                    <SelectItem value="tuesday">Tuesday</SelectItem>
                                    <SelectItem value="wednesday">Wednesday</SelectItem>
                                    <SelectItem value="thursday">Thursday</SelectItem>
                                    <SelectItem value="friday">Friday</SelectItem>
                                    <SelectItem value="saturday">Saturday</SelectItem>
                                    <SelectItem value="sunday">Sunday</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="time">Time (24h format)</Label>
                    <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!isEnabled}/>
                </div>
            </div>
            <DialogFooter>
                 <Button onClick={handleSaveClick} disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Settings
                </Button>
            </DialogFooter>
        </>
    );
};


const postsRef = collection(galleryFirestore, 'posts');

export default function SchedulePage() {
  const [isPending, startTransition] = useTransition();
  const [isGeneratingReel, setIsGeneratingReel] = useState(false);
  const { toast } = useToast();
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [reelGenLogs, setReelGenLogs] = useState<string[]>([]);

  const settingsRef = useMemo(() => doc(galleryFirestore, 'settings', 'scheduling'), []);
  const [settings, settingsLoading, settingsError] = useDocumentData(settingsRef);

  const pendingQuery = useMemo(() => query(postsRef, where('status', '==', 'pending')), []);
  const scheduledQuery = useMemo(() => query(postsRef, where('status', '==', 'scheduled')), []);
  const postedQuery = useMemo(() => query(postsRef, where('status', '==', 'posted')), []);
  const rejectedQuery = useMemo(() => query(postsRef, where('status', '==', 'rejected')), []);


  const [pendingCollection, pendingLoading] = useCollection(pendingQuery);
  const [scheduledCollection, scheduledLoading] = useCollection(scheduledQuery);
  const [postedCollection, postedLoading] = useCollection(postedQuery);
  const [rejectedCollection, rejectedLoading] = useCollection(rejectedQuery);

  const { groupedPendingPosts, loading } = useMemo(() => {
    const pending = pendingCollection?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
    
    const grouped = pending.reduce((acc, post) => {
        const key = (post.imageUrls && post.imageUrls[0]) || post.videoUrl || post.stitchedImageUrl || post.id;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(post);
        return acc;
    }, {} as Record<string, any[]>);

    return {
      groupedPendingPosts: Object.values(grouped),
      loading: pendingLoading || scheduledLoading || postedLoading || rejectedLoading || settingsLoading
    };
  }, [pendingCollection, scheduledCollection, postedCollection, rejectedCollection, settingsLoading]);


  const scheduledPosts = useMemo(() => {
    if (!scheduledCollection) return [];
    return scheduledCollection.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, [scheduledCollection]);
  
  const postedPosts = useMemo(() => {
    if (!postedCollection) return [];
    return postedCollection.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, [postedCollection]);
    
  const rejectedPosts = useMemo(() => {
    if (!rejectedCollection) return [];
    return rejectedCollection.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, [rejectedCollection]);

  const runDriveScan = async () => {
    setIsGeneratingReel(true);
    setReelGenLogs(["Starting automated reel generation..."]);
    try {
        const response = await fetch('/api/cron/generate-automated-reel');
        if (!response.body) {
            throw new Error("The response from the server was empty.");
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                setReelGenLogs(prev => [...prev, "Stream finished."]);
                break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line

            lines.forEach(line => {
                if (line.trim() === '') return;
                try {
                    const data = JSON.parse(line);
                    if (data.log) {
                         setReelGenLogs(prev => [...prev, data.log]);
                    }
                    if (data.error) {
                        throw new Error(data.error);
                    }
                } catch (e) {
                     setReelGenLogs(prev => [...prev, `Received non-JSON line: ${line}`]);
                }
            });
        }
        toast({ title: "Drive Scan Complete", description: "The automated process has finished." });
    } catch (error: any) {
        console.error("Automated reel generation failed:", error);
        toast({ title: "Drive Scan Failed", description: error.message, variant: "destructive" });
        setReelGenLogs(prev => [...prev, `ERROR: ${error.message}`]);
    } finally {
        setIsGeneratingReel(false);
    }
  };

  const handleApprove = (id: string) => {
    startTransition(async () => {
        try {
            const postRef = doc(galleryFirestore, 'posts', id);
            await updateDoc(postRef, { status: 'scheduled' });
            
            const postSnap = await getDoc(postRef);
            if(postSnap.exists()){
                const postData = { id: postSnap.id, ...postSnap.data() };
                postToGoogleSheets([postData]).catch(err => console.error("Sheets sync failed:", err));
            }

            toast({
                title: "Post Approved!",
                description: "The post has been moved to the scheduled list and synced.",
            });
        } catch (error) {
            console.error("Error approving post:", error);
            toast({
                title: "Error",
                description: "Could not approve the post.",
                variant: "destructive",
            });
        }
    });
  };
  
  const handleApproveAll = (postsToApprove: any[]) => {
      startTransition(async () => {
          const batch = writeBatch(galleryFirestore);
          postsToApprove.forEach(post => {
              const postRef = doc(galleryFirestore, 'posts', post.id);
              batch.update(postRef, { status: 'scheduled' });
          });
          try {
            await batch.commit();

            postToGoogleSheets(postsToApprove).catch(err => console.error("Sheets sync failed for bulk approve:", err));

            toast({
                title: "All Approved!",
                description: `${postsToApprove.length} posts have been scheduled and synced.`,
            });
          } catch(error){
             console.error("Error approving all posts:", error);
             toast({ title: "Error", description: "Could not approve all posts.", variant: "destructive" });
          }
      });
  };

  const handleStatusUpdate = (id: string, status: 'pending' | 'rejected', successMessage: string) => {
    startTransition(async () => {
        try {
            const postRef = doc(galleryFirestore, 'posts', id);
            await updateDoc(postRef, { status: status });
            toast({
                title: "Success!",
                description: successMessage,
            });
        } catch (error) {
            console.error("Error updating post:", error);
            toast({
                title: "Error",
                description: "Could not update the post.",
                variant: "destructive",
            });
        }
    });
  }

  const handleDeleteAllPending = () => {
      startTransition(async () => {
          if (!pendingCollection) return;
          const batch = writeBatch(galleryFirestore);
          pendingCollection.docs.forEach(doc => {
              batch.delete(doc.ref);
          });
          try {
              await batch.commit();
              toast({
                  title: "All Pending Posts Deleted",
                  description: "The approval queue has been cleared.",
              });
          } catch (error) {
              toast({
                  title: "Error",
                  description: "Could not delete all pending posts.",
                  variant: "destructive",
              });
          }
      });
  };

  const handleDeletePost = (id: string) => {
    startTransition(async () => {
      try {
        await deleteDoc(doc(galleryFirestore, 'posts', id));
        toast({
          title: "Post Deleted",
          description: "The post has been permanently removed.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Could not delete the post.",
          variant: "destructive",
        });
      }
    });
  };

  const handleSaveSettings = (newSettings: any) => {
      startTransition(async () => {
            try {
                await setDoc(settingsRef, newSettings);
                toast({
                    title: "Settings Saved!",
                    description: "Your scheduling settings have been updated.",
                });
            } catch (e: any) {
                toast({
                    title: "Error",
                    description: e.message || "Failed to save settings.",
                    variant: "destructive",
                });
            }
        });
  }

  const handleReturnToPending = (id: string) => handleStatusUpdate(id, 'pending', "The post has been returned to the pending list.");
  const handleReject = (id: string) => handleStatusUpdate(id, 'rejected', "The post has been moved to the rejected list.");

  const handleSavePost = (id: string, newText: string, newHashtags: string[]) => {
    startTransition(async () => {
        try {
            const postRef = doc(galleryFirestore, 'posts', id);
            await updateDoc(postRef, {
                text: newText,
                hashtags: newHashtags,
            });
            toast({
                title: "Post Saved!",
                description: "Your changes have been saved successfully.",
            });
            setEditingPost(null);
        } catch (error) {
             toast({
                title: "Error",
                description: "Could not save changes.",
                variant: "destructive",
            });
        }
    });
};
    
  return (
    <div className="flex flex-col gap-8 w-full">
      <PageHeader
        title="Smart Scheduling"
        description="Manage your content pipeline and post at optimal times."
      >
        <Button onClick={runDriveScan} disabled={isGeneratingReel}>
            {isGeneratingReel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run Drive Scan Now
        </Button>
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Settings className="mr-2 h-4 w-4" />
                    Schedule Settings
                </Button>
            </DialogTrigger>
            <DialogContent>
                {settingsError && <div className="text-red-500">Error loading settings.</div>}
                {settingsLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> :
                <ScheduleSettings 
                    onSave={handleSaveSettings} 
                    isPending={isPending}
                    initialSettings={settings}
                />}
            </DialogContent>
        </Dialog>

      </PageHeader>
      
      {isGeneratingReel && (
        <Card>
            <CardHeader>
                <CardTitle>Automated Drive Scan in Progress</CardTitle>
            </CardHeader>
            <CardContent>
                 <ScrollArea className="h-48 w-full bg-muted rounded-md p-4 font-mono text-xs">
                    {reelGenLogs.map((log, index) => (
                        <p key={index} className="whitespace-pre-wrap animate-in fade-in">{log}</p>
                    ))}
                 </ScrollArea>
            </CardContent>
        </Card>
      )}

        <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="pending">
                    Pending ({groupedPendingPosts.length})
                </TabsTrigger>
                <TabsTrigger value="scheduled">
                    Scheduled ({scheduledPosts.length})
                </TabsTrigger>
                 <TabsTrigger value="rejected">
                    Rejected ({rejectedPosts.length})
                </TabsTrigger>
                <TabsTrigger value="posted">
                    Posted ({postedPosts.length})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
                <div className="mb-4 flex justify-end">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isPending || groupedPendingPosts.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete All Pending
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete all {groupedPendingPosts.reduce((acc, posts) => acc + posts.length, 0)} posts currently in the pending queue. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAllPending} className="bg-destructive hover:bg-destructive/90">
                                    Delete All
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
                {loading && <div className="text-center text-muted-foreground py-12">Loading posts...</div>}
                {!loading && groupedPendingPosts.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                        <Bot className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Posts Pending Approval</h3>
                        <p className="mt-1 text-sm">Generate some content to see it here.</p>
                    </div>
                )}
                <div className="space-y-6">
                    {groupedPendingPosts.map((posts, index) => (
                         <GroupedApprovalCard 
                            key={index}
                            posts={posts}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onEdit={setEditingPost}
                            onApproveAll={handleApproveAll}
                            isPending={isPending}
                         />
                    ))}
                </div>
                 {editingPost && (
                    <EditPostDialog 
                        post={editingPost}
                        onSave={handleSavePost}
                        isSaving={isPending}
                        onCancel={() => setEditingPost(null)}
                    />
                )}
            </Dialog>
            </TabsContent>

            <TabsContent value="scheduled" className="mt-6">
                <div className="mb-4 flex justify-end">
                    <Button asChild variant="outline">
                        <a href={process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL} target="_blank" rel="noopener noreferrer">
                            <Sheet className="mr-2 h-4 w-4" />
                            View on Google Sheets
                        </a>
                    </Button>
                </div>
                {loading && <div className="text-center text-muted-foreground py-12">Loading posts...</div>}
                {!loading && scheduledPosts.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                        <CalendarClock className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Posts Scheduled</h3>
                        <p className="mt-1 text-sm">Approve some posts to see them here.</p>
                    </div>
                )}
                <div className="grid gap-4 sm:grid-cols-1">
                    {scheduledPosts.map((post) => (
                        <ScheduledCard key={post.id} post={post} onReturnToPending={handleReturnToPending} onDelete={handleDeletePost} isPending={isPending} />
                    ))}
                </div>
            </TabsContent>

             <TabsContent value="rejected" className="mt-6">
                {loading && <div className="text-center text-muted-foreground py-12">Loading posts...</div>}
                {!loading && rejectedPosts.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                        <AlertCircle className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Rejected Posts</h3>
                        <p className="mt-1 text-sm">Posts you reject will appear here.</p>
                    </div>
                )}
                <div className="grid gap-4 sm:grid-cols-1">
                    {rejectedPosts.map((post) => (
                        <RejectedCard key={post.id} post={post} onReturnToPending={handleReturnToPending} onDelete={handleDeletePost} isPending={isPending} />
                    ))}
                </div>
            </TabsContent>

            <TabsContent value="posted" className="mt-6">
                {loading && <div className="text-center text-muted-foreground py-12">Loading posts...</div>}
                {!loading && postedPosts.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                        <History className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Posted Content</h3>
                        <p className="mt-1 text-sm">Manually post content to see its history here.</p>
                    </div>
                )}
                <div className="grid gap-4 sm:grid-cols-1">
                    {postedPosts.map((post) => (
                        <PostedCard key={post.id} post={post} onDelete={handleDeletePost} isPending={isPending} />
                    ))}
                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}
