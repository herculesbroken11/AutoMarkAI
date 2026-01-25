
"use client";

import { useState, useMemo, useTransition, useEffect } from 'react';
import Image from 'next/image';
import { collection, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
import { galleryFirestore } from "@/firebase/config";
import PageHeader from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Loader2, Car, DollarSign, Sparkles, Star, Image as ImageIcon, FileText, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


interface MonthlyStats {
    totalRevenue: number;
    totalServices: number;
    topServices: { name: string; count: number }[];
    recentBookingsCount: number;
}

interface GalleryImage {
    id: string;
    stitchedImageUrl?: string;
    beforeImageUrl?: string;
    afterImageUrl?: string;
    title: string;
    isGenerated?: boolean;
}

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default function MonthlyReportPage() {
    const { toast } = useToast();
    const [isGenerating, startGenerating] = useTransition();
    const [loading, setLoading] = useState(true);
    
    const [stats, setStats] = useState<MonthlyStats | null>(null);
    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    const [recommendations, setRecommendations] = useState<string[]>([]);

    useEffect(() => {
        const fetchReportData = async () => {
            setLoading(true);
            try {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);
                
                // Fetch bookings from the last 30 days
                const bookingsQuery = query(
                    collection(galleryFirestore, 'bookings'),
                    where('createdAt', '>=', thirtyDaysAgoTimestamp)
                );
                const bookingsSnapshot = await getDocs(bookingsQuery);
                const bookings = bookingsSnapshot.docs.map(doc => doc.data());
                
                // Calculate stats
                const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
                const serviceCounts: { [key: string]: number } = {};
                bookings.forEach(b => {
                    if (b.serviceName) {
                        serviceCounts[b.serviceName] = (serviceCounts[b.serviceName] || 0) + 1;
                    }
                });
                const topServices = Object.entries(serviceCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([name, count]) => ({ name, count }));

                setStats({
                    totalRevenue,
                    totalServices: bookings.length,
                    topServices,
                    recentBookingsCount: bookings.length,
                });

                // Fetch recent before/after images from the gallery
                const galleryQuery = query(
                    collection(galleryFirestore, 'gallery'),
                    where('isBeforeAfter', '==', true),
                    orderBy('createdAt', 'desc'),
                    limit(6)
                );
                const gallerySnapshot = await getDocs(galleryQuery);
                const galleryImages = gallerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GalleryImage));
                setGallery(galleryImages);

            } catch (error: any) {
                console.error("Failed to fetch report data:", error);
                toast({
                    title: "Error fetching data",
                    description: error.message,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [toast]);
    
    const handleGenerateRecommendations = async () => {
        if (!stats) {
            toast({ title: "Analytics data not loaded yet.", variant: "destructive" });
            return;
        }

        startGenerating(async () => {
            setRecommendations([]);
            try {
                const response = await fetch('/api/reports/generate-recommendations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stats),
                });
                const result = await response.json();
                if (result.error) throw new Error(result.message);
                
                setRecommendations(result.recommendations);
                toast({
                    title: "Recommendations Generated",
                    description: "The AI has provided insights for next month.",
                });

            } catch (error: any) {
                toast({
                    title: "Generation Failed",
                    description: error.message,
                    variant: "destructive",
                });
            }
        });
    }

    if (loading) {
        return (
            <div className="space-y-8">
                <PageHeader title="Monthly Report" description="Loading your 30-day analytics..." />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                </div>
                <Card><CardContent className="pt-6"><Skeleton className="h-64" /></CardContent></Card>
                 <Card><CardContent className="pt-6"><Skeleton className="h-48" /></CardContent></Card>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <PageHeader title="Monthly Analytics & Recap" description="An overview of your business performance over the last 30 days." />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Revenue" value={`$${stats?.totalRevenue.toFixed(2) || '0.00'}`} icon={DollarSign} />
                <StatCard title="Vehicles Serviced" value={stats?.totalServices || 0} icon={Car} />
                <StatCard title="Recent Bookings" value={stats?.recentBookingsCount || 0} icon={FileText} />
                 <StatCard title="Most Popular Tint" value="N/A" icon={Sparkles} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Top Service Packages</CardTitle>
                        <CardDescription>Your most popular services this month.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats && stats.topServices.length > 0 ? (
                            <ul className="space-y-4">
                                {stats.topServices.map((service, index) => (
                                    <li key={service.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                                <Star className="h-5 w-5 text-yellow-500" />
                                            </div>
                                            <p className="font-medium">{service.name}</p>
                                        </div>
                                        <Badge variant="secondary">{service.count} bookings</Badge>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-muted-foreground">No service data available.</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>AI Recommendations</CardTitle>
                        <CardDescription>Suggestions for next month based on this data.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isGenerating && (
                            <div className="flex items-center justify-center h-24">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {!isGenerating && recommendations.length > 0 && (
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                {recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <Bot className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
                                        <span>{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                         {!isGenerating && recommendations.length === 0 && (
                            <div className="text-center text-muted-foreground py-4">
                                <p>Click the button to generate AI insights.</p>
                            </div>
                        )}
                        
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleGenerateRecommendations} disabled={isGenerating || !stats} className="w-full">
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate Recommendations
                        </Button>
                    </CardFooter>
                </Card>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Recent Before/After Gallery</CardTitle>
                    <CardDescription>A showcase of your latest transformations. Total items: {gallery.length}</CardDescription>
                </CardHeader>
                <CardContent>
                    {gallery.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Before</TableHead>
                                        <TableHead>After</TableHead>
                                        <TableHead>Transformed</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gallery.map(img => (
                                        <TableRow key={img.id}>
                                            <TableCell>
                                                <Image 
                                                    src={img.beforeImageUrl || 'https://placehold.co/150x100'} 
                                                    alt="Before"
                                                    width={150}
                                                    height={100}
                                                    className="rounded-md object-cover"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Image 
                                                    src={img.afterImageUrl || 'https://placehold.co/150x100'} 
                                                    alt="After"
                                                    width={150}
                                                    height={100}
                                                    className="rounded-md object-cover"
                                                />
                                            </TableCell>
                                             <TableCell>
                                                <Image 
                                                    src={img.stitchedImageUrl || 'https://placehold.co/150x100'} 
                                                    alt="Stitched"
                                                    width={150}
                                                    height={100}
                                                    className="rounded-md object-cover"
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{img.title}</TableCell>
                                            <TableCell>
                                                {img.isGenerated ? (
                                                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                                                        <CheckCircle className="mr-1 h-3 w-3" /> Generated
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">
                                                        <Clock className="mr-1 h-3 w-3" /> Pending
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                         <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <ImageIcon className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No Gallery Items</h3>
                            <p className="mt-1 text-sm">No recent 'before & after' images were found.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

