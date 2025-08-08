// --- FILE: diranalyze/js/aiPatcher.js --- //
import * as fileSystem from 'fileSystem';
import * as fileEditor from 'fileEditor';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as utils from 'utils';
import * as treeView from 'treeView';
import { DMP } from './lib-wrappers/dmp-wrapper.js'; // CORRECTLY IMPORT DMP

// Module-level variables to hold dependencies injected by main.js
let _appState;
let _elements;

let patchQueue = [];
let currentPatchBeingReviewed = null;

const CAPCA_PROMPT_TEMPLATE = `
You are an AI code assistant. Your goal is to help me modify my project files by generating a JSON array of "Contextual Anchor Patching and Creation Array" (CAPCA) operations.

If you have already been debriefed on the project's structure and content, use that knowledge. If I provide specific file content now, use that as the most current version for the given file.

Generate CAPCA JSON based on my change request.

Supported CAPCA operations:
- {"file": "path/to/file.ext", "operation": "create_file_with_content", "newText": "content..."}
- {"file": "path/to/file.ext", "operation": "replace_segment_after_anchor", "anchorText": "anchor...", "segmentToAffect": "old_text...", "newText": "new_text...", "originalLineOfAnchor": <line_num_optional>}
- {"file": "path/to/file.ext", "operation": "insert_text_after_anchor", "anchorText": "anchor...", "newText": "text_to_insert...", "originalLineOfAnchor": <line_num_optional>}
- {"file": "path/to/file.ext", "operation": "delete_segment_after_anchor", "anchorText": "anchor...", "segmentToAffect": "text_to_delete...", "originalLineOfAnchor": <line_num_optional>}

Key guidelines:
- 'filePath' is always project-relative.
- Use concise but unique 'anchorText'.
- 'segmentToAffect' must be exact. For "replace" with empty "segmentToAffect", it acts as an insert.
- Ensure newlines are '\\n'.

My Change Request:
[USER: PASTE YOUR DETAILED CHANGE REQUEST HERE, REFERENCING FILE PATHS AS NEEDED. IF PROVIDING CURRENT FILE CONTENT FOR A SPECIFIC FILE, CLEARLY INDICATE IT.]

Your CAPCA JSON response (provide ONLY the JSON array):
`;


function parsePatchInstructions(patchJsonString) {
    try {
        const patches = JSON.parse(patchJsonString);
        if (!Array.isArray(patches)) {
            throw new Error("Patch instructions should be a JSON array.");
        }
        patches.forEach(op => {
            if (typeof op.file !== 'string' || typeof op.operation !== 'string') {
                throw new Error("Each patch must have 'file' and 'operation' string properties.");
            }
            switch (op.operation) {
                case 'create_file_with_content':
                    if (typeof op.newText !== 'string') {
                        throw new Error("'create_file_with_content' operation requires 'newText' property.");
                    }
                    break;
                case 'replace_segment_after_anchor':
                case 'insert_text_after_anchor':
                case 'delete_segment_after_anchor':
                    if (typeof op.anchorText !== 'string') {
                        throw new Error(`Operation '${op.operation}' requires 'anchorText'.`);
                    }
                    if (op.operation !== 'insert_text_after_anchor' && typeof op.segmentToAffect !== 'string') {
                        throw new Error(`Operation '${op.operation}' requires 'segmentToAffect'.`);
                    }
                    if (op.operation !== 'delete_segment_after_anchor' && typeof op.newText !== 'string' && op.operation !== 'replace_segment_after_anchor' ) {
                        if (op.operation === 'replace_segment_after_anchor' && op.segmentToAffect === '' && typeof op.newText !== 'string') {
                             throw new Error(`Operation '${op.operation}' with empty segmentToAffect requires 'newText'.`);
                        } else if (op.operation !== 'replace_segment_after_anchor') {
                             throw new Error(`Operation '${op.operation}' requires 'newText'.`);
                        }
                    }
                    break;
                default:
                    break;
            }
        });
        return patches;
    } catch (error) {
        console.error("Error parsing CAPCA patch JSON:", error);
        errorHandler.showError({
            name: "PatchParseError", message: `Invalid CAPCA patch JSON: ${error.message}`, stack: error.stack
        });
        return null;
    }
}

