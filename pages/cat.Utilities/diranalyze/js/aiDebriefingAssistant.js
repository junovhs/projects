// --- FILE: diranalyze/js/aiDebriefingAssistant.js --- //
import { elements, appState } from './main.js';
import * as notificationSystem from './notificationSystem.js';
import * as fileSystem from './fileSystem.js';
import * as utils from './utils.js';
import * as fileEditor from './fileEditor.js';
import * as errorHandler from './errorHandler.js';

/**
 * Triggers a browser download for a given Blob and filename.
 * @param {Blob} blob - The Blob to download.
 * @param {string} filename - The desired filename for the download.
 */
function triggerDownload(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

/**
 * Gathers the content of all committed text files and initiates a download.
 */
async function exportCombinedText() {
    if (!appState.selectionCommitted || !appState.committedScanData) {
        notificationSystem.showNotification("Please commit a selection of files first.", { duration: 3000 });
        return;
    }

    const scopeForExport = appState.committedScanData;
    const textFilesInScope = scopeForExport.allFilesList.filter(file => utils.isLikelyTextFile(file.path));

    if (textFilesInScope.length === 0) {
        notificationSystem.showNotification("No text files found in the committed selection.", { duration: 3000 });
        return;
    }

    notificationSystem.showNotification("Preparing combined text file...", { duration: 2000 });
    elements.loader.textContent = 'EXPORTING TEXT...';
    elements.loader.classList.add('visible');

    try {
        const projectName = appState.fullScanData?.directoryData.name || 'project';
        let combinedContent = `// DIRANALYSE COMBINED TEXT EXPORT //\n`;
        combinedContent += `// Project: ${projectName}\n`;
        combinedContent += `// Timestamp: ${new Date().toISOString()}\n`;
        combinedContent += `// Files in this export: ${textFilesInScope.length}\n\n`;
        
        const binarySkippedCount = scopeForExport.allFilesList.length - textFilesInScope.length;
        if (binarySkippedCount > 0) {
            combinedContent += `// NOTE: ${binarySkippedCount} binary or non-text file(s) were omitted from this export.\n\n`;
        }

        for (const file of textFilesInScope) {
            try {
                // readFileContent correctly checks the editor cache first
                const content = await fileSystem.readFileContent(file.entryHandle, file.path, false);
                let sourceInfo = "";
                if (fileEditor.hasEditedContent(file.path)) {
                    sourceInfo = fileEditor.isPatched(file.path) ? " (EDITED & PATCHED)" : " (EDITED)";
                }
                combinedContent += `// ===== START OF FILE: ${file.path}${sourceInfo} ===== //\n`;
                combinedContent += content;
                // Add a newline at the end of the file content if it doesn't have one
                if (!content.endsWith('\n')) {
                    combinedContent += '\n';
                }
                combinedContent += `// ===== END OF FILE: ${file.path} ===== //\n\n\n`;

            } catch (e) {
                const errorMessage = `// ERROR reading ${file.path}: ${e.message} //\n\n`;
                combinedContent += errorMessage;
                console.error(`Error processing file for combined text: ${file.path}`, e);
            }
        }

        const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
        const filename = `${projectName}_export.txt`;
        triggerDownload(blob, filename);
        notificationSystem.showNotification("Combined text file export started!", { duration: 3500 });

    } catch (error) {
        console.error("Error exporting combined text:", error);
        errorHandler.showError({
            name: "ExportError",
            message: "Failed to export combined text file.",
            stack: error.stack
        });
        notificationSystem.showNotification("Error during export. See console/error report.", { duration: 4000 });
    } finally {
        elements.loader.classList.remove('visible');
        elements.loader.textContent = 'ANALYSING...';
    }
}

export function initAiDebriefingAssistant() {
    const exportButton = document.getElementById('aiDebriefingAssistantBtn');
    if (exportButton) {
        exportButton.addEventListener('click', exportCombinedText);
        console.log("Export Combined Text feature initialized.");
    } else {
        console.error("Export Combined Text button (aiDebriefingAssistantBtn) not found.");
    }
}
// --- ENDFILE: diranalyze/js/aiDebriefingAssistant.js --- //