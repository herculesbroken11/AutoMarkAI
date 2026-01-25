
'use server';

import nodemailer from 'nodemailer';
import { doc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// Fetches SMTP settings from Firestore
async function getSmtpConfig() {
  try {
    const settingsRef = doc(galleryFirestore, 'settings', 'smtp');
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const port = parseInt(data.port, 10);
      
      const config: any = {
        host: data.host,
        port: port,
        auth: {
          user: data.user,
          pass: data.pass,
        },
        // Format the from address: "Sender Name" <email@example.com>
        from: `"${data.senderName}" <${data.from}>`,
      };
      
      // Handle encryption
      if (data.encryption === 'ssl' || data.encryption === 'tls') {
        config.secure = port === 465; // SSL typically uses port 465 and implies secure: true
        if (data.encryption === 'tls') {
            config.requireTLS = true;
        }
      }

      return config;
    } else {
      console.warn('SMTP settings not found in Firestore. Email sending will fail.');
      return null;
    }
  } catch (error) {
    console.error('Error fetching SMTP config from Firestore:', error);
    return null;
  }
}

export const sendEmail = async (data: EmailPayload) => {
  const config = await getSmtpConfig();

  if (!config) {
    throw new Error('SMTP configuration is missing or could not be fetched. Cannot send email.');
  }

  const transporter = nodemailer.createTransport(config);

  const options = {
    from: config.from, // Use the pre-formatted 'from' address
    to: data.to,
    subject: data.subject,
    html: data.html,
  };

  try {
    const info = await transporter.sendMail(options);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
};

    