// --- FILE: diranalyze/js/main.js --- //
import * as fileSystem from './fileSystem.js';
import * as uiManager from './uiManager.js';
import * as treeView from './treeView.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';
import { initAiPatcher } from 'aiPatcher';
import * as zipManager from 'zipManager';
import * as utils from 'utils';
import * as scaffoldImporter from 'scaffoldImporter';
import * as sidebarResizer from './sidebarResizer.js';
import * as aiDebriefingAssistant from 'aiDebriefingAssistant';

export const appState = {
    activeTabId: 'textReportTab',
    fullScanData: null,
    committedScanData: null,
    selectionCommitted: false,
    processingInProgress: false,
    currentEditingFile: null,
    initialLoadComplete: false,
    editorInstance: null,
    previewEditorInstance: null,
    isLoadingFileContent: false,
    editorActiveAsMainView: false,
    previousActiveTabId: null,
    directoryHandle: null, // This is the crucial state variable
    saveState: null,
};

export let elements = {};

function populateElements() {
    const elementIds = {
        pageLoader: 'pageLoader', dropZone: 'dropZone', selectFolderBtn: 'selectFolderBtn',
        treeContainer: 'treeContainer', globalStatsDiv: 'globalStats', selectionSummaryDiv: 'selectionSummary',
        appContainer: 'appContainer', leftSidebar: 'leftSidebar', sidebarResizer: 'sidebarResizer',
        mainView: 'mainView', mainViewTabs: 'mainViewTabs', tabContentArea: 'tabContentArea',
        rightStatsPanel: 'rightStatsPanel', treeViewControls: 'treeViewControls', generalActions: 'generalActions',
        loader: 'loader', textOutputEl: 'textOutput', copyReportButton: 'copyReportButton',
        selectAllBtn: 'selectAllBtn', deselectAllBtn: 'deselectAllBtn', commitSelectionsBtn: 'commitSelectionsBtn',
        expandAllBtn: 'expandAllBtn', collapseAllBtn: 'collapseAllBtn',
        downloadProjectBtn: 'downloadProjectBtn', clearProjectBtn: 'clearProjectBtn',
        restoreStateBtn: 'restoreStateBtn', saveStateStatus: 'saveStateStatus',
        filePreview: 'filePreview', filePreviewTitle: 'filePreviewTitle',
        filePreviewContentWrapper: 'filePreviewContentWrapper', filePreviewContent: 'filePreviewContent',
        closePreview: 'closePreview', textOutputContainerOuter: 'textOutputContainerOuter',
        visualOutputContainer: 'visualOutputContainer', notification: 'notification', errorReport: 'errorReport',
        fileEditor: 'fileEditor', editorFileTitle: 'editorFileTitle', editorContent: 'editorContent',
        closeEditorBtn: 'closeEditorBtn', aiPatchPanel: 'aiPatchPanel', aiPatchInput: 'aiPatchInput',
        applyAiPatchBtn: 'applyAiPatchBtn', aiPatchOutputLog: 'aiPatchOutputLog',
        aiPatchDiffModal: 'aiPatchDiffModal', diffFilePath: 'diffFilePath', diffOutputContainer: 'diffOutputContainer',
        closeAiPatchDiffModal: 'closeAiPatchDiffModal', confirmApplyPatchChanges: 'confirmApplyPatchChanges',
        skipPatchChanges: 'skipPatchChanges', cancelAllPatchChanges: 'cancelAllPatchChanges',
        mainActionDiv: 'mainAction', importAiScaffoldBtn: 'importAiScaffoldBtn',
        copyScaffoldPromptBtn: 'copyScaffoldPromptBtn', scaffoldImportModal: 'scaffoldImportModal',
        closeScaffoldModalBtn: 'closeScaffoldModalBtn', aiScaffoldJsonInput: 'aiScaffoldJsonInput',
        createProjectFromScaffoldBtn: 'createProjectFromScaffoldBtn', cancelScaffoldImportBtn: 'cancelScaffoldImportBtn',
        textReportTab: 'textReportTab', aiPatcherTab: 'aiPatcherTab',
        aiDebriefingAssistantBtn: 'aiDebriefingAssistantBtn',
        copyPatchPromptBtn: 'copyPatchPromptBtn',
    };
    for (const key in elementIds) elements[key] = document.getElementById(elementIds[key]);
    elements.fileTypeTableBody = document.querySelector('#fileTypeTable tbody');
}

