

import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, Timestamp, limit } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { sendEmail } from '@/lib/email';
// import Twilio from 'twilio'; // STEP 1: Uncomment this after running `npm install twilio`

// Helper to check authentication
function checkAuth(request: Request) {
    const authToken = (request.headers.get('authorization') || '').split('Bearer ').at(1);
    if (process.env.CRON_SECRET && authToken !== process.env.CRON_SECRET) {
        return { authorized: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { authorized: true, response: null };
}

// Fetches Twilio settings from Firestore
async function getTwilioConfig() {
    try {
        const settingsRef = doc(galleryFirestore, 'settings', 'twilio');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error('Error fetching Twilio config:', error);
        return null;
    }
}

export async function GET(request: Request) {
    const logs: string[] = [];
    
    const auth = checkAuth(request);
    if (!auth.authorized) {
        return auth.response;
    }

    try {
        logs.push('Cron job started: Sending pending notifications...');

        // Fetch configs
        const twilioConfig = await getTwilioConfig();
        const notificationsRef = collection(galleryFirestore, 'enginenotifications');

        // --- Anti-Spam: Send only one notification per run to distribute load ---
        const q = query(
            notificationsRef,
            where('status', '==', 'pending'),
            limit(1) // Process one notification at a time.
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            logs.push('No pending notifications found to send.');
            return NextResponse.json({ message: 'No pending notifications found.', logs });
        }

        const notificationDoc = querySnapshot.docs[0];
        const notification = { id: notificationDoc.id, ...notificationDoc.data() };
        logs.push(`Processing notification ${notification.id} for ${notification.customerEmail}`);
        
        let emailSent = false;
        let smsSent = false;
        let finalStatus: 'sent' | 'failed' | 'partial_failure' = 'sent';
        let errors: string[] = [];

        try {
            // --- EMAIL SENDING ---
            if (notification.customerEmail) {
                const emailHtml = `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>A Quick Update from Porters AutoMarkAI</h2>
                        <p>${notification.message}</p>
                        <br/>
                        <p>Best,</p>
                        <p>The Porters AutoMarkAI Team</p>
                    </div>
                `;
                await sendEmail({
                    to: notification.customerEmail,
                    subject: 'A Quick Update from Your Detailing Team',
                    html: emailHtml,
                });
                emailSent = true;
                logs.push(`[SUCCESS] Sent email to ${notification.customerEmail}.`);
            }

            // --- SMS SENDING ---
            if (notification.customerPhone && twilioConfig?.accountSid && twilioConfig?.authToken) {
                try {
                    /*
                    // STEP 2: UNCOMMENT THIS BLOCK TO ENABLE SMS
                    const client = Twilio(twilioConfig.accountSid, twilioConfig.authToken);
                    await client.messages.create({
                        body: notification.message,
                        from: twilioConfig.fromNumber,
                        to: notification.customerPhone // Ensure customer data includes a phone number
                    });
                    smsSent = true;
                    logs.push(`[SUCCESS] Sent SMS to ${notification.customerPhone}.`);
                    */
                   logs.push('[SKIPPED] SMS sending is configured but commented out. Uncomment the block in `send-notifications/route.ts` to enable.');

                } catch (smsError: any) {
                    logs.push(`[FAILURE] Failed to send SMS to ${notification.customerPhone}: ${smsError.message}`);
                    errors.push(`SMS: ${smsError.message}`);
                }
            } else if (notification.customerPhone) {
                logs.push('[SKIPPED] Customer has phone, but Twilio is not configured in settings.');
            }

            // Determine final status
            if (errors.length > 0 && (emailSent || smsSent)) {
                finalStatus = 'partial_failure';
            } else if (errors.length > 0) {
                finalStatus = 'failed';
            }

            // 3. Update the notification status in Firestore
            const notificationRef = doc(galleryFirestore, 'enginenotifications', notification.id);
            await updateDoc(notificationRef, {
                status: finalStatus,
                sentAt: new Date().toISOString(),
                ...(errors.length > 0 && { error: errors.join('; ') })
            });

            const summary = `Notification processing complete for ${notification.id}. Final status: ${finalStatus}.`;
            logs.push(summary);
            return NextResponse.json({ message: summary, logs });

        } catch (emailError: any) {
            logs.push(`[FAILURE] Failed to send email to ${notification.customerEmail}: ${emailError.message}`);
            const notificationRef = doc(galleryFirestore, 'enginenotifications', notification.id);
            await updateDoc(notificationRef, {
                status: 'failed',
                error: emailError.message,
            });
            return NextResponse.json({ error: `Failed to send notification ${notification.id}.`, logs }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[CRON_SEND_NOTIFICATIONS_ERROR]', error);
        logs.push(`An unexpected error occurred: ${error.message}`);
        return NextResponse.json({ error: 'An unexpected error occurred.', logs }, { status: 500 });
    }
}

    
