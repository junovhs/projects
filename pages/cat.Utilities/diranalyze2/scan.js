// scan.js: Phase 2 Core I/O – Recursive read-only scan, in-memory state. Omits binaries.
export let appState = {
    dirHandle: null,
    fullScanData: { allFilesList: [] },
    filesMap: new Map(),
    isScaffoldMode: false,
    projectRootName: '',
    searchTerm: ''
};

export async function scanDirectory(opts = { mode: 'read' }) {
    if (!window.showDirectoryPicker) {
        throw new Error('Browser does not support Directory Access API. Use Chrome/Edge.');
    }
    appState.dirHandle = await window.showDirectoryPicker({ mode: opts.mode });
    appState.projectRootName = appState.dirHandle.name;
    appState.filesMap.clear();
    appState.fullScanData.allFilesList = [];
    const files = await processDirectoryRecursive(appState.dirHandle, '');
    // Omit binaries from list/report
    appState.fullScanData.allFilesList = files.filter(f => !f.isBinary);
    return { rootName: appState.projectRootName, list: appState.fullScanData.allFilesList };
}

async function processDirectoryRecursive(dirHandle, path = '') {
    const files = [];
    for await (const [name, entry] of dirHandle.entries()) {
        const fullPath = path ? `${path}/${name}` : name;
        if (entry.kind === 'file') {
            const file = await entry.getFile();
            const isBinary = file.type && !file.type.startsWith('text/') && file.type !== '';
            files.push({ path: fullPath, size: file.size, type: name.split('.').pop() || '(no ext)', isBinary });
            appState.filesMap.set(fullPath, file);
        } else if (entry.kind === 'directory') {
            const subFiles = await processDirectoryRecursive(entry, fullPath);
            files.push(...subFiles);
        }
    }
    return files;
}

// Phase 3 Stubs (for tree.js import)
export function buildTreeStructure(files) {
    const root = { name: appState.projectRootName || 'Root', children: [], isFolder: true, path: '' };
    files.forEach(f => {
        const parts = f.path.split('/');
        let current = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            let child = current.children.find(c => c.name === part && c.isFolder === (i < parts.length - 1));
            if (!child) {
                child = { name: part, path: parts.slice(0, i + 1).join('/'), children: [], isFolder: i < parts.length - 1, size: i === parts.length - 1 ? f.size : 0 };
                current.children.push(child);
            }
            current = child;
        }
    });
    root.children.sort((a, b) => (a.isFolder === b.isFolder ? 0 : a.isFolder ? -1 : 1)); // Folders first
    return root.children;
}

export function renderTreeNode(nodes, parentEl) {
    nodes.forEach(node => {
        const li = document.createElement('li');
        li.className = `tree-node ${node.isFolder ? 'folder' : 'file'}`;
        li.dataset.path = node.path;
        const icon = document.createElement('i');
        icon.className = node.isFolder ? 'fas fa-folder' : node.type === 'rs' || node.type === 'js' ? 'fas fa-file-code' : 'fas fa-file';
        li.appendChild(icon);
        const toggle = document.createElement('span');
        toggle.className = 'toggle';
        li.appendChild(toggle);
        const nameSpan = document.createElement('span');
        nameSpan.textContent = node.name + (node.isFolder ? ` (${node.children.length} items)` : ` (${(node.size / 1024).toFixed(1)} KB)`);
        li.appendChild(nameSpan);
        const ul = document.createElement('ul');
        renderTreeNode(node.children, ul);
        li.appendChild(ul);
        if (node.isFolder) {
            toggle.addEventListener('click', e => {
                e.stopPropagation();
                li.classList.toggle('open');
            });
        } else {
            li.addEventListener('click', () => loadFileContent(node.path));
        }
        parentEl.appendChild(li);
    });
}

export function buildTree(files) {
    const treeEl = document.getElementById('directoryTree');
    treeEl.innerHTML = '';
    if (files.length === 0) {
        document.getElementById('emptyTreeNotice').style.display = 'flex';
        return;
    }
    document.getElementById('emptyTreeNotice').style.display = 'none';
    const treeData = buildTreeStructure(files.filter(f => f.path.toLowerCase().includes(appState.searchTerm)));
    renderTreeNode(treeData, treeEl);
}

// Temp stubs for Phase 3
export async function loadFileContent(path) { /* Impl in Phase 3 */ }
export function generateReport() { /* Impl in Phase 3 */ }
export function updateStats() { /* Impl in Phase 3 */ }
export function exportReport() { /* Impl in Phase 3 */ }