function setupEventListeners() {
    elements.dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    elements.dropZone?.addEventListener('dragenter', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });
    elements.dropZone?.addEventListener('dragleave', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
    });
    elements.dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        handleFileDrop(e);
    });
    elements.selectFolderBtn?.addEventListener('click', handleFolderSelect);
    elements.commitSelectionsBtn?.addEventListener('click', commitSelections);
    elements.downloadProjectBtn?.addEventListener('click', zipManager.downloadProjectAsZip);
    elements.clearProjectBtn?.addEventListener('click', clearProjectData);

    elements.selectAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.setAllSelections(true);
    });
    elements.deselectAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.setAllSelections(false);
    });
    elements.expandAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.toggleAllFolders(false);
    });
    elements.collapseAllBtn?.addEventListener('click', () => {
        if (!appState.fullScanData) return;
        treeView.toggleAllFolders(true);
    });

    elements.copyReportButton?.addEventListener('click', () => {
        if (elements.textOutputEl && elements.textOutputEl.textContent && appState.activeTabId === 'textReportTab') {
            navigator.clipboard.writeText(elements.textOutputEl.textContent)
                .then(() => notificationSystem.showNotification("Report copied to clipboard!", { duration: 2000 }))
                .catch(err => {
                    console.error("Failed to copy report:", err);
                    notificationSystem.showNotification("Failed to copy report. See console.", { duration: 3000 });
                });
        } else {
            notificationSystem.showNotification("No report content to copy or not on report tab.", { duration: 3000 });
        }
    });

    elements.closePreview?.addEventListener('click', () => {
        if (elements.filePreview) elements.filePreview.style.display = 'none';
        if (appState.previewEditorInstance) {
            // appState.previewEditorInstance.setValue(''); // Optionally clear
        }
    });
    const cancelAiDebriefBtn = document.getElementById('cancelAiDebriefBtn');
    if (cancelAiDebriefBtn && elements.closeAiDebriefingAssistantModalBtn) {
        cancelAiDebriefBtn.addEventListener('click', () => {
            elements.closeAiDebriefingAssistantModalBtn.click();
        });
    }
}

async function handleFileDrop(event) {
    if (appState.processingInProgress) return;

    const items = event.dataTransfer.items;

    if (items && items.length > 0) {
        for (const item of items) {
            // Ensure the method exists before calling it.
            if (typeof item.getAsFileSystemHandle === 'function') {
                try {
                    const handle = await item.getAsFileSystemHandle();
                    if (handle && handle.kind === 'directory') {
                        // Found a directory, process it and we're done.
                        await verifyAndProcessDirectory(handle);
                        return; // Successfully processed, exit the function.
                    }
                } catch (err) {
                    console.warn("Could not get a handle for a dropped item.", err);
                }
            }
        }
    }
    
    // If the loop completes and we haven't returned, it means no directory was found.
    errorHandler.showError({ 
        name: "DirectoryDropError", 
        message: "No folder was found in the dropped items. Please ensure you are dropping a valid directory."
    });
}

async function handleFolderSelect() {
    if (appState.processingInProgress) return;
    try {
        const handle = await window.showDirectoryPicker();
        await verifyAndProcessDirectory(handle);
    } catch (err) {
        if (err.name !== 'AbortError') {
            errorHandler.showError({ name: err.name, message: `Could not select folder: ${err.message}`});
        }
        console.log("Folder selection aborted or failed:", err);
    }
}