function findRobustAnchorIndex(content, anchorText, originalLineHint = 1, windowLines = 10) {
    if (!anchorText || anchorText.length === 0) return 0;
    const normalizedContent = content.replace(/\r\n/g, "\n");
    const normalizedAnchorText = anchorText.replace(/\r\n/g, "\n");
    const contentLines = normalizedContent.split('\n');
    const anchorLines = normalizedAnchorText.split('\n');
    const firstAnchorLine = anchorLines[0];
    const hintLineIndex = originalLineHint > 0 ? originalLineHint - 1 : 0;

    const searchStartLine = Math.max(0, hintLineIndex - windowLines);
    const searchEndLine = Math.min(contentLines.length - anchorLines.length + 1, hintLineIndex + windowLines + 1);

    for (let i = searchStartLine; i < searchEndLine; i++) {
        if (contentLines[i] !== undefined && contentLines[i].includes(firstAnchorLine)) {
            if (anchorLines.length === 1) {
                let charOffset = 0;
                for (let k = 0; k < i; k++) charOffset += contentLines[k].length + 1;
                return charOffset + contentLines[i].indexOf(firstAnchorLine);
            }
            let fullMatch = true;
            for (let j = 1; j < anchorLines.length; j++) {
                if ((i + j) >= contentLines.length || contentLines[i + j] !== anchorLines[j]) {
                    fullMatch = false;
                    break;
                }
            }
            if (fullMatch) {
                let charOffset = 0;
                for (let k = 0; k < i; k++) charOffset += contentLines[k].length + 1;
                return charOffset + contentLines[i].indexOf(firstAnchorLine);
            }
        }
    }
    const globalIndex = normalizedContent.indexOf(normalizedAnchorText);
    return globalIndex;
}

