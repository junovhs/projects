// --- FILE: diranalyze/js/fileSystem.js --- //
import { appState, elements } from './main.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';
import { getFileExtension } from './utils.js'; // For CodeMirror mode
import * as utils from './utils.js';

export async function processDirectoryEntryRecursive(dirHandle, currentPath, depth, parentAggregator = null) {
    const ignoreList = ['.git', 'node_modules', '.vscode', '.idea', 'dist', 'build', 'target'];

    if (ignoreList.includes(dirHandle.name)) {
        console.log(`Ignoring directory: ${dirHandle.name}`);
        // Return a structure that looks like an empty directory to prevent errors upstream
        const emptyDirData = {
            name: dirHandle.name, path: currentPath, type: 'folder', depth,
            children: [], fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {},
            entryHandle: dirHandle
        };
        return depth === 0 ? { directoryData: emptyDirData, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 } : { directoryData: emptyDirData };
    }

    try {
        const dirData = {
            name: dirHandle.name, path: currentPath, type: 'folder', depth,
            children: [], fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {},
            entryHandle: dirHandle
        };

        let aggregator = parentAggregator || {
            allFilesList: [], allFoldersList: [], maxDepth: depth,
            deepestPathExample: currentPath, emptyDirCount: 0
        };

        if (depth > aggregator.maxDepth) {
            aggregator.maxDepth = depth;
            aggregator.deepestPathExample = currentPath;
        }
        aggregator.allFoldersList.push({ name: dirData.name, path: dirData.path, entryHandle: dirData.entryHandle });

        const entries = [];
        for await (const entry of dirHandle.values()) {
            entries.push(entry);
        }

        if (entries.length === 0 && depth > 0) aggregator.emptyDirCount++;

        for (const entry of entries) {
            if (ignoreList.includes(entry.name)) {
                console.log(`Ignoring entry: ${entry.name}`);
                continue; // Skip this entry
            }
            const entryPath = `${currentPath}/${entry.name}`;
            if (entry.kind === 'file') {
                try {
                    const file = await entry.getFile();
                    const fileInfo = {
                        name: file.name, type: 'file', size: file.size, path: entryPath,
                        extension: getFileExtension(file.name), depth: depth + 1, entryHandle: entry
                    };
                    dirData.children.push(fileInfo);
                    dirData.fileCount++;
                    dirData.totalSize += file.size;
                    aggregator.allFilesList.push({ ...fileInfo }); // Use a copy
                    const ext = fileInfo.extension;
                    if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                    dirData.fileTypes[ext].count++;
                    dirData.fileTypes[ext].size += file.size;
                } catch (err) {
                    console.warn(`Skipping file ${entry.name}: ${err.message}`);
                }
            } else if (entry.kind === 'directory') {
                try {
                    const subResults = await processDirectoryEntryRecursive(entry, entryPath, depth + 1, aggregator);
                    dirData.children.push(subResults.directoryData);
                    dirData.dirCount++;
                    dirData.fileCount += subResults.directoryData.fileCount;
                    dirData.dirCount += subResults.directoryData.dirCount;
                    dirData.totalSize += subResults.directoryData.totalSize;
                    Object.entries(subResults.directoryData.fileTypes).forEach(([ext, data]) => {
                        if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                        dirData.fileTypes[ext].count += data.count;
                        dirData.fileTypes[ext].size += data.size;
                    });
                } catch (err) {
                    console.warn(`Skipping directory ${entry.name}: ${err.message}`);
                }
            }
        }
        return depth === 0 ? { directoryData: dirData, ...aggregator } : { directoryData: dirData };
    } catch (err) {
        err.path = currentPath;
        throw err;
    }
}

