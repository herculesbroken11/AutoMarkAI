/**
 * Media Validation Utilities
 * Phase 1: Media Pull Restriction (Drive-only, whitelisted folder)
 */

import { doc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import crypto from 'crypto';

export const MEDIA_NOT_WHITELISTED_ERROR = 'MEDIA_NOT_WHITELISTED';
export const MEDIA_INVALID_SOURCE_ERROR = 'MEDIA_INVALID_SOURCE';

/**
 * Get the whitelisted Drive root folder ID from settings
 */
export async function getWhitelistedDriveFolder(): Promise<string | null> {
  try {
    const settingsRef = doc(galleryFirestore, 'system_settings', 'media');
    const docSnap = await getDoc(settingsRef);
    
    if (!docSnap.exists()) {
      // Default to environment variable if settings don't exist
      return process.env.DRIVE_ASSETS_ROOT_FOLDER_ID || null;
    }
    
    const data = docSnap.data();
    return data.drive_assets_root_folder_id || process.env.DRIVE_ASSETS_ROOT_FOLDER_ID || null;
  } catch (error) {
    console.error('[MEDIA_VALIDATION] Error getting whitelisted folder:', error);
    return process.env.DRIVE_ASSETS_ROOT_FOLDER_ID || null;
  }
}

/**
 * Calculate file hash for verification
 */
export function calculateFileHash(content: Buffer | string): string {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validate that a Drive file is under the whitelisted root folder
 * @param fileId - Google Drive file ID
 * @param accessToken - Google Drive API access token
 * @returns Validation result with folder path
 */
export async function validateDriveFile(
  fileId: string,
  accessToken: string
): Promise<{
  isValid: boolean;
  folderPath?: string;
  error?: string;
  fileMetadata?: {
    id: string;
    name: string;
    mimeType: string;
    parents: string[];
    folderPath: string;
  };
}> {
  try {
    const rootFolderId = await getWhitelistedDriveFolder();
    
    if (!rootFolderId) {
      // If no whitelist configured, allow all (backward compatibility)
      // In production, this should be an error
      console.warn('[MEDIA_VALIDATION] No whitelisted folder configured. Allowing all files.');
      return { isValid: true };
    }
    
    // Get file metadata from Google Drive API
    const fileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,parents`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!fileResponse.ok) {
      return {
        isValid: false,
        error: `Failed to fetch file metadata: ${fileResponse.statusText}`,
      };
    }
    
    const fileData = await fileResponse.json();
    
    // Check if file is under root folder (recursively check parents)
    const isUnderRoot = await checkFileUnderFolder(
      fileData.parents || [],
      rootFolderId,
      accessToken
    );
    
    if (!isUnderRoot) {
      return {
        isValid: false,
        error: `${MEDIA_NOT_WHITELISTED_ERROR}: File ${fileId} is not under whitelisted root folder ${rootFolderId}`,
      };
    }
    
    // Get folder path for storage
    const folderPath = await getFolderPath(fileId, rootFolderId, accessToken);
    
    return {
      isValid: true,
      folderPath,
      fileMetadata: {
        id: fileData.id,
        name: fileData.name,
        mimeType: fileData.mimeType,
        parents: fileData.parents || [],
        folderPath,
      },
    };
  } catch (error: any) {
    console.error('[MEDIA_VALIDATION] Error validating Drive file:', error);
    return {
      isValid: false,
      error: `Validation error: ${error.message}`,
    };
  }
}

/**
 * Recursively check if file/folder is under the root folder
 */
async function checkFileUnderFolder(
  parentIds: string[],
  rootFolderId: string,
  accessToken: string
): Promise<boolean> {
  if (parentIds.includes(rootFolderId)) {
    return true;
  }
  
  // Check parent folders recursively
  for (const parentId of parentIds) {
    if (parentId === 'root') {
      return false; // Reached root, not under our folder
    }
    
    try {
      const parentResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${parentId}?fields=parents`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (parentResponse.ok) {
        const parentData = await parentResponse.json();
        if (parentData.parents && parentData.parents.length > 0) {
          const isUnder = await checkFileUnderFolder(
            parentData.parents,
            rootFolderId,
            accessToken
          );
          if (isUnder) return true;
        }
      }
    } catch (error) {
      console.error(`[MEDIA_VALIDATION] Error checking parent ${parentId}:`, error);
    }
  }
  
  return false;
}

/**
 * Get full folder path for a file
 */
async function getFolderPath(
  fileId: string,
  rootFolderId: string,
  accessToken: string
): Promise<string> {
  // Simplified: return root folder path
  // In production, build full path by traversing parents
  const rootResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${rootFolderId}?fields=name`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  if (rootResponse.ok) {
    const rootData = await rootResponse.json();
    return rootData.name || 'assets';
  }
  
  return 'assets';
}

/**
 * Store media metadata in Firestore
 */
export interface MediaMetadata {
  drive_file_id: string;
  folder_path: string;
  mime_type: string;
  hash: string;
  validated_at: string;
  validated_by: string;
}

/**
 * Create media metadata record
 */
export function createMediaMetadata(params: {
  drive_file_id: string;
  folder_path: string;
  mime_type: string;
  hash: string;
  validated_by?: string;
}): MediaMetadata {
  return {
    drive_file_id: params.drive_file_id,
    folder_path: params.folder_path,
    mime_type: params.mime_type,
    hash: params.hash,
    validated_at: new Date().toISOString(),
    validated_by: params.validated_by || 'system',
  };
}

/**
 * Media Pairing Confidence Check
 * Phase 1: Validate before/after image pairs have matching tags or folder structure
 */

export interface PairingConfidence {
  score: number; // 0-1, where 1 is perfect match
  confidence: 'high' | 'medium' | 'low';
  requiresManualReview: boolean;
  reasons: string[];
  matchingFactors: {
    folderMatch: boolean;
    nameSimilarity: number;
    timestampProximity: number;
    tagMatch: boolean;
  };
}

const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.5,
  low: 0.0,
};

const MANUAL_REVIEW_THRESHOLD = 0.6; // Below this requires manual review

/**
 * Calculate pairing confidence between before and after images
 */
export function calculatePairingConfidence(params: {
  beforeFile: {
    id: string;
    name: string;
    folderPath: string;
    tags?: string[];
    timestamp?: Date | string;
  };
  afterFile: {
    id: string;
    name: string;
    folderPath: string;
    tags?: string[];
    timestamp?: Date | string;
  };
}): PairingConfidence {
  const { beforeFile, afterFile } = params;
  const reasons: string[] = [];
  const matchingFactors = {
    folderMatch: false,
    nameSimilarity: 0,
    timestampProximity: 0,
    tagMatch: false,
  };

  // 1. Folder structure match (40% weight)
  const folderMatch = beforeFile.folderPath === afterFile.folderPath;
  matchingFactors.folderMatch = folderMatch;
  if (folderMatch) {
    reasons.push('Files are in the same folder');
  } else {
    reasons.push('Files are in different folders');
  }

  // 2. Filename similarity (30% weight)
  const nameSimilarity = calculateNameSimilarity(beforeFile.name, afterFile.name);
  matchingFactors.nameSimilarity = nameSimilarity;
  if (nameSimilarity > 0.7) {
    reasons.push('Filenames are similar');
  } else if (nameSimilarity > 0.4) {
    reasons.push('Filenames have some similarity');
  } else {
    reasons.push('Filenames are dissimilar');
  }

  // 3. Timestamp proximity (20% weight)
  let timestampProximity = 0;
  if (beforeFile.timestamp && afterFile.timestamp) {
    const beforeTime = typeof beforeFile.timestamp === 'string' 
      ? new Date(beforeFile.timestamp).getTime() 
      : beforeFile.timestamp.getTime();
    const afterTime = typeof afterFile.timestamp === 'string'
      ? new Date(afterFile.timestamp).getTime()
      : afterFile.timestamp.getTime();
    
    const timeDiff = Math.abs(afterTime - beforeTime);
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // If within 24 hours, consider it a match
    if (hoursDiff < 24) {
      timestampProximity = 1 - (hoursDiff / 24);
      reasons.push('Files were created within 24 hours');
    } else {
      reasons.push(`Files were created ${Math.round(hoursDiff)} hours apart`);
    }
  } else {
    reasons.push('Timestamp information not available');
  }
  matchingFactors.timestampProximity = timestampProximity;

  // 4. Tag matching (10% weight)
  let tagMatch = false;
  if (beforeFile.tags && afterFile.tags && beforeFile.tags.length > 0 && afterFile.tags.length > 0) {
    const beforeTags = new Set(beforeFile.tags.map(t => t.toLowerCase()));
    const afterTags = new Set(afterFile.tags.map(t => t.toLowerCase()));
    const commonTags = [...beforeTags].filter(tag => afterTags.has(tag));
    tagMatch = commonTags.length > 0;
    matchingFactors.tagMatch = tagMatch;
    
    if (tagMatch) {
      reasons.push(`Files share ${commonTags.length} common tag(s)`);
    } else {
      reasons.push('Files have no common tags');
    }
  } else {
    reasons.push('Tag information not available');
  }

  // Calculate weighted score
  const score = (
    (folderMatch ? 0.4 : 0) +
    (nameSimilarity * 0.3) +
    (timestampProximity * 0.2) +
    (tagMatch ? 0.1 : 0)
  );

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (score >= CONFIDENCE_THRESHOLDS.high) {
    confidence = 'high';
  } else if (score >= CONFIDENCE_THRESHOLDS.medium) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const requiresManualReview = score < MANUAL_REVIEW_THRESHOLD;

  return {
    score,
    confidence,
    requiresManualReview,
    reasons,
    matchingFactors,
  };
}

/**
 * Calculate similarity between two filenames (0-1)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  // Normalize names (remove extensions, lowercase)
  const normalize = (name: string) => {
    return name.toLowerCase().replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/g, '');
  };

  const norm1 = normalize(name1);
  const norm2 = normalize(name2);

  if (norm1 === norm2) return 1.0;

  // Check for common prefixes/suffixes
  const minLength = Math.min(norm1.length, norm2.length);
  let commonChars = 0;
  for (let i = 0; i < minLength; i++) {
    if (norm1[i] === norm2[i]) {
      commonChars++;
    }
  }

  // Simple similarity: common characters / max length
  const maxLength = Math.max(norm1.length, norm2.length);
  return commonChars / maxLength;
}

/**
 * Validate media pairing and return confidence score
 */
export async function validateMediaPairing(params: {
  beforeFileId: string;
  afterFileId: string;
  beforeFileName: string;
  afterFileName: string;
  beforeFolderPath: string;
  afterFolderPath: string;
  beforeTags?: string[];
  afterTags?: string[];
  beforeTimestamp?: Date | string;
  afterTimestamp?: Date | string;
}): Promise<{
  isValid: boolean;
  confidence: PairingConfidence;
  shouldRequireReview: boolean;
}> {
  const confidence = calculatePairingConfidence({
    beforeFile: {
      id: params.beforeFileId,
      name: params.beforeFileName,
      folderPath: params.beforeFolderPath,
      tags: params.beforeTags,
      timestamp: params.beforeTimestamp,
    },
    afterFile: {
      id: params.afterFileId,
      name: params.afterFileName,
      folderPath: params.afterFolderPath,
      tags: params.afterTags,
      timestamp: params.afterTimestamp,
    },
  });

  // High confidence = valid, low confidence = requires review
  const isValid = confidence.confidence === 'high';
  const shouldRequireReview = confidence.requiresManualReview;

  return {
    isValid,
    confidence,
    shouldRequireReview,
  };
}
