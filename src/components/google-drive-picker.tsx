
"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import FileIcon from "@/components/file-icon";
import { FileWarning, FolderSearch, Folder as FolderIcon, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
}

interface Breadcrumb {
    id: string;
    name: string;
}

const FileTile = ({ file, onDoubleClick, onSelect, isSelected }: { file: GoogleDriveFile, onDoubleClick: () => void, onSelect: (e: React.MouseEvent) => void, isSelected: boolean }) => (
    <div 
      className={cn(
        "relative group flex flex-col items-center justify-center text-center p-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md border-2",
        isSelected ? "border-primary bg-primary/10" : "border-transparent bg-muted/50"
      )}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <FileIcon mimeType={file.mimeType} filename={file.name} className="h-12 w-12 text-muted-foreground mb-2" />
      <p className="text-xs font-medium w-full break-words" title={file.name}>
        {file.name}
      </p>
    </div>
);

const FileTileSkeleton = () => (
    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
        <Skeleton className="h-12 w-12 mb-2 rounded-lg" />
        <Skeleton className="h-4 w-20" />
    </div>
);

interface GoogleDrivePickerProps {
    onFileSelect: (file: GoogleDriveFile) => void;
}

export default function GoogleDrivePicker({ onFileSelect }: GoogleDrivePickerProps) {
  const { accessToken } = useAuth();
  
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState("root");

  useEffect(() => {
    const fetchFiles = async (folderId: string) => {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      setSelectedFileId(null);
      try {
          const response = await fetch(`/api/drive/files?folderId=${folderId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
          });
  
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Failed to fetch files.");
          }
  
          const data = await response.json();
          setFiles(data.files || []);
          setBreadcrumbs(data.breadcrumbs || []);
  
      } catch (e: any) {
          console.error(e);
          setError(e.message);
      } finally {
          setLoading(false);
      }
    };
    
    fetchFiles(currentFolderId);
  }, [accessToken, currentFolderId]);


  const handleFileDoubleClick = (file: GoogleDriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
        setCurrentFolderId(file.id);
    } else {
        // A file was double-clicked, treat as selection
        onFileSelect(file);
    }
  };

  const handleFileSelect = (fileId: string, event: React.MouseEvent) => {
    setSelectedFileId(fileId);
  };
  
  const handleConfirmSelection = () => {
    if (!selectedFileId) return;
    const file = files.find(f => f.id === selectedFileId);
    if (file) {
      onFileSelect(file);
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 p-4">
            {[...Array(18)].map((_, i) => <FileTileSkeleton key={i} />)}
        </div>
      );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="m-4">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    if (files.length === 0) {
        return (
            <div className="text-center py-16">
                <FolderSearch className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Empty Folder</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    This folder doesn't contain any files.
                </p>
            </div>
        )
    }

    const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const regularFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && (f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')));

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 p-4">
            {[...folders, ...regularFiles].map((file) => (
                <FileTile 
                    key={file.id} 
                    file={file} 
                    onDoubleClick={() => handleFileDoubleClick(file)} 
                    onSelect={(e) => handleFileSelect(file.id, e)}
                    isSelected={selectedFileId === file.id}
                />
            ))}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
        <div className="flex-shrink-0 border-b p-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setCurrentFolderId('root')}>
                    <Home className="h-4 w-4"/> My Drive
                </Button>
                {breadcrumbs.map(bc => (
                     <div key={bc.id} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4"/>
                        <Button variant={bc.id === currentFolderId ? "secondary" : "ghost"} size="sm" onClick={() => setCurrentFolderId(bc.id)}>
                            <FolderIcon className="mr-2 h-4 w-4" />
                            {bc.name}
                        </Button>
                     </div>
                ))}
            </div>
        </div>
        <ScrollArea className="flex-grow">
            {renderContent()}
        </ScrollArea>
        <div className="flex-shrink-0 border-t p-4 flex justify-end">
            <Button onClick={handleConfirmSelection} disabled={!selectedFileId || files.find(f => f.id === selectedFileId)?.mimeType === 'application/vnd.google-apps.folder'}>
                Select File
            </Button>
        </div>
    </div>
  );
}

    