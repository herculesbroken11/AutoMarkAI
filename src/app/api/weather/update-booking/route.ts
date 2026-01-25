import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { z } from 'zod';

const schema = z.object({
  bookingId: z.string().min(1, { message: "bookingId is required." }),
  location: z.string().optional(),
});

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

// Fetches weather data from OpenWeatherMap
async function getWeatherData(location: string) {
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('WEATHER_API_KEY is not configured in your settings.');
    }

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

export async function POST(request: NextRequest) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    
    const validated = schema.safeParse(body);
    if (!validated.success) {
        const message = validated.error.errors.map(e => e.message).join(', ');
        return NextResponse.json({ error: message }, { status: 400 });
    }
    
    const { bookingId } = validated.data;
    const locationForWeather = validated.data.location || 'London,UK';

    try {
        const bookingRef = doc(galleryFirestore, 'bookings', bookingId);
        
        const docSnap = await getDoc(bookingRef);
        if (!docSnap.exists()) {
             return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
        }

        const weatherData = await getWeatherData(locationForWeather);

        await updateDoc(bookingRef, {
            weatherAtBooking: weatherData,
            location: docSnap.data().location || locationForWeather
        });

        return NextResponse.json({
            success: true,
            message: `Successfully updated weather for booking ${bookingId} using location: ${locationForWeather}.`,
            weatherData: weatherData
        });

    } catch (error: any) {
        console.error(`[API_UPDATE_WEATHER_ERROR] for booking ${bookingId}:`, error);
        return NextResponse.json({
            success: false,
            error: error.message || 'An internal server error occurred.'
        }, { status: 500 });
    }
}
