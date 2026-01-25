
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, limit, doc, updateDoc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

// Fetches weather settings from Firestore
async function getApiKey() {
  try {
    const settingsRef = doc(galleryFirestore, 'settings', 'weather');
    const docSnap = await getDoc(settingsRef);
    if (docSnap.exists() && docSnap.data()?.apiKey) {
      return docSnap.data().apiKey;
    }
    return null;
  } catch (error) {
    console.error('Error fetching Weather API key:', error);
    return null;
  }
}

async function getWeatherData(location: string, apiKey: string) {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=metric`
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenWeatherMap API error: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
            temp: data.main?.temp,
            condition: data.weather?.[0]?.main,
            description: data.weather?.[0]?.description,
            humidity: data.main?.humidity,
            uvIndex: null, 
            precipitation: data.rain?.['1h'] || 0,
            fetchedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('[WEATHER_API_ERROR]', error);
        throw error;
    }
}


export async function GET(request: Request) {
    const logs: string[] = [];

    // Secure the endpoint with a secret key
    const authToken = (request.headers.get('authorization') || '').split('Bearer ').at(1);
    if (process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
        logs.push('Authentication failed: Invalid cron secret.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        logs.push('Cron job started: Syncing weather data for bookings...');

        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error("OpenWeatherMap API Key is not configured in settings. Cron job cannot run.");
        }

        // Find bookings that do not have weather data. Process up to 5 per run.
        const q = query(
            collection(galleryFirestore, 'bookings'),
            where('weatherAtBooking', '==', null),
            limit(5)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            logs.push('No bookings found needing a weather data sync.');
            return NextResponse.json({ message: 'No new bookings to sync.', logs });
        }
        
        logs.push(`Found ${querySnapshot.size} bookings to process.`);

        for (const docSnap of querySnapshot.docs) {
            const booking = { id: docSnap.id, ...docSnap.data() };
            const location = booking.location || 'London,UK'; // Default location
            
            try {
                const weatherData = await getWeatherData(location, apiKey);
                const bookingRef = doc(galleryFirestore, 'bookings', booking.id);
                await updateDoc(bookingRef, { weatherAtBooking: weatherData });
                logs.push(`Successfully synced weather for booking #${booking.bookingNumber} in ${location}.`);
            } catch (error: any) {
                logs.push(`Failed to sync weather for booking ${booking.id}: ${error.message}`);
                // Continue to the next booking even if one fails
            }
        }
        
        return NextResponse.json({ message: 'Weather sync process completed.', logs });
    } catch (error: any) {
        console.error('[CRON_WEATHER_SYNC_ERROR]', error);
        logs.push(`An unexpected error occurred: ${error.message}`);
        return NextResponse.json({ error: 'An unexpected error occurred during the weather sync cron job.', logs }, { status: 500 });
    }
}
