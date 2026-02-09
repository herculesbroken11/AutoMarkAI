/**
 * Admin API Route: Rate Caps Management
 * Phase 1: Configure posting rate limits per platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

interface PlatformCaps {
  maxPerHour: number;
  maxPerDay: number;
  cooldownMinutes: number;
}

/**
 * GET - Get rate cap settings
 */
export async function GET(request: NextRequest) {
  try {
    const settingsRef = doc(galleryFirestore, 'system_settings', 'rate_caps');
    const docSnap = await getDoc(settingsRef);
    
    if (!docSnap.exists()) {
      return NextResponse.json({
        platforms: {
          instagram: { maxPerHour: 5, maxPerDay: 20, cooldownMinutes: 10 },
          facebook: { maxPerHour: 5, maxPerDay: 20, cooldownMinutes: 10 },
          youtube: { maxPerHour: 3, maxPerDay: 10, cooldownMinutes: 20 },
          tiktok: { maxPerHour: 5, maxPerDay: 20, cooldownMinutes: 10 },
        },
        autoPauseOnCap: true,
        alertOnCap: true,
        message: 'Using default rate cap settings.',
      });
    }
    
    const data = docSnap.data();
    return NextResponse.json({
      platforms: data.platforms || {},
      autoPauseOnCap: data.autoPauseOnCap !== false,
      alertOnCap: data.alertOnCap !== false,
      last_updated: data.last_updated,
    });
  } catch (error: any) {
    console.error('[RATE_CAPS_API] Error getting rate cap settings:', error);
    return NextResponse.json(
      { error: 'Failed to get rate cap settings', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Update rate cap settings
 * Body: { platform: string, maxPerHour?: number, maxPerDay?: number, cooldownMinutes?: number }
 * OR: { autoPauseOnCap?: boolean, alertOnCap?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, maxPerHour, maxPerDay, cooldownMinutes, autoPauseOnCap, alertOnCap } = body;
    
    const settingsRef = doc(galleryFirestore, 'system_settings', 'rate_caps');
    const settingsSnap = await getDoc(settingsRef);
    
    const currentSettings = settingsSnap.exists() ? settingsSnap.data() : {
      platforms: {},
      autoPauseOnCap: true,
      alertOnCap: true,
    };
    
    const now = new Date().toISOString();
    const updateData: any = {
      last_updated: now,
    };
    
    // Update platform-specific caps
    if (platform) {
      const platforms = currentSettings.platforms || {};
      platforms[platform.toLowerCase()] = {
        ...platforms[platform.toLowerCase()],
        maxPerHour: maxPerHour !== undefined ? maxPerHour : platforms[platform.toLowerCase()]?.maxPerHour || 5,
        maxPerDay: maxPerDay !== undefined ? maxPerDay : platforms[platform.toLowerCase()]?.maxPerDay || 20,
        cooldownMinutes: cooldownMinutes !== undefined ? cooldownMinutes : platforms[platform.toLowerCase()]?.cooldownMinutes || 10,
      };
      updateData.platforms = platforms;
    }
    
    // Update global settings
    if (autoPauseOnCap !== undefined) {
      updateData.autoPauseOnCap = autoPauseOnCap;
    } else {
      updateData.autoPauseOnCap = currentSettings.autoPauseOnCap !== false;
    }
    
    if (alertOnCap !== undefined) {
      updateData.alertOnCap = alertOnCap;
    } else {
      updateData.alertOnCap = currentSettings.alertOnCap !== false;
    }
    
    await setDoc(settingsRef, updateData, { merge: true });
    
    return NextResponse.json({
      success: true,
      message: platform 
        ? `Rate caps updated for ${platform}` 
        : 'Rate cap settings updated',
      ...updateData,
    });
  } catch (error: any) {
    console.error('[RATE_CAPS_API] Error updating rate cap settings:', error);
    return NextResponse.json(
      { error: 'Failed to update rate cap settings', message: error.message },
      { status: 500 }
    );
  }
}
