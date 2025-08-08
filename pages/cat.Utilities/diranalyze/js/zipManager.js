// --- FILE: js/zipManager.js --- //
import { appState } from './main.js';
import * as fileEditor from './fileEditor.js';
import * as fileSystem from './fileSystem.js'; // To read original file content if not edited
import * as notificationSystem from './notificationSystem.js';
import * as errorHandler from './errorHandler.js';

// Utility function to trigger browser download
function triggerDownload(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

export async function downloadProjectAsZip() {
    if (typeof JSZip === 'undefined') {
        errorHandler.showError({
            name: "LibraryMissingError",
            message: "JSZip library is not loaded. Cannot create ZIP file."
        });
        console.error("JSZip library not found!");
        return;
    }

    if (!appState.fullScanData || !appState.fullScanData.directoryData || !appState.fullScanData.allFilesList) {
        notificationSystem.showNotification("No project data available to download.", {duration: 3000});
        return;
    }

    const zip = new JSZip();
    const rootFolderName = appState.fullScanData.directoryData.name;

    notificationSystem.showNotification("Preparing ZIP file...", {duration: 2000});

    try {
        for (const fileInfo of appState.fullScanData.allFilesList) {
            let content = fileEditor.getEditedContent(fileInfo.path);
            let isBinary = false; // Future use

            // If content is not in the editor's cache, try reading it from the disk handle.
            if (content === undefined) {
                if (fileInfo.entryHandle) {
                    try {
                        if (fileInfo.entryHandle instanceof File) { // From <input type="file">
                            content = await fileInfo.entryHandle.text();
                        } else if (typeof fileInfo.entryHandle.file === 'function') { // From drag-and-drop
                            content = await new Promise((resolve, reject) => {
                                fileInfo.entryHandle.file(async (fileObject) => {
                                    try { resolve(await fileObject.text()); }
                                    catch (err) { reject(err); }
                                }, reject);
                            });
                        } else {
                            console.warn(`[ZIP] Unknown entryHandle type for: ${fileInfo.path}. Skipping.`);
                            continue;
                        }
                    } catch (readError) {
                        console.error(`[ZIP] Error reading original content for ${fileInfo.path}:`, readError);
                        zip.file(fileInfo.path, `Error reading file: ${readError.message}`);
                        continue;
                    }
                } else {
                    // Not in cache and no handle, so it's a file that truly has no content source.
                    console.warn(`[ZIP] File ${fileInfo.path} has no content in cache and no disk handle. Skipping.`);
                    continue;
                }
            }
            
            // Add the file to the zip.
            // The file path already includes the root folder name from the scan.
            zip.file(fileInfo.path, content);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, rootFolderName + '.zip');
        notificationSystem.showNotification("Project ZIP generated and download started!", {duration: 3500});

    } catch (error) {
        console.error("Error generating ZIP file:", error);
        errorHandler.showError({
            name: "ZipGenerationError",
            message: `Failed to generate ZIP file: ${error.message}`,
            stack: error.stack
        });
        notificationSystem.showNotification("Error generating ZIP file.", {duration: 3000});
    }
}

// --- ENDFILE: js/zipManager.js --- //