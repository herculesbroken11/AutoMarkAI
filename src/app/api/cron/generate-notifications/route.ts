

import { NextResponse } from 'next/server';
import { collection, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { generatePushNotification } from '@/ai/replicate';
import { differenceInDays, fromUnixTime, format, startOfDay } from 'date-fns';

// Enhanced AI notification generator using Replicate
async function generateSmartNotification(params: {
    trigger: string;
    customerName: string;
    vehicleInfo: any;
    serviceName?: string;
    serviceDate?: Date;
    daysSinceService?: number;
    weatherData?: any;
    seasonalContext?: string;
    loyaltyPoints?: number;
    ceramicCoatingDate?: Date;
}) {
    const {
        trigger,
        customerName,
        vehicleInfo,
        serviceName,
        serviceDate,
        daysSinceService,
        weatherData,
        seasonalContext,
        loyaltyPoints,
        ceramicCoatingDate
    } = params;

    // Build context-rich prompt for Replicate
    let contextPrompt = `You are an expert automotive detailing service assistant. Generate a personalized, urgent, and professional push notification.

CUSTOMER DETAILS:
- Name: ${customerName}
- Vehicle: ${vehicleInfo?.year || ''} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''} (${vehicleInfo?.color || 'Unknown'} color)
- Last Service: ${serviceName || 'N/A'} on ${serviceDate ? format(serviceDate, 'MMM dd, yyyy') : 'Unknown'}
- Days Since Last Visit: ${daysSinceService || 'Unknown'}
${loyaltyPoints ? `- Loyalty Points: ${loyaltyPoints} points available` : ''}

TRIGGER TYPE: ${trigger}
`;

    // Add specific context based on trigger type
    switch (trigger) {
        case 'system_welcome':
             contextPrompt += `
SYSTEM WELCOME MESSAGE:
- This is the customer's first interaction or no other specific trigger was met.
- The goal is to introduce them to the smart notification system.

Generate a friendly, welcoming notification that:
1. Greets the customer by name.
2. Mentions their specific vehicle (e.g., ${vehicleInfo?.make || 'your vehicle'}).
3. Explains that in the future, they will receive personalized alerts like weather warnings, service reminders, and loyalty promotions.
4. Keeps the tone professional and informative, not sales-y.

Example style: "Hi ${customerName}, welcome! We'll use this system to send you smart alerts for your ${vehicleInfo?.make}, like weather warnings and service reminders."`;
            break;

        case 'ceramic_maintenance':
            const daysUntilDue = ceramicCoatingDate 
                ? 180 - differenceInDays(new Date(), ceramicCoatingDate)
                : 12;
            contextPrompt += `
CERAMIC COATING MAINTENANCE:
- Original coating applied: ${ceramicCoatingDate ? format(ceramicCoatingDate, 'MMM dd, yyyy') : serviceDate ? format(serviceDate, 'MMM dd, yyyy') : 'N/A'}
- Maintenance due in: ${daysUntilDue} days
- Coating lifespan: 6 months (180 days)

Generate a notification that:
1. Reminds them their ceramic coating needs maintenance
2. Mentions the specific number of days until it's due
3. Emphasizes protection benefits (shine, water repellent, UV protection)
4. Creates urgency without being pushy
5. Includes a call-to-action to book now

Example style: "Your ceramic coating is due for maintenance in ${daysUntilDue} days. Keep your ${vehicleInfo?.make} protected and gleaming — book your touch-up now!"`;
            break;

        case 'weather_rain':
            contextPrompt += `
WEATHER ALERT - RAIN INCOMING:
${weatherData ? `- Current conditions: ${weatherData.description || 'Rain expected'}
- Temperature: ${weatherData.temp || 'N/A'}°C
- Precipitation: ${weatherData.precipitation || 'Heavy'} rain` : '- Heavy rain forecast for tonight'}

Generate a notification that:
1. Alerts about incoming rain/wet conditions
2. Recommends undercarriage wash or protective coating
3. Mentions road salt, dirt, or grime buildup risks
4. Creates urgency (rain starts soon)
5. Offers specific service recommendation

Example style: "Rain is hitting tonight — road grime and salt will attack your ${vehicleInfo?.make}. Book an undercarriage wash before the storm!"`;
            break;

        case 'weather_snow':
            contextPrompt += `
WEATHER ALERT - SNOW/SALT WARNING:
${weatherData ? `- Snow forecast: ${weatherData.description || 'Heavy snow'}
- Road salt treatment: Active
- Temperature: ${weatherData.temp || 'Below freezing'}°C` : '- Snow and road salt incoming'}

Generate a notification that:
1. Warns about road salt damage to paint and undercarriage
2. Emphasizes corrosion prevention
3. Recommends immediate protective wash
4. Creates strong urgency (salt is corrosive)
5. Mentions winter protection benefits

Example style: "Salt is hitting the roads tonight — protect your ${vehicleInfo?.make} from corrosion. Book an undercarriage wash + wax now!"`;
            break;

        case 'weather_uv':
            contextPrompt += `
WEATHER ALERT - HIGH UV INDEX:
${weatherData ? `- UV Index: ${weatherData.uvIndex || '8+'} (Very High)
- Temperature: ${weatherData.temp || '32'}°C
- Sun exposure: Extreme` : '- Extreme UV conditions this week'}

Generate a notification that:
1. Warns about UV damage to paint and interior
2. Recommends ceramic coating or paint sealant
3. Mentions fading, oxidation, and cracking risks
4. Creates urgency (UV damage is permanent)
5. Offers protective solution

Example style: "UV index is at ${weatherData?.uvIndex || '9'} — your ${vehicleInfo?.make}'s paint is at risk! Ceramic coating provides 6-month UV protection. Book now!"`;
            break;

        case 'weather_pollen':
            contextPrompt += `
SEASONAL ALERT - POLLEN SPIKE:
${seasonalContext || '- High pollen count this week'}
- Allergen level: High
- Recommended: Exterior wash + interior sanitization

Generate a notification that:
1. Alerts about pollen buildup on vehicle
2. Mentions both exterior (paint damage) and interior (allergen) concerns
3. Recommends full detail or wash + interior clean
4. Creates health/cleanliness urgency
5. Offers seasonal package deal if applicable

Example style: "Pollen is coating your ${vehicleInfo?.make} — it's damaging paint and triggering allergies. Book our Spring Clean package today!"`;
            break;

        case 'seasonal_winter':
            contextPrompt += `
SEASONAL REMINDER - WINTER PROTECTION:
- Season: Winter is here
- Risks: Road salt, ice, snow, harsh conditions
- Recommended: Winter protection package

Generate a notification that:
1. Reminds about winter's harsh effects on vehicles
2. Recommends winterization service (undercoat, wax, interior protect)
3. Mentions specific winter risks (salt, moisture, cold)
4. Creates seasonal urgency
5. Offers winter package if available

Example style: "Winter is here — protect your ${vehicleInfo?.make} from salt and snow damage. Our Winter Shield package keeps you safe all season!"`;
            break;

        case 'seasonal_summer':
            contextPrompt += `
SEASONAL REMINDER - SUMMER CARE:
- Season: Summer heat is here
- Risks: UV damage, heat, dust, tree sap
- Recommended: UV protection + deep clean

Generate a notification that:
1. Alerts about summer's damaging effects
2. Recommends ceramic coating or paint protection
3. Mentions UV, heat, and contaminant risks
4. Creates seasonal urgency
5. Offers summer package if available

Example style: "Summer heat is here — UV rays are fading your ${vehicleInfo?.make}'s paint. Ceramic coating provides 6-month protection. Book now!"`;
            break;

        case 'loyalty_reward':
            contextPrompt += `
LOYALTY REWARD ALERT:
- Customer loyalty points: ${loyaltyPoints || 500} points
- Reward available: Special discount or free service
- Customer status: Valued repeat customer

Generate a notification that:
1. Thanks them for their loyalty
2. Announces their available points/reward
3. Explains what they can redeem (discount, free service, upgrade)
4. Creates excitement and appreciation
5. Encourages them to use rewards soon

Example style: "You've earned ${loyaltyPoints || 500} loyalty points! Redeem them for 20% off your next detail or a free interior clean. Book now!"`;
            break;

        case 'damage_report':
            contextPrompt += `
AI DAMAGE REPORT ALERT:
- Potential issue detected: From service photos or inspection
- Concern: Paint damage, scratches, oxidation, or maintenance need
- Recommended: Corrective service

Generate a notification that:
1. Gently alerts about detected issue
2. Explains what was noticed (from AI analysis or tech inspection)
3. Recommends specific corrective service
4. Creates helpful urgency (prevent further damage)
5. Offers expert solution

Example style: "Our AI detected minor scratches on your ${vehicleInfo?.make}'s hood. Prevent rust with our paint correction service — book a free inspection!"`;
            break;

        case 'general_follow_up':
        default:
            contextPrompt += `
GENERAL FOLLOW-UP:
- Last service: ${daysSinceService || '90+'} days ago
- Service type: ${serviceName || 'Detail'}
- Recommended: Maintenance wash or new service

Generate a notification that:
1. Friendly reminder it's been a while
2. Mentions their vehicle might need attention
3. Recommends maintenance wash or new detail
4. Creates gentle urgency (vehicle needs care)
5. Offers easy booking

Example style: "It's been ${daysSinceService || '90'} days since your last ${serviceName || 'detail'} — your ${vehicleInfo?.make} is due for care. Book a maintenance wash today!"`;
    }

    contextPrompt += `

REQUIREMENTS:
- Keep notification under 160 characters (SMS-friendly)
- Use urgent but professional tone
- Include specific vehicle details
- Add clear call-to-action
- Make it personal and relevant
- NO generic messages

Generate ONLY the notification message, nothing else:`;

    // Use the imported generatePushNotification function from replicate.ts
    // This assumes REPLICATE_API_KEY is handled there.
    return await generatePushNotification({ trigger: params.trigger, context: contextPrompt });
}

// Fetch weather data (implement your weather API)
async function getWeatherData(location?: string) {
    if (!process.env.WEATHER_API_KEY) {
        console.log("WEATHER_API_KEY not found, skipping weather check.");
        return null;
    }
    try {
        // Replace with your weather API (OpenWeatherMap, WeatherAPI, etc.)
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${location || 'London,UK'}&appid=${process.env.WEATHER_API_KEY}&units=metric`
        );
        
        if (!response.ok) return null;
        
        const data = await response.json();
        return {
            temp: data.main?.temp,
            description: data.weather?.[0]?.description,
            precipitation: data.rain?.['1h'] ? 'Heavy' : 'Light',
            uvIndex: data.uvi || null,
        };
    } catch (error) {
        console.error('[WEATHER_API_ERROR]', error);
        return null;
    }
}

// Get current season
function getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
}

// Main trigger checking function
async function checkTriggersAndGenerate(booking: any, logs: string[]): Promise<any | null> {
    const now = new Date();
    
    const bookingDate = booking.bookingDate?.seconds 
        ? fromUnixTime(booking.bookingDate.seconds) 
        : new Date();
    const daysSinceBooking = differenceInDays(now, bookingDate);

    // Fetch weather data
    const weatherData = await getWeatherData(booking.location);
    const currentSeason = getCurrentSeason();

    let notificationToCreate = null;
    let triggerType = '';

    // --- Trigger Priority Order ---
    // 1. Ceramic Coating Maintenance
    if (booking.serviceName?.toLowerCase().includes('ceramic') && 
        daysSinceBooking > 170 && 
        daysSinceBooking < 190) {
        triggerType = 'ceramic_maintenance';
        logs.push(`[Trigger Met] ${triggerType} for booking ${booking.bookingNumber}.`);
        
        const message = await generateSmartNotification({
            trigger: triggerType,
            customerName: booking.customerName,
            vehicleInfo: booking.vehicleInfo,
            serviceName: booking.serviceName,
            serviceDate: bookingDate,
            daysSinceService: daysSinceBooking,
            ceramicCoatingDate: bookingDate,
        });

        notificationToCreate = { message, triggerType };
    }
    
    // 2. Weather Alerts
    if (!notificationToCreate && weatherData) {
        if (weatherData.description?.includes('rain') && daysSinceBooking > 30) {
            triggerType = 'weather_rain';
            logs.push(`[Trigger Met] ${triggerType} for booking ${booking.bookingNumber}.`);
            const message = await generateSmartNotification({
                trigger: triggerType,
                customerName: booking.customerName,
                vehicleInfo: booking.vehicleInfo,
                weatherData: weatherData,
            });
            notificationToCreate = { message, triggerType };
        } else if (weatherData.uvIndex && weatherData.uvIndex > 7 && daysSinceBooking > 60) {
            triggerType = 'weather_uv';
            logs.push(`[Trigger Met] ${triggerType} for booking ${booking.bookingNumber}.`);
            const message = await generateSmartNotification({
                trigger: triggerType,
                customerName: booking.customerName,
                vehicleInfo: booking.vehicleInfo,
                weatherData: weatherData,
            });
            notificationToCreate = { message, triggerType };
        }
    }

    // 3. Seasonal Alerts
    if (!notificationToCreate && currentSeason === 'winter' && daysSinceBooking > 45) {
        triggerType = 'seasonal_winter';
        logs.push(`[Trigger Met] ${triggerType} for booking ${booking.bookingNumber}.`);
        const message = await generateSmartNotification({
            trigger: triggerType,
            customerName: booking.customerName,
            vehicleInfo: booking.vehicleInfo,
            seasonalContext: 'Winter protection needed',
        });
        notificationToCreate = { message, triggerType };
    }

    // 4. Loyalty Rewards
    // @ts-ignore
    if (!notificationToCreate && booking.loyaltyPoints && booking.loyaltyPoints >= 500 && daysSinceBooking > 30) {
        triggerType = 'loyalty_reward';
        logs.push(`[Trigger Met] ${triggerType} for booking ${booking.bookingNumber}.`);
        const message = await generateSmartNotification({
            trigger: triggerType,
            customerName: booking.customerName,
            vehicleInfo: booking.vehicleInfo,
            // @ts-ignore
            loyaltyPoints: booking.loyaltyPoints,
        });
        notificationToCreate = { message, triggerType };
    }

    // 5. General Follow-up (fallback if no other trigger met)
    if (!notificationToCreate && daysSinceBooking > 90) { 
        triggerType = 'general_follow_up';
        logs.push(`[Trigger Met] ${triggerType} for booking ${booking.bookingNumber}.`);
        const message = await generateSmartNotification({
            trigger: triggerType,
            customerName: booking.customerName,
            vehicleInfo: booking.vehicleInfo,
            serviceName: booking.serviceName,
            serviceDate: bookingDate,
            daysSinceService: daysSinceBooking,
        });
        notificationToCreate = { message, triggerType };
    }

    // If a notification was generated, format it for saving
    if (notificationToCreate) {
        return {
            customerId: booking.customerId,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone, // Make sure this field exists in your booking data
            customerName: booking.customerName,
            message: notificationToCreate.message,
            triggerType: notificationToCreate.triggerType,
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            vehicleInfo: booking.vehicleInfo,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
    }

    return null;
}

export async function GET(request: Request) {
    const logs: string[] = [];
    
    const authToken = (request.headers.get('authorization') || '').split('Bearer ').at(1);
    if (process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
        logs.push('Authentication failed: Invalid cron secret.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        logs.push('🤖 Starting AI notification generation...');

        const bookingsSnapshot = await getDocs(collection(galleryFirestore, 'bookings'));
        if (bookingsSnapshot.empty) {
            logs.push('❌ No bookings found. Exiting.');
            return NextResponse.json({ message: 'No bookings found to process.', logs });
        }

        const notificationsRef = collection(galleryFirestore, 'enginenotifications');
        
        let totalNotificationsGenerated = 0;

        for (const bookingDoc of bookingsSnapshot.docs) {
            const booking = { id: bookingDoc.id, ...bookingDoc.data() };

            if (!booking.customerId) {
                logs.push(`⏭️ Skipping booking ${booking.bookingNumber}: No customer ID.`);
                continue;
            }
            
            logs.push(`📋 Processing: ${booking.bookingNumber} for ${booking.customerName}`);
            
            const notificationData = await checkTriggersAndGenerate(booking, logs);
            
            if (notificationData) {
                // Check if a notification for this trigger type already exists for this booking
                const q = query(
                    notificationsRef,
                    where('bookingId', '==', notificationData.bookingId),
                    where('triggerType', '==', notificationData.triggerType)
                );
                const existingNotif = await getDocs(q);

                if (existingNotif.empty) {
                    await addDoc(notificationsRef, notificationData);
                    logs.push(`[✓] Saved AI notification for ${notificationData.customerName}: "${notificationData.message}"`);
                    totalNotificationsGenerated++;
                } else {
                    logs.push(`- Skipping: A notification for trigger '${notificationData.triggerType}' already exists for this booking.`);
                }
            } else {
                logs.push(`- No relevant triggers met for ${booking.bookingNumber}.`);
            }
        }

        const successMessage = `✅ Generation complete! Created ${totalNotificationsGenerated} new AI-powered notifications.`;
        logs.push(successMessage);
        
        return NextResponse.json({ 
            success: true,
            message: successMessage, 
            totalGenerated: totalNotificationsGenerated, 
            logs 
        });

    } catch (error: any) {
        console.error('[GENERATE_NOTIFICATIONS_ERROR]', error);
        logs.push(`❌ Error: ${error.message}`);
        return NextResponse.json({ 
            success: false,
            error: 'An unexpected error occurred.', 
            logs 
        }, { status: 500 });
    }
}
