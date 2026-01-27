/**
 * Admin API Route: Posting Control (Kill Switch)
 * Phase 1: Global Kill Switch Toggle
 * 
 * Allows admins to pause/resume all publishing system-wide
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

/**
 * GET - Get current posting control status
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // For now, allow access (add auth in production)
    
    const settingsRef = doc(galleryFirestore, 'system_settings', 'posting');
    const docSnap = await getDoc(settingsRef);
    
    if (!docSnap.exists()) {
      return NextResponse.json({
        posting_paused: false,
        message: 'Posting is currently enabled (default state)',
      });
    }
    
    const data = docSnap.data();
    return NextResponse.json({
      posting_paused: data.posting_paused === true,
      paused_at: data.paused_at,
      paused_by: data.paused_by,
      paused_reason: data.paused_reason,
      last_updated: data.last_updated,
    });
  } catch (error: any) {
    console.error('[POSTING_CONTROL_API] Error getting status:', error);
    return NextResponse.json(
      { error: 'Failed to get posting control status', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Update posting control status (pause/resume)
 * Body: { posting_paused: boolean, paused_reason?: string, actor?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // For now, allow access (add auth in production)
    
    const body = await request.json();
    const { posting_paused, paused_reason, actor } = body;
    
    if (typeof posting_paused !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request. posting_paused must be a boolean.' },
        { status: 400 }
      );
    }
    
    const settingsRef = doc(galleryFirestore, 'system_settings', 'posting');
    const now = new Date().toISOString();
    
    const updateData: any = {
      posting_paused,
      last_updated: now,
    };
    
    if (posting_paused) {
      // When pausing, record when and why
      updateData.paused_at = now;
      updateData.paused_by = actor || 'system';
      if (paused_reason) {
        updateData.paused_reason = paused_reason;
      }
    } else {
      // When resuming, clear pause metadata
      updateData.resumed_at = now;
      updateData.resumed_by = actor || 'system';
    }
    
    await setDoc(settingsRef, updateData, { merge: true });
    
    return NextResponse.json({
      success: true,
      message: posting_paused 
        ? 'Posting has been paused globally. All publish attempts will be blocked.' 
        : 'Posting has been resumed. Publish attempts will be allowed.',
      posting_paused,
      last_updated: now,
    });
  } catch (error: any) {
    console.error('[POSTING_CONTROL_API] Error updating status:', error);
    return NextResponse.json(
      { error: 'Failed to update posting control status', message: error.message },
      { status: 500 }
    );
  }
}
