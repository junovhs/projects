// --- FILE: js/uiManager.js --- //
import { appState, elements } from './main.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as utils from './utils.js';
import * as fileEditor from './fileEditor.js';

export function initTabs() {
    const tabButtons = document.querySelectorAll('#mainViewTabs .tab-button');
    const tabContents = document.querySelectorAll('#tabContentArea .tab-content-item');

    if (!elements.mainViewTabs || !elements.tabContentArea) {
        console.warn("Main view tabs or content area not found. Tab system will not initialize.");
        return;
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            activateTab(button.dataset.tab);
        });
    });

    // Set initial active tab (e.g., from appState or default to first if none set)
    // This is better handled after a project loads or in resetUI,
    // as initially no tab content might be relevant.
    // For now, ensure no tab is active by default if no project is loaded.
    if (!appState.fullScanData) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        appState.activeTabId = null;
    } else if (appState.activeTabId) {
        activateTab(appState.activeTabId);
    } else if (tabButtons.length > 0) {
        activateTab(tabButtons[0].dataset.tab); // Default to first tab if a project is loaded
    }
}

export function activateTab(tabIdToActivate) {
    const tabButtons = document.querySelectorAll('#mainViewTabs .tab-button');
    const tabContents = document.querySelectorAll('#tabContentArea .tab-content-item');

    let newActiveTabFound = false;

    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabIdToActivate) {
            btn.classList.add('active');
            newActiveTabFound = true;
        } else {
            btn.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === tabIdToActivate) {
            content.classList.add('active');
            content.style.display = 'flex'; // or 'block' based on your .active style
        } else {
            content.classList.remove('active');
            content.style.display = 'none';
        }
    });

    if (newActiveTabFound) {
        appState.activeTabId = tabIdToActivate;
        // Specific refresh logic for tabs when they become active
        // Add more refresh logic for other tabs if needed (e.g., AI Patcher)
    } else if (tabButtons.length > 0 && !appState.fullScanData) {
        // If no specific tab to activate and no project, ensure all are inactive
        appState.activeTabId = null;
    } else if (tabButtons.length > 0) {
        // Fallback: if the target tab ID was invalid but a project is loaded, activate the first tab.
        const firstTabButton = tabButtons[0];
        activateTab(firstTabButton.dataset.tab);
        return; // Prevent infinite recursion if first tab also fails (should not happen)
    }


    // Update copySelectedBtn disabled state based on whether combineModeTab is active
    if (elements.copySelectedBtn) {
         const textFilesInCommitted = appState.committedScanData?.allFilesList.filter(file => utils.isLikelyTextFile(file.path)).length > 0;
         elements.copySelectedBtn.disabled = !(appState.activeTabId === 'combineModeTab' && appState.selectionCommitted && textFilesInCommitted);
    }
}


