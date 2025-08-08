// --- FILE: diranalyze/js/fileEditor.js --- (ADD LOGS TO initFileEditor and saveCurrentFile)
import { appState, elements as globalElements } from './main.js';
import * as fileSystem from './fileSystem.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import { getFileExtension, formatBytes } from './utils.js';
import * as uiManager from './uiManager.js';

const editedFiles = new Map();

function getCodeMirrorMode(filePath) {
    const extension = getFileExtension(filePath);
    switch (extension) {
        case '.js': case '.mjs': case '.json': return { name: "javascript", json: extension === '.json' };
        case '.ts': case '.tsx': return "text/typescript";
        case '.css': return "text/css";
        case '.html': case '.htm': case '.xml': return "htmlmixed";
        case '.md': return "text/markdown";
        case '.py': return "text/x-python";
        case '.java': return "text/x-java";
        case '.c': case '.h': case '.cpp': case '.hpp': return "text/x-c++src";
        case '.cs': return "text/x-csharp";
        case '.liquid': return "htmlmixed";
        default: return "text/plain";
    }
}

function updateEditorInfoUI(filePath, currentContentInEditor, hasActualUnsavedChanges) {
    const editorInfoEl = globalElements.editorInfo;
    const editorFileTitleEl = globalElements.editorFileTitle;
    const saveFileBtnEl = document.getElementById('saveFileBtn');

    if (editorInfoEl) {
        let modeName = "N/A";
        if (appState.editorInstance) {
            const modeOption = appState.editorInstance.getOption("mode");
            modeName = typeof modeOption === 'string' ? modeOption : modeOption?.name || "unknown";
        }
        editorInfoEl.textContent = `Size: ${formatBytes(currentContentInEditor.length)} | Mode: ${modeName} ${hasActualUnsavedChanges ? " | *Unsaved" : ""}`;
    }
    if (editorFileTitleEl) {
         editorFileTitleEl.textContent = `EDITING: ${filePath}${hasActualUnsavedChanges ? "*" : ""}`;
    }

    if (saveFileBtnEl) {
        // console.log(`[updateEditorInfoUI] About to set 'disabled' for saveFileBtn. hasActualUnsavedChanges: ${hasActualUnsavedChanges}. Current btn.disabled: ${saveFileBtnEl.disabled}`);
        saveFileBtnEl.disabled = !hasActualUnsavedChanges;
        // console.log(`[updateEditorInfoUI] 'disabled' for saveFileBtn SET TO: ${saveFileBtnEl.disabled}`);
    } else {
        // console.error("[updateEditorInfoUI] saveFileBtn element not found!");
    }
}

export function initFileEditor() {
    const closeButton = document.getElementById('closeEditorBtn');
    const saveButton = document.getElementById('saveFileBtn'); // Query for the save button

    if (closeButton) {
        closeButton.addEventListener('click', closeEditor);
    }

    if (saveButton) {
        console.log("[initFileEditor] saveFileBtn element FOUND. Adding 'click' listener."); // ADDED LOG
        saveButton.addEventListener('click', (event) => { // ADDED event argument
            console.log("[initFileEditor] SAVE FILE BUTTON CLICKED. Event:", event); // ADDED LOG
            saveCurrentFile();
        });
    } else {
        console.error("[initFileEditor] saveFileBtn element NOT FOUND during init."); // ADDED LOG
    }
    console.log("File Editor Initialized (with manual save and direct button query).");
}