export function filterScanData(fullData, selectedPathsSet) {
    if (!fullData || !fullData.directoryData) {
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }

    function filterNodeRecursive(node) {
        if (node.type === 'file') {
            return selectedPathsSet.has(node.path) ? { ...node } : null;
        }

        const filteredChildren = node.children
            .map(child => filterNodeRecursive(child))
            .filter(child => child !== null);

        if (!selectedPathsSet.has(node.path) && filteredChildren.length === 0) {
            return null;
        }

        const filteredFolder = { ...node, children: filteredChildren };
        filteredFolder.fileCount = 0;
        filteredFolder.dirCount = 0;
        filteredFolder.totalSize = 0;
        filteredFolder.fileTypes = {};
        filteredChildren.forEach(fc => {
            if (fc.type === 'file') {
                filteredFolder.fileCount++;
                filteredFolder.totalSize += fc.size;
                if (!filteredFolder.fileTypes[fc.extension]) filteredFolder.fileTypes[fc.extension] = { count: 0, size: 0 };
                filteredFolder.fileTypes[fc.extension].count++;
                filteredFolder.fileTypes[fc.extension].size += fc.size;
            } else {
                filteredFolder.dirCount++;
                filteredFolder.dirCount += fc.dirCount;
                filteredFolder.fileCount += fc.fileCount;
                filteredFolder.totalSize += fc.totalSize;
                Object.entries(fc.fileTypes).forEach(([ext, data]) => {
                    if (!filteredFolder.fileTypes[ext]) filteredFolder.fileTypes[ext] = { count: 0, size: 0 };
                    filteredFolder.fileTypes[ext].count += data.count;
                    filteredFolder.fileTypes[ext].size += data.size;
                });
            }
        });
        return filteredFolder;
    }

    const filteredDirectoryData = filterNodeRecursive(fullData.directoryData);
    if (!filteredDirectoryData) {
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }

    const filteredAllFiles = [];
    const filteredAllFolders = [];
    function collectFiltered(node, filesArr, foldersArr) {
        if (!node) return;
        if (node.type === 'file') {
            filesArr.push({ ...node });
        } else {
            foldersArr.push({ name: node.name, path: node.path, entryHandle: node.entryHandle });
            if (node.children) node.children.forEach(child => collectFiltered(child, filesArr, foldersArr));
        }
    }
    collectFiltered(filteredDirectoryData, filteredAllFiles, filteredAllFolders);

    return {
        directoryData: filteredDirectoryData,
        allFilesList: filteredAllFiles,
        allFoldersList: filteredAllFolders,
        maxDepth: fullData.maxDepth,
        deepestPathExample: fullData.deepestPathExample,
        emptyDirCount: fullData.emptyDirCount
    };
}

export async function readFileContent(fileEntryOrHandle, filePathForEditedCheck = null, forceOriginal = false) {
    const pathKey = filePathForEditedCheck || fileEntryOrHandle?.path || fileEntryOrHandle?.fullPath || fileEntryOrHandle?.name;
    const isText = utils.isLikelyTextFile(pathKey);

    try {
        // For text files, check the editor cache first (unless forcing original)
        if (isText && !forceOriginal && pathKey && fileEditor.hasEditedContent(pathKey)) {
            return fileEditor.getEditedContent(pathKey);
        }

        if (!fileEntryOrHandle) {
            throw new Error(`Invalid file entry or handle provided for '${pathKey}'`);
        }

        let file;
        // Get the File object from various handle types
        if (fileEntryOrHandle.kind === 'file' && typeof fileEntryOrHandle.getFile === 'function') {
            file = await fileEntryOrHandle.getFile();
        } else if (fileEntryOrHandle instanceof File) {
            file = fileEntryOrHandle;
        } else {
            throw new Error("Unsupported file entry or handle type for reading.");
        }

        // Return content in the appropriate format
        if (isText) {
            return await file.text();
        } else {
            // For binary files, we might return ArrayBuffer or Blob depending on use case
            // For now, let's return a placeholder or a message, as direct display is often not useful
            // Or, if you have a hex viewer or specific binary handler, integrate here.
            // For the purpose of the previewer that uses CodeMirror, it shouldn't get here
            // if isLikelyTextFile is false.
            return file; // Return the File object itself for binary, previewer will handle it
        }

    } catch (err) {
        console.error(`Error in readFileContent for ${pathKey}:`, err);
        if (!err.path) err.path = pathKey;
        throw err;
    }
}

