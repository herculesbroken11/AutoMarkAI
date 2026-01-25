
"use client";

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Play, Sparkles, Images, AlertCircle, FolderSearch, CheckCircle, Database, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { galleryFirestore } from '@/firebase/config';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
}

interface ImageWithFeatures {
    file: DriveFile;
    features: tf.Tensor;
    previewUrl: string;
}

interface PairedImage {
    id?: string; // For Firestore document ID
    before: { id: string; name: string; previewUrl: string };
    after: { id: string; name: string; previewUrl: string };
    score: number;
    contextName: string;
}

export default function ImagePairingPage() {
    const { toast } = useToast();
    const [model, setModel] = useState<mobilenet.MobileNet | null>(null);
    const [isLoadingModel, setIsLoadingModel] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ value: 0, text: '' });
    
    // Newly found pairs from a scan
    const [newlyPairedImages, setNewlyPairedImages] = useState<PairedImage[]>([]);
    
    const [savedPairs, savedPairsLoading, savedPairsError] = useCollection(
        query(collection(galleryFirestore, 'paired_images'), orderBy('createdAt', 'desc'))
    );
    const [isSaving, startSavingTransition] = useTransition();

    const [foundContext, setFoundContext] = useState<string | null>(null);
    const [similarityThreshold, setSimilarityThreshold] = useState(80);
    const [alreadyPairedIds, setAlreadyPairedIds] = useState<Set<string>>(new Set());

    const allPairedImages = useMemo(() => {
        if (!savedPairs) return [];
        return savedPairs.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PairedImage[];
    }, [savedPairs]);

    useEffect(() => {
        const fetchPairedIds = async () => {
            const pairedImagesRef = collection(galleryFirestore, 'paired_images');
            const snapshot = await getDocs(pairedImagesRef);
            const ids = new Set<string>();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.beforeId) ids.add(data.beforeId);
                if (data.afterId) ids.add(data.afterId);
            });
            setAlreadyPairedIds(ids);
        };
        fetchPairedIds();
    }, [savedPairs]);


    useEffect(() => {
        async function loadModel() {
            try {
                await tf.setBackend('webgl');
                const mobilenetModel = await mobilenet.load();
                setModel(mobilenetModel);
                setIsLoadingModel(false);
                toast({ title: 'AI Model Loaded', description: 'Ready to pair images.' });
            } catch (error) {
                console.error("Failed to load model", error);
                toast({ title: 'Model Load Error', description: 'Could not load the AI model.', variant: 'destructive' });
                setIsLoadingModel(false);
            }
        }
        loadModel();
    }, [toast]);

    const processImages = useCallback(async (files: DriveFile[], type: 'Before' | 'After'): Promise<ImageWithFeatures[]> => {
        const processedImages: ImageWithFeatures[] = [];
        const filesToProcess = files.filter(f => !alreadyPairedIds.has(f.id));
        
        if (filesToProcess.length === 0) {
            toast({ title: `All ${type} images already paired`, description: `Skipping analysis for this folder.`});
            return [];
        }

        for (const file of filesToProcess) {
            const overallProgress = type === 'Before' 
                ? 10 + (processedImages.length / filesToProcess.length) * 40 
                : 50 + (processedImages.length / filesToProcess.length) * 40;
            setProgress({ value: overallProgress, text: `Analyzing ${type}: ${file.name}` });
            
            try {
                const imageResponse = await fetch(`/api/drive/download?fileId=${file.id}`);
                if (!imageResponse.ok) {
                    console.warn(`Skipping file ${file.name}, failed to download.`);
                    continue;
                };
                
                const blob = await imageResponse.blob();
                const previewUrl = URL.createObjectURL(blob);
                
                const imageElement = document.createElement('img');
                imageElement.src = previewUrl;
                await new Promise<void>((resolve, reject) => {
                    imageElement.onload = () => resolve();
                    imageElement.onerror = (err) => reject(err);
                });
                
                if (!model) throw new Error("AI model is not loaded.");

                const tensor = tf.browser.fromPixels(imageElement);
                const features = model.infer(tensor, true) as tf.Tensor;
                tensor.dispose();
                
                processedImages.push({ file, features, previewUrl });

            } catch (error: any) {
                 console.error(`Error processing file ${file.name}:`, error);
                 toast({ title: 'Processing Error', description: `Could not process file: ${file.name}. Skipping.`, variant: 'destructive' });
            }
        }
        return processedImages;
    }, [model, toast, alreadyPairedIds]);

    const cosineSimilarity = (vecA: tf.Tensor, vecB: tf.Tensor) => {
        return tf.tidy(() => {
            const dotProduct = vecA.dot(vecB.transpose());
            const normA = vecA.norm();
            const normB = vecB.norm();
            return dotProduct.div(normA.mul(normB)).dataSync()[0];
        });
    };
    
    const startPairing = async () => {
        if (!model) {
            toast({ title: 'AI Model not loaded', description: 'Please wait for the model to finish loading before starting.', variant: 'destructive' });
            return;
        }

        setIsProcessing(true);
        setNewlyPairedImages([]);
        setFoundContext(null);

        try {
            setProgress({ value: 5, text: 'Searching for Before/After folders in Google Drive...' });
            const pairResponse = await fetch('/api/drive/find-image-pairs');
            const pairData = await pairResponse.json();

            if (!pairResponse.ok || pairData.error) {
                throw new Error(pairData.error || 'Could not find a pair of Before/After folders.');
            }
            
            const { beforeFiles, afterFiles, contextName } = pairData;
            setFoundContext(contextName);
            toast({ title: "Found folder pair!", description: `Processing images in "${contextName}"`});

            if (beforeFiles.length === 0 || afterFiles.length === 0) {
                 throw new Error('Found folders, but one or both are empty. Please add images to continue.');
            }

            const beforeImagesWithFeatures = await processImages(beforeFiles, 'Before');
            const afterImagesWithFeatures = await processImages(afterFiles, 'After');

            setProgress({ value: 90, text: 'Finding best matches...' });
            const pairs: PairedImage[] = [];
            const usedAfterIndices = new Set<number>();
            
            for (const beforeImg of beforeImagesWithFeatures) {
                let bestMatch: { index: number; score: number; } | null = null;
                for (let i = 0; i < afterImagesWithFeatures.length; i++) {
                    if (usedAfterIndices.has(i)) continue;
                    
                    const afterImg = afterImagesWithFeatures[i];
                    const score = cosineSimilarity(beforeImg.features, afterImg.features);
                    
                    if (!bestMatch || score > bestMatch.score) {
                        bestMatch = { index: i, score };
                    }
                }
                
                if (bestMatch && (bestMatch.score * 100) >= similarityThreshold) {
                    const afterImg = afterImagesWithFeatures[bestMatch.index];
                    pairs.push({
                        before: { id: beforeImg.file.id, name: beforeImg.file.name, previewUrl: beforeImg.previewUrl },
                        after: { id: afterImg.file.id, name: afterImg.file.name, previewUrl: afterImg.previewUrl },
                        score: bestMatch.score,
                        contextName: contextName,
                    });
                    usedAfterIndices.add(bestMatch.index);
                }
                beforeImg.features.dispose();
            }
            
            afterImagesWithFeatures.forEach((img, index) => {
                if (!usedAfterIndices.has(index)) {
                    img.features.dispose();
                }
            });
            
            setNewlyPairedImages(pairs.sort((a, b) => b.score - a.score));
            toast({ title: 'Pairing Complete!', description: `Found ${pairs.length} new pairs meeting the threshold.` });

        } catch (error: any) {
            console.error("Pairing error:", error);
            toast({ title: 'An Error Occurred', description: error.message, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
            setProgress({ value: 0, text: '' });
        }
    };
    
    const handleSavePairs = () => {
        if (newlyPairedImages.length === 0) return;
        startSavingTransition(async () => {
            try {
                for (const pair of newlyPairedImages) {
                    await addDoc(collection(galleryFirestore, 'paired_images'), {
                        beforeId: pair.before.id,
                        afterId: pair.after.id,
                        beforeName: pair.before.name,
                        afterName: pair.after.name,
                        score: pair.score,
                        contextName: pair.contextName,
                        createdAt: new Date().toISOString(),
                    });
                }
                toast({
                    title: "Pairs Saved!",
                    description: `${newlyPairedImages.length} new pairs have been saved to the database.`,
                });
                setNewlyPairedImages([]);
            } catch (error: any) {
                toast({ title: "Error Saving Pairs", description: error.message, variant: "destructive" });
            }
        });
    }

    const handleDeletePair = (id: string) => {
        startSavingTransition(async () => {
            try {
                await deleteDoc(doc(galleryFirestore, 'paired_images', id));
                toast({ title: "Pair Deleted", description: "The matched pair has been removed from the database." });
            } catch (error: any) {
                toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
            }
        });
    };

    const MatchedPairCard = ({ pair, isNew = false, onDelete, isSaving }: { pair: any, isNew?: boolean, onDelete?: (id: string) => void, isSaving?: boolean }) => {
    
    const beforeImageUrl = isNew ? pair.before.previewUrl : `/api/drive/download?fileId=${pair.beforeId}`;
    const afterImageUrl = isNew ? pair.after.previewUrl : `/api/drive/download?fileId=${pair.afterId}`;
    const beforeName = isNew ? pair.before.name : pair.beforeName;
    const afterName = isNew ? pair.after.name : pair.afterName;

    return (
        <Card className={`overflow-hidden ${isNew ? 'border-primary' : ''}`}>
            <CardContent className="p-0">
                <div className="grid grid-cols-2">
                    <Image src={beforeImageUrl || '/placeholder.svg'} alt={beforeName} width={400} height={400} className="aspect-video object-cover" />
                    <Image src={afterImageUrl || '/placeholder.svg'} alt={afterName} width={400} height={400} className="aspect-video object-cover" />
                </div>
                <div className="p-3 bg-muted/50 text-sm flex justify-between items-center">
                    <div className="flex flex-col">
                        <p className="font-mono text-muted-foreground text-xs" title={beforeName}>Before: {beforeName}</p>
                        <p className="font-mono text-muted-foreground text-xs" title={afterName}>After: {afterName}</p>
                    </div>
                    <div className="flex items-center gap-2 font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>Score: {(pair.score * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </CardContent>
            {onDelete && pair.id && (
                <CardFooter className='p-2 justify-end'>
                     <Button size="icon" variant="ghost" onClick={() => onDelete(pair.id!)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}

    return (
        <div className="space-y-8">
            <PageHeader title="AI Image Pairing" description="Automatically find and match your before & after photos using visual analysis." />
            
            <Card>
                <CardHeader>
                    <CardTitle>Run Pairing Analysis</CardTitle>
                    <CardDescription>
                        Click "Start" to scan your Drive for a Before/After folder set, analyze the images, and find the best matches above your chosen confidence level.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Button onClick={startPairing} disabled={isLoadingModel || isProcessing} className="w-full">
                            {isLoadingModel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            {isLoadingModel ? "Loading AI Model..." : isProcessing ? "Processing Images..." : "Start Pairing Analysis"}
                        </Button>
                        <div className="space-y-2">
                            <Label htmlFor="threshold">Match Confidence Threshold: {similarityThreshold}%</Label>
                            <Slider
                                id="threshold"
                                min={50}
                                max={95}
                                step={1}
                                value={[similarityThreshold]}
                                onValueChange={(value) => setSimilarityThreshold(value[0])}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>
                     {isProcessing && (
                        <div className="mt-4 space-y-2">
                           <Progress value={progress.value} />
                           <p className="text-sm text-center text-muted-foreground">{progress.text}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
             {newlyPairedImages.length > 0 && (
                <Card className="border-primary">
                    <CardHeader>
                        <CardTitle>New Matched Pairs</CardTitle>
                        <CardDescription>
                            Found {newlyPairedImages.length} new pairs in folder <span className="font-semibold text-primary">{foundContext}</span> with a match score of {similarityThreshold}% or higher.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {newlyPairedImages.map((pair, index) => (
                             <MatchedPairCard key={index} pair={pair} isNew={true} />
                        ))}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSavePairs} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save {newlyPairedImages.length} Pairs to Database
                        </Button>
                    </CardFooter>
                </Card>
             )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Saved Pairs Database</CardTitle>
                    <CardDescription>This is the persistent list of all successfully matched pairs.</CardDescription>
                </CardHeader>
                <CardContent>
                    {savedPairsLoading && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64" />)}
                        </div>
                    )}
                    {savedPairsError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{savedPairsError.message}</AlertDescription></Alert>}
                    {!savedPairsLoading && allPairedImages.length === 0 && (
                        <Alert>
                            <FolderSearch className="h-4 w-4" />
                            <AlertTitle>Database is Empty</AlertTitle>
                            <AlertDescription>
                                Run the pairing analysis and save the results. Your saved pairs will appear here permanently.
                            </AlertDescription>
                        </Alert>
                    )}
                    {!savedPairsLoading && allPairedImages.length > 0 && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allPairedImages.map((pair) => (
                                <MatchedPairCard key={pair.id} pair={pair} onDelete={handleDeletePair} isSaving={isSaving} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