export async function openFileInEditor(fileData) {
    if (appState.isLoadingFileContent) return;
    if (appState.currentEditingFile?.path === fileData.path && globalElements.fileEditor.style.display === 'flex') {
        return;
    }

    if (appState.currentEditingFile) {
        const currentFileState = editedFiles.get(appState.currentEditingFile.path);
        if (currentFileState && currentFileState.hasUnsavedChanges) {
            if (!confirm(`File ${appState.currentEditingFile.name} has unsaved changes. Close anyway?`)) {
                return;
            }
        }
    }
    appState.isLoadingFileContent = true;

    try {
        const filePath = fileData.path;
        let contentForEditor;
        let originalPersistedContentForCache;
        let currentHasUnsavedChanges = false;

        const cachedFileState = editedFiles.get(filePath);

        if (cachedFileState) {
            contentForEditor = cachedFileState.content;
            originalPersistedContentForCache = cachedFileState.originalPersistedContent;
            currentHasUnsavedChanges = cachedFileState.content !== cachedFileState.originalPersistedContent;
        } else {
            let loadedContentFromDisk = "";
            if (fileData.entryHandle) {
                loadedContentFromDisk = await fileSystem.readFileContent(fileData.entryHandle, filePath, true);
            } else if (!appState.directoryHandle) {
                loadedContentFromDisk = "";
            } else {
                 notificationSystem.showNotification(`Error: File entry handle missing for ${filePath} in a disk-loaded project.`, {duration: 4000});
                 appState.isLoadingFileContent = false;
                 return;
            }
            contentForEditor = loadedContentFromDisk;
            originalPersistedContentForCache = loadedContentFromDisk;
            currentHasUnsavedChanges = false;

            editedFiles.set(filePath, {
                content: contentForEditor,
                originalPersistedContent: originalPersistedContentForCache,
                isPatched: false,
                hasUnsavedChanges: currentHasUnsavedChanges
            });
        }

        appState.currentEditingFile = { ...fileData, originalPersistedContent: originalPersistedContentForCache };

        if (!appState.editorInstance) {
            appState.editorInstance = CodeMirror(globalElements.editorContent, {
                value: contentForEditor,
                mode: getCodeMirrorMode(filePath),
                lineNumbers: true,
                theme: "material-darker",
                autoCloseBrackets: true,
                matchBrackets: true,
                styleActiveLine: true,
                lineWrapping: true,
                extraKeys: {
                    "Ctrl-S": () => { saveCurrentFile(); return false; },
                    "Cmd-S": () => { saveCurrentFile(); return false; }
                }
            });
            appState.editorInstance.on("change", handleEditorChange);
        } else {
            appState.editorInstance.off("change", handleEditorChange);
            appState.editorInstance.setValue(contentForEditor);
            appState.editorInstance.setOption("mode", getCodeMirrorMode(filePath));
            appState.editorInstance.setOption("extraKeys", {
                "Ctrl-S": () => { saveCurrentFile(); return false; },
                "Cmd-S": () => { saveCurrentFile(); return false; }
            });
            appState.editorInstance.on("change", handleEditorChange);
            appState.editorInstance.clearHistory();
        }
        updateEditorInfoUI(filePath, contentForEditor, currentHasUnsavedChanges);

        if (globalElements.mainViewTabs && globalElements.tabContentArea && globalElements.fileEditor) {
            appState.previousActiveTabId = appState.activeTabId;
            globalElements.mainViewTabs.style.display = 'none';
            globalElements.tabContentArea.style.display = 'none';
            globalElements.fileEditor.style.display = 'flex';
            appState.editorActiveAsMainView = true;
        }
        setTimeout(() => {
            if (appState.editorInstance) appState.editorInstance.refresh();
        }, 10);

    } catch (err) {
        console.error(`Error opening file ${fileData.path}:`, err);
        errorHandler.showError({
            name: err.name || "FileOpenError",
            message: `Failed to open file: ${fileData.path}. ${err.message}`,
            stack: err.stack,
            cause: err
        });
    } finally {
        appState.isLoadingFileContent = false;
    }
}

function handleEditorChange(cmInstance) {
    if (!appState.currentEditingFile) return;
    const filePath = appState.currentEditingFile.path;
    const currentEditorContent = cmInstance.getValue();

    const fileState = editedFiles.get(filePath);
    if (fileState) {
        fileState.content = currentEditorContent;
        fileState.hasUnsavedChanges = (currentEditorContent !== fileState.originalPersistedContent);
        editedFiles.set(filePath, fileState);
        updateEditorInfoUI(filePath, currentEditorContent, fileState.hasUnsavedChanges);
    } else {
        const originalOnDisk = appState.currentEditingFile.originalPersistedContent || "";
        const changed = currentEditorContent !== originalOnDisk;
        editedFiles.set(filePath, {
            content: currentEditorContent,
            originalPersistedContent: originalOnDisk,
            isPatched: false,
            hasUnsavedChanges: changed
        });
        updateEditorInfoUI(filePath, currentEditorContent, changed);
    }
}