export function refreshAllUI() {
    if (!appState.fullScanData) {
        if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER OR SELECT ONE TO BEGIN.</div>';
        if (elements.globalStatsDiv) elements.globalStatsDiv.innerHTML = '<div class="empty-notice">NO DATA FOR STATS.</div>';
        if (elements.selectionSummaryDiv) elements.selectionSummaryDiv.style.display = 'none';
        if (elements.fileTypeTableBody) elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';
        if (elements.textOutputEl && elements.textReportTab && elements.textReportTab.classList.contains('active')) {
            elements.textOutputEl.textContent = "// NO PROJECT LOADED //";
        }
        if (elements.aiPatchPanel && elements.aiPatcherTab && elements.aiPatcherTab.classList.contains('active')) {
            if(elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent = "Load a project and commit selections to use the AI Patcher.";
        }

        if (elements.copyReportButton) elements.copyReportButton.disabled = true;
        if (elements.copySelectedBtn) elements.copySelectedBtn.disabled = true;
        return;
    }

    const displayData = appState.selectionCommitted ? appState.committedScanData : appState.fullScanData;

    if (!displayData || !displayData.directoryData || (displayData.allFilesList.length === 0 && displayData.allFoldersList.length === 0 && (!displayData.directoryData.children || displayData.directoryData.children.length === 0)) ) {
        if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">NO ITEMS IN CURRENT VIEW / SELECTION.</div>';
        if (elements.globalStatsDiv) elements.globalStatsDiv.innerHTML = '<div class="empty-notice">NO DATA FOR STATS.</div>';
        if (elements.selectionSummaryDiv) elements.selectionSummaryDiv.style.display = 'none';
        if (elements.fileTypeTableBody) elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';

        if (appState.activeTabId === 'textReportTab' && elements.textOutputEl) {
            elements.textOutputEl.textContent = "// NO ITEMS IN CURRENT VIEW / SELECTION //";
        }
        if (appState.activeTabId === 'combineModeTab') {
            combineMode.updateCombineModeListDisplay(); // Shows empty notice
        }
         if (appState.activeTabId === 'aiPatcherTab' && elements.aiPatchOutputLog) {
            elements.aiPatchOutputLog.textContent = "No items in current view/selection for patching.";
        }

        if (elements.copyReportButton) elements.copyReportButton.disabled = true;
        if (elements.copySelectedBtn) elements.copySelectedBtn.disabled = true;
        return;
    }

    updateVisualTreeFiltering(); // This should ideally be part of treeView module or called selectively
    statsManager.displayGlobalStats(displayData, appState.fullScanData); // Populates #rightStatsPanel

    // Update content for the currently active tab
    if (appState.activeTabId === 'textReportTab' && elements.textOutputEl) {
        elements.textOutputEl.textContent = reportGenerator.generateTextReport(displayData);
    }
    if (appState.activeTabId === 'combineModeTab') {
        combineMode.updateCombineModeListDisplay();
    }
    // AI Patcher content (like logs) might update based on its own operations, not just refreshAllUI.

    if (elements.copyReportButton) elements.copyReportButton.disabled = !(appState.activeTabId === 'textReportTab');

    const textFilesInCommitted = appState.committedScanData?.allFilesList.filter(file => utils.isLikelyTextFile(file.path)).length > 0;
    if (elements.copySelectedBtn) {
      elements.copySelectedBtn.disabled = !(appState.activeTabId === 'combineModeTab' && appState.selectionCommitted && textFilesInCommitted);
    }

    if (appState.currentEditingFile && elements.fileEditor.style.display === 'flex') {
        const currentFileState = fileEditor.getAllEditedFiles().get(appState.currentEditingFile.path);
        if (currentFileState) {
            if (currentFileState.savedInSession) {
                fileEditor.setEditorStatus(currentFileState.isPatched ? 'patched_saved' : 'saved');
            } else {
                 (async () => {
                    const fileToRecheck = appState.fullScanData.allFilesList.find(f => f.path === appState.currentEditingFile.path);
                    if(fileToRecheck){
                        const tempCurrentFile = appState.currentEditingFile;
                        appState.currentEditingFile = null; // Temporarily nullify
                        await fileEditor.openFileInEditor(fileToRecheck); // This re-evaluates status
                        appState.currentEditingFile = tempCurrentFile; // Restore
                    } else {
                         fileEditor.setEditorStatus('unsaved');
                    }
                 })();
            }
        }
    }
}

function updateVisualTreeFiltering() {
    if (!appState.fullScanData || !elements.treeContainer) return;

    const committedPaths = new Set();
    if (appState.selectionCommitted && appState.committedScanData?.directoryData) {
        // Helper to collect all paths (files and folders) from the committed data structure
        // This needs to be recursive to get all paths within committed folders.
        function collectPathsRecursive(node, pathSet) {
            if (!node) return;
            pathSet.add(node.path);
            if (node.type === 'folder' && node.children) {
                node.children.forEach(child => collectPathsRecursive(child, pathSet));
            }
        }
        collectPathsRecursive(appState.committedScanData.directoryData, committedPaths);
    }

    elements.treeContainer.querySelectorAll('li').forEach(li => {
        const path = li.dataset.path;

        // Reset states first
        li.classList.remove('dimmed-uncommitted');
        li.classList.remove('filtered-out'); // Ensure 'filtered-out' is also reset

        if (appState.selectionCommitted && committedPaths.size > 0) {
            // If a commit has occurred and there are items in the committed selection
            if (!committedPaths.has(path)) {
                li.classList.add('dimmed-uncommitted');
            }
            // Items in committedPaths will not have 'dimmed-uncommitted' (already removed above)
        }
        // If no selection is committed OR if the committed selection is empty (e.g., user deselects all and commits),
        // then no items are dimmed. All items remain fully visible.
    });
}

// This function is now largely obsolete due to tab system
export function setViewModeUI(isCombine) {
    // console.log("DEPRECATED: setViewModeUI called. Tabs now control views.");
    // If you need to programmatically switch tabs, use activateTab(tabId).
    // For example, to switch to combine mode: activateTab('combineModeTab');
}
// --- ENDFILE: js/uiManager.js --- //