async function calculateProposedChange(filePath, patchOp, currentBatchFileStates = new Map()) {
    let rawOriginalContent = "";
    let contentToProcess = "";
    let isNewFile = false;
    let logEntry = "";
    const basePathForState = filePath;

    if (patchOp.operation === 'create_file_with_content') {
        const existingFile = _appState.fullScanData?.allFilesList.find(f => f.path === basePathForState);
        if (existingFile || currentBatchFileStates.has(basePathForState)) {
            return { success: false, log: `  - Op: create_file. Error: File '${basePathForState}' already exists (or was created in this batch).`, originalContent: "", patchedContent: "" };
        }
        isNewFile = true;
        const normalizedNewText = patchOp.newText.replace(/\r\n/g, "\n");
        logEntry = `  - Op: create_file. Proposed content for new file '${basePathForState}'.`;
        const proposed = { success: true, log: logEntry, originalContent: "", patchedContent: normalizedNewText, isNewFile };
        currentBatchFileStates.set(basePathForState, proposed.patchedContent);
        return proposed;
    }

    if (currentBatchFileStates.has(basePathForState)) {
        contentToProcess = currentBatchFileStates.get(basePathForState);
        rawOriginalContent = contentToProcess;
    } else if (fileEditor.getEditedContent(basePathForState) !== undefined) {
        rawOriginalContent = fileEditor.getEditedContent(basePathForState);
        contentToProcess = rawOriginalContent.replace(/\r\n/g, "\n");
    } else {
        const fileData = _appState.fullScanData?.allFilesList.find(f => f.path === basePathForState);
        if (!fileData) {
            return { success: false, log: `  - Op: ${patchOp.operation}. Error: File '${basePathForState}' not found in project scan.`, originalContent: "", patchedContent: "" };
        }
        if (!fileData.entryHandle && !isNewFile) {
            return { success: false, log: `  - Op: ${patchOp.operation}. Error: No file handle for existing file '${basePathForState}' (likely scaffolded, not saved).`, originalContent: "", patchedContent: "" };
        }
        try {
            rawOriginalContent = await fileSystem.readFileContent(fileData.entryHandle, basePathForState);
            contentToProcess = rawOriginalContent.replace(/\r\n/g, "\n");
        } catch (e) {
            return { success: false, log: `  - Error reading original content for '${basePathForState}': ${e.message}`, originalContent: "", patchedContent: "" };
        }
    }

    const originalContentForDiff = contentToProcess;
    let proposedContentNormalized = contentToProcess;

    const normalizedAnchorText = patchOp.anchorText.replace(/\r\n/g, "\n");
    const normalizedSegmentToAffect = patchOp.segmentToAffect ? patchOp.segmentToAffect.replace(/\r\n/g, "\n") : "";
    const normalizedNewText = patchOp.newText ? patchOp.newText.replace(/\r\n/g, "\n") : "";

    if (patchOp.operation === 'replace_segment_after_anchor' ||
        patchOp.operation === 'insert_text_after_anchor' ||
        patchOp.operation === 'delete_segment_after_anchor') {

        let anchorIndex = findRobustAnchorIndex(contentToProcess, normalizedAnchorText, patchOp.originalLineOfAnchor || 1);
        if (anchorIndex === -1) {
            logEntry = `  - Op: ${patchOp.operation}. Error: Anchor text "${shorten(normalizedAnchorText)}" not found in '${basePathForState}'.`;
            return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
        }
        const afterAnchorIndex = anchorIndex + normalizedAnchorText.length;

        if (patchOp.operation === 'insert_text_after_anchor') {
            proposedContentNormalized = contentToProcess.substring(0, afterAnchorIndex) +
                                        normalizedNewText +
                                        contentToProcess.substring(afterAnchorIndex);
            logEntry = `  - Op: insert_text_after_anchor. Success: Inserted text after anchor "${shorten(normalizedAnchorText)}".`;
        } else {
            const segmentStartIndex = contentToProcess.indexOf(normalizedSegmentToAffect, afterAnchorIndex);
            const leniencyChars = patchOp.leniencyChars === undefined ? 5 : patchOp.leniencyChars;

            if (normalizedSegmentToAffect.length > 0 && (segmentStartIndex === -1 || segmentStartIndex > afterAnchorIndex + leniencyChars )) {
                const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                logEntry = `  - Op: ${patchOp.operation}. Error: Segment "${shorten(normalizedSegmentToAffect)}" not found sufficiently close after anchor "${shorten(normalizedAnchorText)}". Expected around index ${afterAnchorIndex} (within ${leniencyChars} chars), first match at ${segmentStartIndex}. Content after anchor: "${shorten(foundInstead, 40)}..."`;
                return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
            }

            if (patchOp.operation === 'replace_segment_after_anchor') {
                 if (normalizedSegmentToAffect.length === 0 && normalizedNewText.length > 0) {
                    proposedContentNormalized = contentToProcess.substring(0, afterAnchorIndex) +
                                                normalizedNewText +
                                                contentToProcess.substring(afterAnchorIndex);
                    logEntry = `  - Op: replace_segment_after_anchor (as insert). Success: Inserted text as 'segmentToAffect' was empty.`;
                 } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex !== -1 && segmentStartIndex <= afterAnchorIndex + leniencyChars) {
                    proposedContentNormalized = contentToProcess.substring(0, segmentStartIndex) +
                                                normalizedNewText +
                                                contentToProcess.substring(segmentStartIndex + normalizedSegmentToAffect.length);
                    logEntry = `  - Op: replace_segment_after_anchor. Success: Replaced segment "${shorten(normalizedSegmentToAffect)}".`;
                 } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex === -1) {
                    const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                    logEntry = `  - Op: ${patchOp.operation}. Error: Non-empty segment "${shorten(normalizedSegmentToAffect)}" not found close after anchor "${shorten(normalizedAnchorText)}". Content after anchor: "${shorten(foundInstead, 40)}..."`;
                    return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
                 } else {
                    logEntry = `  - Op: replace_segment_after_anchor. Info: 'segmentToAffect' and 'newText' were empty. No change.`;
                 }
            } else if (patchOp.operation === 'delete_segment_after_anchor') {
                if (normalizedSegmentToAffect.length === 0) {
                    logEntry = `  - Op: delete_segment_after_anchor. Info: 'segmentToAffect' was empty, no change made.`;
                } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex !== -1 && segmentStartIndex <= afterAnchorIndex + leniencyChars) {
                    proposedContentNormalized = contentToProcess.substring(0, segmentStartIndex) +
                                                contentToProcess.substring(segmentStartIndex + normalizedSegmentToAffect.length);
                    logEntry = `  - Op: delete_segment_after_anchor. Success: Deleted segment "${shorten(normalizedSegmentToAffect)}".`;
                } else if (normalizedSegmentToAffect.length > 0 && segmentStartIndex === -1) {
                    const foundInstead = contentToProcess.substring(afterAnchorIndex, afterAnchorIndex + Math.max(normalizedSegmentToAffect.length, 20) + 20);
                    logEntry = `  - Op: ${patchOp.operation}. Error: Non-empty segment "${shorten(normalizedSegmentToAffect)}" not found close after anchor "${shorten(normalizedAnchorText)}". Content after anchor: "${shorten(foundInstead,40)}..."`;
                    return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
                }
            }
        }
    } else {
        logEntry = `  - Op: ${patchOp.operation}. Error: Unknown CAPCA operation type for existing file.`;
        return { success: false, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized };
    }

    if (proposedContentNormalized !== originalContentForDiff) {
        currentBatchFileStates.set(basePathForState, proposedContentNormalized);
    }
    return { success: true, log: logEntry, originalContent: originalContentForDiff, patchedContent: proposedContentNormalized, isNewFile: isNewFile };
}

