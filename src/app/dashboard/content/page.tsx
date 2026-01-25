
"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { firestore, galleryFirestore } from "@/firebase/config";
import PageHeader from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Image as ImageIcon, Wand, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const GalleryItemCard = ({ item, onGenerate, isGenerating }: { 
    item: any,
    onGenerate: (item: any) => void,
    isGenerating: boolean,
}) => {
    const isGenerated = item.isGenerated === true;
    
    return (
        <Card className={`overflow-hidden transition-all ${isGenerated ? 'opacity-50 grayscale' : 'hover:shadow-lg'}`}>
            <CardContent className="p-0">
                <div className="grid grid-cols-2">
                     <Image
                        src={item.beforeImageUrl}
                        alt="Before"
                        width={300}
                        height={300}
                        className="aspect-square object-cover"
                    />
                    <Image
                        src={item.afterImageUrl}
                        alt="After"
                        width={300}
                        height={300}
                        className="aspect-square object-cover"
                    />
                </div>
                <div className="p-4 space-y-3">
                    <h3 className="font-semibold truncate">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description || "No description."}</p>
                    <Button 
                        className="w-full"
                        onClick={() => onGenerate(item)}
                        disabled={isGenerating || isGenerated}
                    >
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                         isGenerated ? <CheckCircle className="mr-2 h-4 w-4" /> : <Wand className="mr-2 h-4 w-4" />}
                        {isGenerated ? "Content Generated" : "Generate Content"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};


export default function ContentPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isGenerating, startGenerating] = useTransition();
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    const galleryQuery = useMemo(() => query(
        collection(galleryFirestore, 'gallery'), 
        where('isBeforeAfter', '==', true),
        orderBy('createdAt', 'desc')
    ), []);
    const [galleryCollection, loading, error] = useCollection(galleryQuery);

    const galleryItems = useMemo(() => {
        if (!galleryCollection) return [];
        return galleryCollection.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, [galleryCollection]);

    const handleGenerate = (item: any) => {
        if (item.isGenerated) {
            toast({ title: "Already Generated", description: "Content has already been generated for this item." });
            return;
        }

        setGeneratingId(item.id);
        startGenerating(async () => {
            let stitchedImageUrl = item.stitchedImageUrl;
            try {
                // Stitch images if not already done
                if (!stitchedImageUrl) {
                    toast({ title: "Step 1/2: Processing Images", description: "Stitching 'before' & 'after' images..."});
                    const imageResponse = await fetch('/api/image/overlay-text', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ beforeUrl: item.beforeImageUrl, afterUrl: item.afterImageUrl }),
                    });
                    const imageResult = await imageResponse.json();
                    if (imageResult.error) throw new Error(`Image Processing Failed: ${imageResult.message}`);
                    stitchedImageUrl = imageResult.stitchedImageUrl;
                    toast({ title: "Step 1/2 Complete!", description: "Images successfully stitched."});
                }
                
                // Generate captions
                toast({ title: "Step 2/2: Generating Captions", description: "AI is now writing your content..."});
                const response = await fetch('/api/content/generate-from-gallery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        galleryItem: { ...item, stitchedImageUrl }
                    }),
                });

                const result = await response.json();
                if (result.error) throw new Error(result.message);
                
                toast({ title: "Success!", description: "Content generated. Redirecting to schedule..." });
                router.push('/dashboard/schedule');

            } catch (err: any) {
                toast({ title: "An error occurred", description: err.message, variant: "destructive" });
            } finally {
                setGeneratingId(null);
            }
        });
    }

    const renderContent = () => {
        if (loading) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-2">
                                    <div className="aspect-square bg-muted animate-pulse" />
                                    <div className="aspect-square bg-muted animate-pulse" />
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                                    <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                                    <div className="h-9 w-full bg-muted animate-pulse rounded-lg" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )
        }
        if (error) {
            return <div className="text-center py-12 text-red-500">Error: {error.message}</div>
        }
        if (galleryItems.length === 0) {
            return (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ImageIcon className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">Gallery is Empty</h3>
                    <p className="mt-1 text-sm">No 'before & after' images found in the gallery collection.</p>
                </div>
            )
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {galleryItems.map(item => (
                    <GalleryItemCard
                        key={item.id}
                        item={item}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating && generatingId === item.id}
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Content Generation from Gallery"
                description="Select a 'before & after' set to generate captions and approve them instantly."
            />
            <div>
                {renderContent()}
            </div>
        </div>
    );
}
