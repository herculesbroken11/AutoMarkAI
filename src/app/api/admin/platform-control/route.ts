/**
 * Admin API Route: Platform Control (Per-Platform Toggles)
 * Phase 1: Enable/Disable Individual Platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

/**
 * GET - Get platform settings
 */
export async function GET(request: NextRequest) {
  try {
    const platformSettingsRef = doc(galleryFirestore, 'system_settings', 'platforms');
    const docSnap = await getDoc(platformSettingsRef);
    
    if (!docSnap.exists()) {
      return NextResponse.json({
        platforms: {},
        message: 'No platform settings configured. All platforms default to enabled.',
      });
    }
    
    const data = docSnap.data();
    return NextResponse.json({
      platforms: data.platforms || {},
      last_updated: data.last_updated,
    });
  } catch (error: any) {
    console.error('[PLATFORM_CONTROL_API] Error getting platform settings:', error);
    return NextResponse.json(
      { error: 'Failed to get platform settings', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Update platform settings
 * Body: { platform: string, enabled: boolean, reason?: string, actor?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, enabled, reason, actor } = body;
    
    if (!platform || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request. platform (string) and enabled (boolean) are required.' },
        { status: 400 }
      );
    }
    
    const platformSettingsRef = doc(galleryFirestore, 'system_settings', 'platforms');
    const platformSettingsSnap = await getDoc(platformSettingsRef);
    
    const currentSettings = platformSettingsSnap.exists() ? platformSettingsSnap.data() : {};
    const platforms = currentSettings.platforms || {};
    
    const now = new Date().toISOString();
    
    platforms[platform.toLowerCase()] = {
      ...platforms[platform.toLowerCase()],
      enabled,
      last_updated: now,
      updated_by: actor || 'system',
    };
    
    if (!enabled) {
      platforms[platform.toLowerCase()].pausedAt = now;
      platforms[platform.toLowerCase()].pausedBy = actor || 'system';
      if (reason) {
        platforms[platform.toLowerCase()].pausedReason = reason;
      }
    } else {
      platforms[platform.toLowerCase()].resumedAt = now;
      platforms[platform.toLowerCase()].resumedBy = actor || 'system';
      // Clear auto-pause flags when manually enabled
      delete platforms[platform.toLowerCase()].autoPausedAt;
      delete platforms[platform.toLowerCase()].autoPausedReason;
    }
    
    await setDoc(platformSettingsRef, {
      platforms,
      last_updated: now,
    }, { merge: true });
    
    return NextResponse.json({
      success: true,
      message: `Platform ${platform} has been ${enabled ? 'enabled' : 'disabled'}.`,
      platform: platform.toLowerCase(),
      enabled,
      last_updated: now,
    });
  } catch (error: any) {
    console.error('[PLATFORM_CONTROL_API] Error updating platform settings:', error);
    return NextResponse.json(
      { error: 'Failed to update platform settings', message: error.message },
      { status: 500 }
    );
  }
}