async function verifyAndProcessDirectory(passedDirectoryHandle) {
    // `passedDirectoryHandle` is the fresh handle from picker/drop
    if (!passedDirectoryHandle) {
        errorHandler.showError({ name: "InternalError", message: "No directory handle provided for processing." });
        return;
    }

    try {
        let permissionGranted = false;
        if (await passedDirectoryHandle.queryPermission({ mode: 'readwrite' }) === 'granted') {
            permissionGranted = true;
        } else {
            if (await passedDirectoryHandle.requestPermission({ mode: 'readwrite' }) === 'granted') {
                permissionGranted = true;
            } else {
                if (await passedDirectoryHandle.queryPermission({ mode: 'read' }) === 'granted' || await passedDirectoryHandle.requestPermission({ mode: 'read' }) === 'granted') {
                     notificationSystem.showNotification("Write permission denied. Proceeding in read-only mode for this folder.", { duration: 4000 });
                     permissionGranted = true; 
                } else {
                    errorHandler.showError({ name: "PermissionError", message: "Read permission also denied. Cannot process folder." });
                    return;
                }
            }
        }
    } catch (err) {
        errorHandler.showError({ name: "PermissionError", message: `Error requesting permissions: ${err.message}`});
        return;
    }

    // Call reset which will clear the global appState.directoryHandle
    resetUIForProcessing(`Processing '${passedDirectoryHandle.name}'...`);

    // NOW, assign the fresh, permission-verified handle to the global appState
    appState.directoryHandle = passedDirectoryHandle;
    console.log('[verifyAndProcessDirectory] appState.directoryHandle SET TO:', appState.directoryHandle);


    try {
        // Process using the now globally set appState.directoryHandle
        appState.fullScanData = await fileSystem.processDirectoryEntryRecursive(appState.directoryHandle, appState.directoryHandle.name, 0);
        appState.committedScanData = appState.fullScanData;
        appState.selectionCommitted = true;
        if (elements.treeContainer) elements.treeContainer.innerHTML = '';
        treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        uiManager.refreshAllUI();
        enableUIControls(); 
        console.log('[verifyAndProcessDirectory] Processing complete. appState.directoryHandle IS:', appState.directoryHandle);
    } catch (err) {
        showFailedUI("Directory processing failed.");
        errorHandler.showError(err);
        appState.directoryHandle = null; // Nullify if processing failed
    } finally {
        appState.processingInProgress = false;
        if(elements.loader) elements.loader.classList.remove('visible');
    }
}

export function resetUIForProcessing(loaderMsg = "ANALYSING...") {
    console.trace("resetUIForProcessing called. Directory handle will be cleared.");
    appState.processingInProgress = true;
    if (elements.loader) {
        elements.loader.textContent = loaderMsg;
        elements.loader.classList.add('visible');
    }
    fileEditor.closeEditor();
    appState.fullScanData = null;
    appState.committedScanData = null;
    appState.selectionCommitted = false;
    appState.directoryHandle = null; // Clears the global handle
    fileEditor.clearEditedFilesCache();
    if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP FOLDER OR IMPORT SCAFFOLD</div>';
    disableUIControls();
    uiManager.activateTab('textReportTab');
}

export function enableUIControls() {
    const hasData = !!appState.fullScanData;
    
    if (elements.commitSelectionsBtn) elements.commitSelectionsBtn.disabled = !hasData;
    if (elements.downloadProjectBtn) elements.downloadProjectBtn.disabled = !hasData;
    if (elements.clearProjectBtn) elements.clearProjectBtn.disabled = !hasData;
    if (elements.aiDebriefingAssistantBtn) elements.aiDebriefingAssistantBtn.disabled = !hasData;
    if (elements.selectAllBtn) elements.selectAllBtn.disabled = !hasData;
    if (elements.deselectAllBtn) elements.deselectAllBtn.disabled = !hasData;
    if (elements.expandAllBtn) elements.expandAllBtn.disabled = !hasData;
    if (elements.collapseAllBtn) elements.collapseAllBtn.disabled = !hasData;

    if (elements.copyReportButton) elements.copyReportButton.disabled = !(hasData && appState.activeTabId === 'textReportTab');
    if (elements.copyPatchPromptBtn) elements.copyPatchPromptBtn.disabled = !hasData;
}

