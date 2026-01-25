import { File, FileText, FileImage, FileVideo, FileAudio, Sheet, Presentation, FileArchive, FileCode, Folder, LucideProps } from 'lucide-react';
import React from 'react';

const fileTypeIcons: { [key: string]: React.ElementType } = {
  // Google Specific
  'application/vnd.google-apps.folder': Folder,
  'application/vnd.google-apps.document': FileText,
  'application/vnd.google-apps.spreadsheet': Sheet,
  'application/vnd.google-apps.presentation': Presentation,
  
  // Standard MIME types
  'image/jpeg': FileImage,
  'image/png': FileImage,
  'image/gif': FileImage,
  'image/svg+xml': FileImage,

  'video/mp4': FileVideo,
  'video/quicktime': FileVideo,
  'video/x-msvideo': FileVideo,
  
  'audio/mpeg': FileAudio,
  'audio/wav': FileAudio,

  'application/pdf': FileText,
  'application/zip': FileArchive,
  'application/x-rar-compressed': FileArchive,

  'application/javascript': FileCode,
  'text/html': FileCode,
  'text/css': FileCode,
  'text/plain': File,
  
  default: File,
};

const getIconForMimeType = (mimeType: string): React.ElementType => {
  if (fileTypeIcons[mimeType]) {
    return fileTypeIcons[mimeType];
  }
  
  const mainType = mimeType.split('/')[0];
  if (mainType === 'image') return FileImage;
  if (mainType === 'video') return FileVideo;
  if (mainType === 'audio') return FileAudio;

  return fileTypeIcons.default;
};

const fileExtensionIcons: { [key: string]: React.ElementType } = {
    'doc': FileText,
    'docx': FileText,
    'xls': Sheet,
    'xlsx': Sheet,
    'ppt': Presentation,
    'pptx': Presentation,
    'jpg': FileImage,
    'jpeg': FileImage,
    'png': FileImage,
    'gif': FileImage,
    'svg': FileImage,
    'mp4': FileVideo,
    'mov': FileVideo,
    'avi': FileVideo,
    'mp3': FileAudio,
    'wav': FileAudio,
    'zip': FileArchive,
    'rar': FileArchive,
    'js': FileCode,
    'html': FileCode,
    'css': FileCode,
    'pdf': FileText,
    'txt': File,
};


const FileIcon = ({ mimeType, filename, ...props }: { mimeType?: string, filename: string } & LucideProps) => {
    let IconComponent: React.ElementType = fileTypeIcons.default;

    if (mimeType) {
        IconComponent = getIconForMimeType(mimeType);
    } else if (filename) {
        const extension = filename.split('.').pop()?.toLowerCase();
        if (extension && fileExtensionIcons[extension]) {
            IconComponent = fileExtensionIcons[extension];
        }
    }
  
  return <IconComponent {...props} />;
};

export default FileIcon;
