
"use client";

import React, { useState, useCallback, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import pako from 'pako';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';

interface XmlUploadProps {
  onFileUpload: (filesData: Array<{fileName: string; content: string}>) => void;
  disabled?: boolean;
}

export function XmlUpload({ onFileUpload, disabled }: XmlUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const processSingleFile = async (file: File): Promise<Array<{fileName: string; content: string}> | {fileName: string; content: string} | null> => {
    return new Promise((resolve) => { // Removed reject, will resolve with null on error
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          let originalFileName = file.name; // Use file.name for original name context
          const arrayBuffer = e.target?.result as ArrayBuffer;

          if (!arrayBuffer && !(file.type === "text/xml" || originalFileName.endsWith(".xml"))) {
             toast({ variant: "destructive", title: `Read Error: ${originalFileName}`, description: "Failed to read file content."});
             resolve(null);
             return;
          }
          
          if (originalFileName.endsWith('.zip')) {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(arrayBuffer);
            const fileProcessingPromises: Promise<({fileName: string; content: string} | null)>[] = [];

            zip.forEach((_, zipEntry) => { // relativePath replaced with _ as zipEntry.name is used
                if (!zipEntry.dir) {
                    const processEntryPromise = (async () => {
                        let entryFileName = zipEntry.name; 
                        if (entryFileName.endsWith('.xml')) {
                            const content = await zipEntry.async('string');
                            return { fileName: entryFileName, content };
                        } else if (entryFileName.endsWith('.xml.gz')) {
                            const buffer = await zipEntry.async('arraybuffer');
                            const content = new TextDecoder().decode(pako.inflate(new Uint8Array(buffer)));
                            entryFileName = entryFileName.substring(0, entryFileName.length - '.xml.gz'.length) + '.xml';
                            return { fileName: entryFileName, content };
                        } else if (entryFileName.endsWith('.gz')) {
                            const buffer = await zipEntry.async('arraybuffer');
                            const content = new TextDecoder().decode(pako.inflate(new Uint8Array(buffer)));
                            entryFileName = entryFileName.substring(0, entryFileName.length - '.gz'.length) + '.xml';
                            return { fileName: entryFileName, content };
                        }
                        return null; // Ignore other file types within ZIP
                    })();
                    fileProcessingPromises.push(processEntryPromise);
                }
            });

            const processedFileResults = await Promise.all(fileProcessingPromises);
            const extractedFilesData = processedFileResults.filter(Boolean) as Array<{fileName: string; content: string}>;
            
            if (extractedFilesData.length === 0) {
              toast({ title: `Empty or No Valid Files in ZIP: ${originalFileName}`, description: "No XML or GZipped XML files found in the ZIP.", variant: "default"});
            }
            resolve(extractedFilesData);
            return;

          } else if (originalFileName.endsWith('.gz')) { // Handles .xml.gz and .gz
            const inflated = pako.inflate(new Uint8Array(arrayBuffer));
            const fileContent = new TextDecoder().decode(inflated);
            let finalFileName = originalFileName;
            if (originalFileName.endsWith('.xml.gz')) {
                finalFileName = originalFileName.substring(0, originalFileName.length - '.xml.gz'.length) + '.xml';
            } else { // Assumes other .gz files (e.g. report.gz) should become report.xml
                finalFileName = originalFileName.substring(0, originalFileName.length - '.gz'.length) + '.xml';
            }
            resolve({ fileName: finalFileName, content: fileContent });
            return;

          } else if (originalFileName.endsWith('.xml') || file.type === "text/xml") {
            const fileContent = e.target?.result as string;
            resolve({ fileName: originalFileName, content: fileContent });
            return;
          } else {
             toast({
              variant: "destructive",
              title: `Unsupported File: ${originalFileName}`,
              description: "Please upload .xml, .xml.gz, or .zip files.",
            });
            resolve(null); 
            return;
          }
        } catch (error) {
          console.error("Error processing file:", file.name, error); // file.name is original here
          toast({
            variant: "destructive",
            title: `Error Processing: ${file.name}`, // file.name is original here
            description: error instanceof Error ? error.message : "Could not process file.",
          });
          resolve(null); 
          return;
        }
      };

      reader.onerror = (error) => {
        console.error("Error reading file:", file.name, error);
         toast({
          variant: "destructive",
          title: `Error Reading: ${file.name}`,
          description: "Could not read file.",
        });
        resolve(null); // Changed from reject to resolve(null)
      };

      if (file.name.endsWith('.gz') || file.name.endsWith('.zip')) {
        reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith('.xml') || file.type === "text/xml") {
        reader.readAsText(file);
      } else {
         toast({
          variant: "destructive",
          title: `Unsupported File Type: ${file.name}`,
          description: "Only .xml, .xml.gz, and .zip files are supported.",
        });
        resolve(null); 
      }
    });
  };


  const processFiles = useCallback(async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const filesArray = Array.from(fileList);
    const filesDataPromises = filesArray.map(file => processSingleFile(file));

    try {
      const results = await Promise.all(filesDataPromises);
      const validFilesData = results.flat().filter(Boolean) as Array<{fileName: string; content: string}>;
      
      if (validFilesData.length > 0) {
        onFileUpload(validFilesData);
      } else if (filesArray.length > 0 && validFilesData.length === 0) {
        toast({
          title: "No Valid Files Processed",
          description: "Ensure files are .xml, .xml.gz, or .zip containing such files.",
        });
      }
    } catch (error) {
      console.error("Error processing files array:", error);
      toast({
        variant: "destructive",
        title: "File Processing Error",
        description: "An unexpected error occurred while processing files.",
      });
    }
  }, [onFileUpload, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && !isDragging) setIsDragging(true);
  }, [disabled, isDragging]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  }, [disabled, processFiles]);

  return (
    <div 
      className={cn(
        "flex flex-col items-center space-y-4 p-6 border-2 border-dashed rounded-lg transition-colors",
        isDragging ? "border-primary bg-accent/20" : "border-border hover:border-primary/70",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={!disabled ? handleButtonClick : undefined}
    >
      <Label htmlFor="xml-upload-input" className="sr-only">
        Upload DMARC Reports
      </Label>
      <Input
        id="xml-upload-input"
        type="file"
        accept=".xml,text/xml,.gz,.xml.gz,.zip,application/zip,application/x-zip-compressed"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
        disabled={disabled}
        multiple
      />
      <UploadCloud className={cn("h-12 w-12", isDragging ? "text-primary" : "text-muted-foreground")} />
      <p className={cn("text-lg font-semibold", isDragging ? "text-primary" : "text-foreground")}>
        Drag & drop XML, GZ, or ZIP files here, or click to select
      </p>
      <p className="text-sm text-muted-foreground">
        You can upload multiple DMARC reports (.xml, .xml.gz, or .zip archives).
      </p>
      <Button 
        onClick={(e) => { e.stopPropagation(); handleButtonClick(); }}
        disabled={disabled} 
        variant="outline" 
        size="lg" 
        className="mt-4"
      >
        <UploadCloud className="mr-2 h-5 w-5" />
        Select Files
      </Button>
    </div>
  );
}