// Helper to get CodeMirror mode from file extension for preview
function getCodeMirrorModeForPreview(filePath) {
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
        case '.liquid': return "htmlmixed"; // Added .liquid support
        default: return "text/plain"; // Fallback for unknown types
    }
}


// Preview a file by showing its content in a modal with CodeMirror
export async function previewFile(fileEntryOrHandle, filePathForEditedCheck = null) {
    const pathKey = filePathForEditedCheck || fileEntryOrHandle?.path || fileEntryOrHandle?.fullPath || fileEntryOrHandle?.name;
    const displayName = fileEntryOrHandle?.name || (pathKey ? pathKey.substring(pathKey.lastIndexOf('/') + 1) : "File");

    elements.filePreviewTitle.textContent = `PREVIEW: ${displayName}`;
    elements.filePreview.style.display = 'block'; // Use flex for modals if that's the standard
    elements.filePreviewContent.innerHTML = ''; // Clear previous content

    if (!utils.isLikelyTextFile(pathKey)) {
        elements.filePreviewContent.innerHTML = `<div style="padding: 15px; text-align: center;">Cannot preview binary file or unsupported file type: ${displayName}</div>`;
        return;
    }

    try {
        const content = await readFileContent(fileEntryOrHandle, pathKey); // This now handles text files only based on the above check

        if (typeof CodeMirror !== 'undefined') {
            if (!appState.previewEditorInstance) {
                appState.previewEditorInstance = CodeMirror(elements.filePreviewContent, {
                    value: content,
                    mode: getCodeMirrorModeForPreview(pathKey),
                    lineNumbers: true,
                    theme: "material-darker",
                    readOnly: true,
                    lineWrapping: true,
                });
            } else {
                appState.previewEditorInstance.setValue(content);
                appState.previewEditorInstance.setOption("mode", getCodeMirrorModeForPreview(pathKey));
            }
            setTimeout(() => {
                if (appState.previewEditorInstance) appState.previewEditorInstance.refresh();
            }, 50);
        } else {
            elements.filePreviewContent.innerHTML = `<pre>${content.replace(/</g, "<").replace(/>/g, ">")}</pre>`;
        }

    } catch (err) {
        console.error(`Error previewing file ${displayName}:`, err);
        elements.filePreviewContent.textContent = `Error previewing file: ${err.message}`;
        errorHandler.showError({
            name: err.name || "PreviewError",
            message: `Failed to preview file: ${displayName}. ${err.message}`,
            stack: err.stack,
            cause: err
        });
    }
}

export async function writeFileContent(directoryHandle, fullPath, content) {
    try {
        const rootName = directoryHandle.name;
        if (!fullPath.startsWith(rootName + '/')) {
            if (fullPath === rootName) {
                 const fileHandle = await directoryHandle.getFileHandle(fullPath, { create: true });
                 const writable = await fileHandle.createWritable();
                 await writable.write(content);
                 await writable.close();
                 return;
            }
             throw new Error(`Path "${fullPath}" does not belong to the root directory "${rootName}".`);
        }

        const relativePath = fullPath.substring(rootName.length + 1);
        const pathParts = relativePath.split('/');
        const fileName = pathParts.pop();

        let currentHandle = directoryHandle;
        for (const part of pathParts) {
            currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }

        const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    } catch (err) {
        console.error(`Error writing to local file ${fullPath}:`, err);
        errorHandler.showError({ name: "FileWriteError", message: `Could not write to file: ${err.message}` });
        throw err; // Re-throw so the caller knows it failed
    }
}


export async function getFileHandleFromPath(directoryHandle, fullPath) {
    const rootName = directoryHandle.name;
    if (!fullPath.startsWith(rootName + '/')) {
        throw new Error(`Path "${fullPath}" does not belong to the root directory "${rootName}".`);
    }

    const relativePath = fullPath.substring(rootName.length + 1);
    const pathParts = relativePath.split('/');
    const fileName = pathParts.pop();

    let currentHandle = directoryHandle;
    for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: false });
    }

    const fileHandle = await currentHandle.getFileHandle(fileName, { create: false });
    return fileHandle;
}
// --- ENDFILE: diranalyze/js/fileSystem.js --- //