function showNextPatchInModal() {
    if (patchQueue.length === 0) {
        _elements.aiPatchOutputLog.textContent += "\n\nAll patches reviewed.";
        notificationSystem.showNotification("All patches reviewed.", { duration: 3000 });
        currentPatchBeingReviewed = null;
        return;
    }
    currentPatchBeingReviewed = patchQueue.shift();
    const { filePath, originalContent, patchedContent, patchOp } = currentPatchBeingReviewed;
    const dmp = new DMP(); // Use the imported DMP
    _elements.diffFilePath.textContent = `${filePath} (${patchOp.operation})`;
    if (patchOp.operation === 'create_file_with_content') {
        _elements.diffOutputContainer.innerHTML = `<p><b>PROPOSED NEW FILE CONTENT:</b></p><pre style="background:#e6ffe6; padding:5px;">${escapeHtml(patchedContent)}</pre>`;
    } else {
        const diff = dmp.diff_main(originalContent, patchedContent);
        dmp.diff_cleanupSemantic(diff);
        _elements.diffOutputContainer.innerHTML = dmp.diff_prettyHtml(diff);
    }
    _elements.aiPatchDiffModal.style.display = 'flex';
}

async function closeDiffModalAndProceed(applyChange) {
    if (!currentPatchBeingReviewed) return;
    const { filePath, patchedContent, patchOp, isNewFile, log, originalContent } = currentPatchBeingReviewed;

    if (applyChange) {
        try {
            if (!_appState.directoryHandle && isNewFile) {
                 _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Staged for new file - ${filePath}\n  Details: ${log || "Content set."}\n`;
                 notificationSystem.showNotification(`Staged new file: ${filePath}`, { duration: 2000 });
            } else if (!_appState.directoryHandle && !isNewFile) {
                 _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Staged change for - ${filePath}\n  Details: ${log || "Content set."}\n`;
                 notificationSystem.showNotification(`Staged change for: ${filePath}`, { duration: 2000 });
            } else if (_appState.directoryHandle) {
                await fileSystem.writeFileContent(_appState.directoryHandle, filePath, patchedContent);
                _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Applied & Saved - ${filePath}\n  Details: ${log || "Content set."}\n`;
                notificationSystem.showNotification(`Applied and saved: ${filePath}`, { duration: 2000 });
            } else {
                 _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Staged (no dir handle) - ${filePath}\n  Details: ${log || "Content set."}\n`;
                 notificationSystem.showNotification(`Staged (no dir handle): ${filePath}`, { duration: 2000 });
            }

            if (isNewFile) {
                const newFileEntry = {
                    name: filePath.substring(filePath.lastIndexOf('/') + 1),
                    path: filePath,
                    type: 'file',
                    size: patchedContent.length,
                    extension: utils.getFileExtension(filePath),
                    depth: (filePath.split('/').length -1) - (_appState.fullScanData.directoryData.path.split('/').length -1),
                    entryHandle: _appState.directoryHandle ? await fileSystem.getFileHandleFromPath(_appState.directoryHandle, filePath) : null
                };

                _appState.fullScanData.allFilesList.push(newFileEntry);
                if (typeof treeView.addFileToTree === 'function') {
                    treeView.addFileToTree(newFileEntry);
                }
            }
            // For patches, the patched content becomes the new "original" baseline.
            fileEditor.updateFileInEditorCache(filePath, patchedContent, patchedContent, true);


        } catch (err) {
            notificationSystem.showNotification(`ERROR: Failed to process patch for ${filePath}. Patch not applied. See console.`, { duration: 4000 });
            console.error(`Error applying/saving patch for ${filePath}:`, err);
            _elements.aiPatchDiffModal.style.display = 'none';
            currentPatchBeingReviewed = null;
            return;
        }
    } else {
        _elements.aiPatchOutputLog.textContent += `\nUser ACTION: Skipped - ${filePath} for operation ${patchOp.operation}.\n`;
    }

    _elements.aiPatchDiffModal.style.display = 'none';
    currentPatchBeingReviewed = null;
    showNextPatchInModal();
}