export async function saveCurrentFile() {
    console.log("[saveCurrentFile] Function called. currentEditingFile:", appState.currentEditingFile, "EditorInstance:", !!appState.editorInstance); // ADDED LOG

    if (!appState.currentEditingFile || !appState.editorInstance) {
        notificationSystem.showNotification("No file open to save.", { duration: 2000 });
        return;
    }

    const filePath = appState.currentEditingFile.path;
    const currentEditorContent = appState.editorInstance.getValue();
    const fileState = editedFiles.get(filePath);
    const saveFileBtnEl = document.getElementById('saveFileBtn');

    if (!fileState) { // Should not happen if file is open
        console.error("[saveCurrentFile] No fileState found in cache for open file:", filePath);
        notificationSystem.showNotification(`Error: State for ${filePath} not found.`, { duration: 3000 });
        return;
    }

    // Check hasUnsavedChanges from the authoritative source: the fileState in the map
    if (!fileState.hasUnsavedChanges) {
        console.log(`[saveCurrentFile] ${filePath} has no unsaved changes according to fileState.`);
        notificationSystem.showNotification(`${appState.currentEditingFile.name} has no unsaved changes.`, { duration: 2000 });
        if (saveFileBtnEl) saveFileBtnEl.disabled = true; // Ensure it's disabled
        return;
    }

    console.log('[saveCurrentFile] Attempting to save. Directory Handle:', appState.directoryHandle, 'File:', filePath);

    if (appState.directoryHandle) {
        try {
            await fileSystem.writeFileContent(appState.directoryHandle, filePath, currentEditorContent);
            notificationSystem.showNotification(`Saved to disk: ${filePath}`, { duration: 2000 });
            fileState.originalPersistedContent = currentEditorContent;
            fileState.hasUnsavedChanges = false;
            editedFiles.set(filePath, fileState);
            updateEditorInfoUI(filePath, currentEditorContent, false);
        } catch (err) {
            console.error(`Save to disk failed for ${filePath}:`, err);
            notificationSystem.showNotification(`ERROR: Save to disk failed for ${filePath}. See console.`, { duration: 4000 });
        }
    } else {
        fileState.originalPersistedContent = currentEditorContent;
        fileState.hasUnsavedChanges = false;
        editedFiles.set(filePath, fileState);
        notificationSystem.showNotification(`Changes saved to cache for ${filePath} (project not on disk).`, { duration: 2500 });
        updateEditorInfoUI(filePath, currentEditorContent, false);
    }
}

export function closeEditor() {
    // ... (rest of closeEditor function remains the same)
    if (appState.currentEditingFile) {
        const fileState = editedFiles.get(appState.currentEditingFile.path);
        if (fileState && fileState.hasUnsavedChanges) {
            if (!confirm(`File ${appState.currentEditingFile.name} has unsaved changes. Are you sure you want to close without saving?`)) {
                return;
            }
        }
    }

    if (globalElements.mainViewTabs && globalElements.tabContentArea && globalElements.fileEditor) {
        globalElements.fileEditor.style.display = 'none';
        globalElements.mainViewTabs.style.display = 'flex';
        globalElements.tabContentArea.style.display = 'flex';
        appState.editorActiveAsMainView = false;

        if (appState.previousActiveTabId) {
            uiManager.activateTab(appState.previousActiveTabId);
            appState.previousActiveTabId = null;
        } else {
            uiManager.activateTab('textReportTab');
        }

        if (typeof uiManager.refreshAllUI === 'function') {
            uiManager.refreshAllUI();
        }
    }
    appState.currentEditingFile = null;
    if (globalElements.editorFileTitle) globalElements.editorFileTitle.textContent = "FILE EDITOR";
    if (globalElements.editorInfo) globalElements.editorInfo.textContent = "";

    const saveFileBtnEl = document.getElementById('saveFileBtn');
    if (saveFileBtnEl) saveFileBtnEl.disabled = true;
}

export function hasEditedContent(filePath) {
    const fileState = editedFiles.get(filePath);
    return fileState ? (fileState.hasUnsavedChanges || fileState.isPatched) : false;
}

export function getEditedContent(filePath) {
    return editedFiles.get(filePath)?.content;
}

export function isPatched(filePath) {
    return editedFiles.get(filePath)?.isPatched || false;
}

export function updateFileInEditorCache(filePath, newContent, originalContentBeforePatch, isPatchedStatus = false) {
    const existingState = editedFiles.get(filePath);
    editedFiles.set(filePath, {
        content: newContent,
        originalPersistedContent: newContent,
        isPatched: isPatchedStatus || (existingState?.isPatched || false),
        hasUnsavedChanges: false
    });

    if (appState.currentEditingFile && appState.currentEditingFile.path === filePath) {
        if (appState.editorInstance && appState.editorInstance.getValue() !== newContent) {
            const cursorPos = appState.editorInstance.getCursor();
            appState.editorInstance.setValue(newContent);
            try { appState.editorInstance.setCursor(cursorPos); } catch (e) { /* ignore */ }
        }
        updateEditorInfoUI(filePath, newContent, false);
    }
}

export function getAllEditedFiles() {
    return editedFiles;
}

export function clearEditedFilesCache() {
    editedFiles.clear();
}
// --- ENDFILE: diranalyze/js/fileEditor.js --- //