"use client";

import { useState, useMemo, useTransition } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { format, fromUnixTime } from 'date-fns';
import PageHeader from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cloud, CloudSun, CloudFog, Sun, Snowflake, Loader2, Calendar, User, Car, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const BookingWeatherCard = ({ booking, onFetch, isFetching }: { booking: any, onFetch: (booking: any) => void, isFetching: boolean }) => {
    const bookingDate = booking.bookingDate?.seconds
        ? format(fromUnixTime(booking.bookingDate.seconds), "MMM d, yyyy 'at' h:mm a")
        : "No date";

    const hasWeatherData = !!booking.weatherAtBooking;

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center gap-4">
                         <div className="p-3 rounded-full bg-blue-100 text-blue-800">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-base">{booking.serviceName}</p>
                            <p className="text-sm text-muted-foreground">Booking #{booking.bookingNumber}</p>
                        </div>
                    </div>
                    <div className="pl-14 text-sm text-muted-foreground space-y-1">
                        <p className="flex items-center gap-2"><User className="h-4 w-4" /> {booking.customerName} ({booking.customerEmail})</p>
                        <p className="flex items-center gap-2"><Car className="h-4 w-4" /> {booking.vehicleInfo?.year} {booking.vehicleInfo?.make} {booking.vehicleInfo?.model}</p>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                    {hasWeatherData ? (
                        <div className="flex flex-col items-center text-green-600">
                            <CloudSun className="h-8 w-8 mb-1"/>
                            <p className="text-sm font-semibold">Weather Synced</p>
                            <p className="text-xs">{booking.weatherAtBooking.condition} at {booking.weatherAtBooking.temp}°C</p>
                        </div>
                    ) : (
                         <div className="flex flex-col items-center text-gray-500">
                            <CloudFog className="h-8 w-8 mb-1"/>
                            <p className="text-sm font-semibold">No Weather Data</p>
                            <p className="text-xs">Location: {booking.location || 'Not set'}</p>
                        </div>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onFetch(booking)}
                        disabled={isFetching}
                    >
                        {isFetching ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Fetching...
                            </>
                        ) : hasWeatherData ? (
                            "Re-fetch Weather"
                        ) : (
                            "Fetch Weather"
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default function WeatherSyncPage() {
    const { toast } = useToast();
    const [isFetching, startFetchingTransition] = useTransition();
    const [fetchingId, setFetchingId] = useState<string | null>(null);

    const bookingsQuery = useMemo(() => query(
        collection(galleryFirestore, 'bookings'),
        orderBy('createdAt', 'desc')
    ), []);
    const [bookingsCollection, bookingsLoading, bookingsError] = useCollection(bookingsQuery);

    const bookings = useMemo(() => {
        if (!bookingsCollection) return [];
        return bookingsCollection.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, [bookingsCollection]);

    const handleFetchWeather = (booking: any) => {
        // We can now always attempt to fetch, as the backend has a fallback.
        setFetchingId(booking.id);
        startFetchingTransition(async () => {
            try {
                const response = await fetch('/api/weather/update-booking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        bookingId: booking.id, 
                        location: booking.location // Pass location if it exists
                    }),
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                toast({
                    title: 'Weather Synced!',
                    description: result.message || `Successfully updated weather for booking #${booking.bookingNumber}.`,
                });

            } catch (error: any) {
                console.error("Weather fetch error:", error);
                toast({
                    title: 'Sync Failed',
                    description: error.message || 'An unknown error occurred.',
                    variant: 'destructive',
                });
            } finally {
                setFetchingId(null);
            }
        });
    };
    
    const renderContent = () => {
        if (bookingsLoading) {
            return (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
                    ))}
                </div>
            );
        }

        if (bookingsError) {
            return <div className="text-red-500 text-center">Error: {bookingsError.message}</div>;
        }
        
        if (bookings.length === 0) {
            return (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Calendar className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Bookings Found</h3>
                    <p className="mt-1 text-sm">When bookings are created, they will appear here for weather data synchronization.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {bookings.map(booking => (
                    <BookingWeatherCard
                        key={booking.id}
                        booking={booking}
                        onFetch={handleFetchWeather}
                        isFetching={isFetching && fetchingId === booking.id}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Weather Data Sync"
                description="Fetch and attach real-time weather data to bookings to enable smarter notifications."
            />
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>How It Works</AlertTitle>
              <AlertDescription>
                This tool fetches current weather data using the location stored in a booking. If a booking has no location, it will use a default of 'London, UK'. The fetched data is then saved back to the booking record for use in AI notification generation. You will need a valid <code className="font-mono bg-muted p-1 rounded">WEATHER_API_KEY</code> from OpenWeatherMap.
              </AlertDescription>
            </Alert>
            
            <Card>
                <CardHeader>
                    <CardTitle>Bookings List</CardTitle>
                    <CardDescription>
                        Click "Fetch Weather" to sync the latest weather data for a booking.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
}

    