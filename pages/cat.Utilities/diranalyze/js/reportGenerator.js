// --- FILE: js/reportGenerator.js --- //
import { formatBytes } from './utils.js';
import * as fileEditor from 'fileEditor'; // Keep for potential future use if report includes edit status
import { appState } from './main.js';

export function generateTextReport(currentDisplayData) {
    if (!currentDisplayData || !currentDisplayData.directoryData) {
        return "// NO DATA AVAILABLE FOR REPORT (Selection might be empty or not committed) //";
    }
    const rootNode = currentDisplayData.directoryData;

    let report = `//--- DIRANALYSE MATRIX REPORT (v3.2.1) ---//\n`; // Version bump for report style change
    report += `// Timestamp: ${new Date().toISOString()}\n`;
    report += `// Root Path: ${rootNode.name}\n`;

    if (appState.fullScanData && (currentDisplayData.allFilesList.length !== appState.fullScanData.allFilesList.length || currentDisplayData.allFoldersList.length !== appState.fullScanData.allFoldersList.length)) {
        report += `// Scope: Committed user selection\n`;
    } else {
        report += `// Scope: Full scanned directory\n`;
    }
    report += `// Note: File sizes reflect original scanned values.\n`;
    report += `//\n`;
    report += `//--- DIRECTORY STRUCTURE ---\n`;

    report += buildTextTreeRecursive(rootNode, "", true); // Pass true for isLast for the root

    if (!rootNode.children || rootNode.children.length === 0 && rootNode.fileCount === 0) {
        report += `${rootNode.name || "(Root)"} (is empty or all items filtered out)\n`;
    }

    report += `//\n`;
    report += `//--- SUMMARY (Current View) ---\n`;
    const totalSizeFromList = currentDisplayData.allFilesList.reduce((s, f) => s + (f.size || 0), 0);
    report += `Total Files in View    : ${currentDisplayData.allFilesList.length}\n`;
    report += `Total Folders in View  : ${currentDisplayData.allFoldersList.length}\n`; // This lists folder *nodes*, not just subdirectories of root
    report += `Total Size (Original)  : ${formatBytes(totalSizeFromList)}\n`;
    report += `//\n`;
    report += `//--- END OF REPORT ---//`;

    return report;
}

// Unicode characters for tree drawing (Box Drawing characters)
const TEE = '├'; // U+251C
const ELBOW = '└'; // U+2514
const VERTICAL = '│'; // U+2502
const HORIZONTAL = '─'; // U+2500
const SPACE = ' ';

/**
 * Builds a text-based tree structure.
 * @param {object} node - The current node in the directory structure.
 * @param {string} prefix - The prefix string for drawing lines.
 * @param {boolean} isLast - Whether this node is the last child of its parent.
 */
function buildTextTreeRecursive(node, prefix = "", isRoot = false) {
    let entryString = "";
    let nodePrefix = prefix;

    if (!isRoot) { // Root node doesn't get a connector from "above"
        nodePrefix = prefix.slice(0, -((VERTICAL + SPACE + SPACE + SPACE).length)) +
                     (node.isLastChild ? ELBOW : TEE) +
                     HORIZONTAL + HORIZONTAL + SPACE;
    } else {
        // For the root, no line prefix, just the name.
        // The initial call to buildTextTreeRecursive will handle the root's name.
    }

    let stats = '';
    if (node.type === 'folder') {
        stats = `(Files: ${node.fileCount || 0}, Subdirs: ${node.dirCount || 0}, Size: ${formatBytes(node.totalSize || 0)})`;
        entryString += `${nodePrefix}${node.name}/ ${stats}\n`;
    } else { // file
        stats = `(Size: ${formatBytes(node.size || 0)}, Ext: ${node.extension || '(no ext)'})`;
        entryString += `${nodePrefix}${node.name} ${stats}\n`;
    }

    if (node.type === 'folder' && node.children && node.children.length > 0) {
        const children = [...node.children].sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });

        children.forEach((child, index) => {
            child.isLastChild = index === children.length - 1; // Mark if it's the last child
            let childPrefix = prefix;
            if (!isRoot) { // Only add to prefix if not the root's direct children
                childPrefix += (node.isLastChild ? (SPACE + SPACE + SPACE + SPACE) : (VERTICAL + SPACE + SPACE + SPACE));
            } else { // For root's children, the prefix starts fresh
                 childPrefix = (child.isLastChild ? (SPACE + SPACE + SPACE + SPACE) : (VERTICAL + SPACE + SPACE + SPACE));
            }
            // The first call for the root's children will establish the base prefix
            entryString += buildTextTreeRecursive(child, childPrefix, false);
        });
    }
    return entryString;
}

// Initial call for the root node modification (example, if you want the root to also have this style)
// This would require changing how the first line is generated in generateTextReport.
// For now, the buildTextTreeRecursive is called for children of the root.
// Let's adjust generateTextReport to call it properly for the root too.

// Modified generateTextReport to call buildTextTreeRecursive for the root node itself.
export function generateTextReport_revised(currentDisplayData) {
    if (!currentDisplayData || !currentDisplayData.directoryData) {
        return "// NO DATA AVAILABLE FOR REPORT (Selection might be empty or not committed) //";
    }
    const rootNode = currentDisplayData.directoryData;
    rootNode.isLastChild = true; // The root is effectively the last child of a conceptual "nothing"

    let report = `//--- DIRANALYSE MATRIX REPORT (v3.2.2) ---//\n`;
    report += `// Timestamp: ${new Date().toISOString()}\n`;
    // Root Path is now part of the tree itself.
    // report += `// Root Path: ${rootNode.name}\n`;

    if (appState.fullScanData && (currentDisplayData.allFilesList.length !== appState.fullScanData.allFilesList.length || currentDisplayData.allFoldersList.length !== appState.fullScanData.allFoldersList.length)) {
        report += `// Scope: Committed user selection\n`;
    } else {
        report += `// Scope: Full scanned directory\n`;
    }
    report += `// Note: File sizes reflect original scanned values.\n`;
    report += `//\n`;
    report += `//--- DIRECTORY STRUCTURE ---\n`;

    // Directly build the tree starting from the root.
    // The buildTextTreeRecursive function itself will handle the root's display.
    // We pass an empty prefix and isRoot=true.
    report += buildTextTreeRecursive(rootNode, "", true);

    if (!rootNode.children || rootNode.children.length === 0 && rootNode.fileCount === 0) {
        // This case might be redundant if the tree output for an empty root is sufficient.
        // report += `${rootNode.name || "(Root)"} (is empty or all items filtered out)\n`;
    }

    report += `//\n`;
    report += `//--- SUMMARY (Current View) ---\n`;
    const totalSizeFromList = currentDisplayData.allFilesList.reduce((s, f) => s + (f.size || 0), 0);
    report += `Total Files in View    : ${currentDisplayData.allFilesList.length}\n`;
    report += `Total Folders in View  : ${currentDisplayData.allFoldersList.length}\n`;
    report += `Total Size (Original)  : ${formatBytes(totalSizeFromList)}\n`;
    report += `//\n`;
    report += `//--- END OF REPORT ---//`;

    return report;
}


// --- ENDFILE: js/reportGenerator.js --- //