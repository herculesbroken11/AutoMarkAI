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