function disableUIControls() {
    if (elements.commitSelectionsBtn) elements.commitSelectionsBtn.disabled = true;
    if (elements.downloadProjectBtn) elements.downloadProjectBtn.disabled = true;
    if (elements.clearProjectBtn) elements.clearProjectBtn.disabled = true;
    if (elements.aiDebriefingAssistantBtn) elements.aiDebriefingAssistantBtn.disabled = true;
    if (elements.selectAllBtn) elements.selectAllBtn.disabled = true;
    if (elements.deselectAllBtn) elements.deselectAllBtn.disabled = true;
    if (elements.expandAllBtn) elements.expandAllBtn.disabled = true;
    if (elements.collapseAllBtn) elements.collapseAllBtn.disabled = true;
    if (elements.copyReportButton) elements.copyReportButton.disabled = true;
    if (elements.copyPatchPromptBtn) elements.copyPatchPromptBtn.disabled = true;
}

export function showFailedUI(message = "OPERATION FAILED") {
    if (elements.textOutputEl) elements.textOutputEl.textContent = message;
    uiManager.activateTab('textReportTab');
    if(elements.loader) elements.loader.classList.remove('visible');
    appState.processingInProgress = false;
    // Re-enable the initial action buttons after failure
    if (elements.importAiScaffoldBtn) elements.importAiScaffoldBtn.disabled = false;
    if (elements.selectFolderBtn) elements.selectFolderBtn.disabled = false;
    if (elements.copyScaffoldPromptBtn) elements.copyScaffoldPromptBtn.disabled = false;
}

function commitSelections() {
    if (!appState.fullScanData || !elements.treeContainer) return;
    const selectedPaths = new Set();
    elements.treeContainer.querySelectorAll('li[data-selected="true"]').forEach(li => {
        if (li.dataset.path) selectedPaths.add(li.dataset.path);
    });

    if (selectedPaths.size === 0 && appState.fullScanData.allFilesList.length > 0) {
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, new Set()); // Empty set
        notificationSystem.showNotification("Committed an empty selection.", { duration: 2000 });
    } else if (selectedPaths.size === 0 && appState.fullScanData.allFilesList.length === 0) {
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, new Set());
        notificationSystem.showNotification("No items to commit in the current project.", { duration: 2000 });
    } else {
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, selectedPaths);
        notificationSystem.showNotification("Selections committed.", { duration: 1500 });
    }
    appState.selectionCommitted = true;
    uiManager.refreshAllUI();
}

function clearProjectData() {
    resetUIForProcessing("DROP FOLDER OR IMPORT SCAFFOLD");
    if(elements.loader) elements.loader.classList.remove('visible');
    
    if (elements.importAiScaffoldBtn) elements.importAiScaffoldBtn.disabled = false;
    if (elements.selectFolderBtn) elements.selectFolderBtn.disabled = false;
    if (elements.copyScaffoldPromptBtn) elements.copyScaffoldPromptBtn.disabled = false;
}

function initApp() {
    populateElements();
    notificationSystem.initNotificationSystem();
    errorHandler.initErrorHandlers();
    fileEditor.initFileEditor();
    initAiPatcher(appState, elements);
    scaffoldImporter.initScaffoldImporter();
    aiDebriefingAssistant.initAiDebriefingAssistant();
    uiManager.initTabs(appState, elements);
    sidebarResizer.initResizer(elements.leftSidebar, elements.sidebarResizer, elements.mainView);
    setupEventListeners();

    elements.pageLoader.classList.add('hidden');
    document.body.classList.add('loaded');
    appState.initialLoadComplete = true;
    console.log("DirAnalyse Matrix Initialized (v. Full Replacement).");
    
    // Initial state of controls
    disableUIControls();
    if (elements.importAiScaffoldBtn) elements.importAiScaffoldBtn.disabled = false;
    if (elements.selectFolderBtn) elements.selectFolderBtn.disabled = false;
    if (elements.copyScaffoldPromptBtn) elements.copyScaffoldPromptBtn.disabled = false;
}

document.addEventListener('DOMContentLoaded', initApp);
// --- ENDFILE: diranalyze/js/main.js --- //