export async function processPatches(patchInstructions) {
    if (!patchInstructions || patchInstructions.length === 0) {
        _elements.aiPatchOutputLog.textContent = "No patch instructions provided."; return;
    }
    if (!_appState.fullScanData || !_appState.fullScanData.allFilesList) {
        _elements.aiPatchOutputLog.textContent = "Error: No project loaded or file list unavailable. Load a project first.";
        return;
    }
    _elements.aiPatchOutputLog.textContent = "Preparing patches for review...\n";
    patchQueue = [];
    let initialLog = "";
    let successfullyPreparedCount = 0;
    let currentBatchFileStates = new Map();

    for (const patchOp of patchInstructions) {
        const filePath = patchOp.file;
        const result = await calculateProposedChange(filePath, patchOp, currentBatchFileStates);
        initialLog += `\nFile: ${filePath} (${patchOp.operation})\n${result.log}\n`;
        if (result.success) {
            if (patchOp.operation === 'create_file_with_content' || result.originalContent !== result.patchedContent) {
                patchQueue.push({ ...result, filePath, patchOp });
                successfullyPreparedCount++;
            } else {
                 initialLog += "  - Info: No effective change proposed by this operation (content identical).\n";
            }
        }
    }
    _elements.aiPatchOutputLog.textContent = initialLog + `\n--- Prepared ${successfullyPreparedCount} patches for review. ---\n`;
    if (patchQueue.length > 0) {
        showNextPatchInModal();
    } else {
        notificationSystem.showNotification("No changes to review or all patches failed.", { duration: 4000 });
    }
}

function shorten(text, maxLength = 30) {
    if (typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "'");
}

export function initAiPatcher(mainAppState, mainElements) {
    _appState = mainAppState;
    _elements = mainElements;

    _elements.applyAiPatchBtn?.addEventListener('click', () => {
        const patchJson = _elements.aiPatchInput.value;
        if (!patchJson.trim()) {
            notificationSystem.showNotification("Patch input is empty.", {duration: 3000});
            _elements.aiPatchOutputLog.textContent = "Patch input empty.";
            return;
        }
        const parsedInstructions = parsePatchInstructions(patchJson);
        if (parsedInstructions) {
            processPatches(parsedInstructions);
        } else {
             _elements.aiPatchOutputLog.textContent = "Failed to parse CAPCA patches. Check format/errors.";
        }
    });
    _elements.closeAiPatchDiffModal?.addEventListener('click', () => closeDiffModalAndProceed(false));
    _elements.confirmApplyPatchChanges?.addEventListener('click', () => closeDiffModalAndProceed(true));
    _elements.skipPatchChanges?.addEventListener('click', () => closeDiffModalAndProceed(false));
    _elements.cancelAllPatchChanges?.addEventListener('click', () => {
        patchQueue = [];
        closeDiffModalAndProceed(false);
        _elements.aiPatchOutputLog.textContent += "\n\nUser ACTION: Cancelled all remaining patches.\n";
        notificationSystem.showNotification("All remaining patches cancelled.", { duration: 3000 });
    });

    _elements.copyPatchPromptBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(CAPCA_PROMPT_TEMPLATE.trim())
            .then(() => notificationSystem.showNotification("CAPCA Patch Prompt copied to clipboard!", { duration: 3000 }))
            .catch(err => {
                console.error("Failed to copy patch prompt:", err);
                notificationSystem.showNotification("Error copying prompt. See console.", { duration: 3000 });
            });
    });
}
// --- ENDFILE: diranalyze/js/aiPatcher.js --- //