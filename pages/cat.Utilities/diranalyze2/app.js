(function(){
  /* ---------------------------- State & Helpers --------------------------- */
  const state = {
    files: new Map(),          // path -> text
    sizes: new Map(),          // path -> bytes
    fileTree: null,            // nested structure
    selectedFiles: new Set(),  // includes folder keys too
    committedFiles: new Set(),
    expandedFolders: new Set(),
    currentFile: null,
    hasUnsavedChanges: false,
    filters: { include:'', exclude:'node_modules,.git,dist,build,.DS_Store', showHidden:false },
    gitignorePatterns: [],
    placeholders: new Map(),
    lastLoaded: [],
    isDark: false,
    sidebarWidth: 320
  };

  /* ----------------------------- DOM refs -------------------------------- */
  const el = (id)=>document.getElementById(id);
  const folderInput = el('folderInput');
  const selectBtn = el('selectBtn');
  const sidebarEmpty = el('sidebarEmpty');
  const sidebarControls = el('sidebarControls');
  const treeEl = el('tree');
  const committedBadge = el('committedBadge');
  const copyTreeBtn = el('copyTreeBtn');
  const treeReportEl = el('treeReport');
  const emptyState = el('emptyState');
  const emptyTitle = el('emptyTitle');
  const emptyDesc = el('emptyDesc');
  const statsRow = el('statsRow');
  const totalFilesBadge = el('totalFilesBadge');
  const selectedFilesBadge = el('selectedFilesBadge');
  const mainTreePane = el('mainTreePane');
  const editorPane = el('editorPane');
  const editor = el('editor');
  const editorToolbar = el('editorToolbar');
  const linenumsInner = el('linenumsInner');
  const statusFiles = el('statusFiles');
  const statusSelected = el('statusSelected');
  const statusSize = el('statusSize');
  const statusMsg = el('statusMsg');
  const saveBtn = el('saveBtn');
  const currentFileLabel = el('currentFileLabel');
  const patchDialog = el('patchDialog');
  const patchInput = el('patchInput');
  const toast = el('toast');
  const themeIcon = el('themeIcon');

  /* ------------------------------ Buttons -------------------------------- */
  el('themeBtn').onclick = toggleTheme;
  el('clearBtn').onclick = clearProject;
  el('textReportBtn').onclick = () => copyToClipboard(generateReport(true), 'Text report copied');
  el('combinedBtn').onclick = exportCombinedText;
  el('selectAllBtn').onclick = ()=> selectAll(true);
  el('selectNoneBtn').onclick = ()=> selectAll(false);
  el('expandAllBtn').onclick = ()=> expandAll(true);
  el('collapseAllBtn').onclick = ()=> expandAll(false);
  el('includeFilter').onblur = applyFilters;
  el('excludeFilter').onblur = applyFilters;
  el('showHiddenChk').onchange = (e)=>{ state.filters.showHidden=e.target.checked; applyFilters(); };
  el('copyLinesBtn').onclick = copyWithLineNumbers;
  el('patchBtn').onclick = ()=> patchDialog.showModal();
  el('applyPatchesBtn').onclick = applyPatches;
  el('saveBtn').onclick = saveCurrentFile;
  el('closeBtn').onclick = exitEditor;

  selectBtn.onclick = ()=> folderInput.click();
  folderInput.addEventListener('change',(e)=>{
    const files = Array.from(e.target.files||[]);
    if(files.length) handleFilesLoaded(files);
  });

  // Drag & drop folder(s)
  const sidebar = document.getElementById('sidebar');
  sidebar.addEventListener('dragover', (e)=>{ e.preventDefault(); });
  sidebar.addEventListener('drop', async (e)=>{
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items||[]);
    const files = [];
    for(const item of items){
      if(item.kind==='file'){
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        if(entry) await traverse(entry, files);
      }
    }
    if(files.length) handleFilesLoaded(files);
  });

  // Sidebar resize
  const divider = document.getElementById('divider');
  divider.addEventListener('mousedown', (e)=>{
    const startX = e.clientX; const startW = sidebar.offsetWidth;
    const onMove = (ev)=>{ const w = Math.max(200, Math.min(700, startW + (ev.clientX-startX))); sidebar.style.width=w+'px'; state.sidebarWidth=w; };
    const onUp = ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  });

  // Theme init
  (function init(){
    const saved = localStorage.getItem('diranalyze-theme');
    if(saved==='dark'){ document.documentElement.classList.add('dark'); state.isDark=true; themeIcon.setAttribute('href','#i-sun'); }
    document.getElementById('excludeFilter').value = state.filters.exclude;
  })();

  /* ------------------------------- Core logic ----------------------------- */
  const DEFAULT_GITIGNORE = `
node_modules/
.git/
.gitignore
dist/
build/
*.log
.DS_Store
.env
.env.local
.cache
.parcel-cache
.next
.nuxt
.vscode/
.idea/
*.swp
*.swo
*~
.npm
.yarn/
coverage/
.nyc_output
`;

  function parseGitignore(content){
    return content.split('\n').map(s=>s.trim()).filter(s=>s && !s.startsWith('#'));
  }
  function globToRegExp(glob){
    let g = glob.replace(/\\/g,'/');
    g = g.replace(/([.+^$(){}|\\])/g,'\\$1');
    g = g.replace(/\*\*/g,'§§DS§§');
    g = g.replace(/\*/g,'[^/]*');
    g = g.replace(/§§DS§§/g,'.*');
    g = g.replace(/\?/g,'[^/]');
    return new RegExp('(^|/)'+g+'($|/)?');
  }
  function matchesGitignore(path, patterns){
    const p = path.replace(/\\/g,'/');
    for(const raw of patterns){
      if(!raw) continue;
      const pattern = raw.trim();
      if(!pattern || pattern.startsWith('#') || pattern.startsWith('!')) continue;
      if(pattern.endsWith('/')){ const dir = pattern.slice(0,-1); if(p.split('/').includes(dir)) return true; continue; }
      if(globToRegExp(pattern).test(p)) return true;
    }
    return false;
  }
  function shouldIncludeFile(path, filters){
    const exclude = filters.exclude.split(',').map(p=>p.trim()).filter(Boolean);
    for(const pat of exclude){ if(pat && path.includes(pat)) return false; }
    if(!filters.showHidden && path.split('/').some(part=>part.startsWith('.'))) return false;
    const include = filters.include.split(',').map(p=>p.trim()).filter(Boolean);
    if(include.length){
      const m = include.some(p=>{
        const safe = p.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
        return new RegExp('^'+safe+'$').test(path);
      });
      if(!m) return false;
    }
    return true;
  }

  async function handleFilesLoaded(fileList){
    setStatus(`Loading ${fileList.length} files...`);
    const newFiles = new Map();
    const newSizes = new Map();
    const newSelected = new Set();
    const newCommitted = new Set();
    const placeholders = new Map();

    // Collect .gitignore (if any)
    let gitignoreContent = '';
    for(const f of fileList){
      const p = f.webkitRelativePath || f.name;
      if(p.endsWith('.gitignore') || p==='.gitignore'){ gitignoreContent = await readFile(f); break; }
    }
    const patterns = parseGitignore(DEFAULT_GITIGNORE + (gitignoreContent ? ('\n'+gitignoreContent) : ''));

    const KNOWN_BUILD_DIRS = new Set(['node_modules','.next','.nuxt','dist','build','.parcel-cache','.cache','coverage','.git','.vscode','.idea','out','.svelte-kit','.angular','.vercel','.turbo','target','bin','obj']);

    for(const f of fileList){
      const path = f.webkitRelativePath || f.name;
      if(matchesGitignore(path, patterns)){
        const parts = path.split('/'); const stack=[];
        for(let i=0;i<parts.length-1;i++){
          const seg=parts[i]; stack.push(seg);
          if(KNOWN_BUILD_DIRS.has(seg)){
            const dir=stack.join('/'); const rec = placeholders.get(dir) || {count:0,size:0,name:seg};
            rec.count++; rec.size += (typeof f.size==='number'? f.size:0); placeholders.set(dir, rec); break;
          }
        }
        continue;
      }
      if(!shouldIncludeFile(path, state.filters)) continue;
      const content = await readFile(f);
      newFiles.set(path, content);
      newSizes.set(path, (typeof f.size === 'number' ? f.size : (content ? new Blob([content]).size : 0)));
      newSelected.add(path);
      newCommitted.add(path);
    }

    state.files = newFiles; state.sizes = newSizes;
    state.selectedFiles = newSelected; state.committedFiles = newCommitted;
    state.placeholders = placeholders; state.lastLoaded = Array.from(fileList);
    state.gitignorePatterns = patterns; state.currentFile=null; state.hasUnsavedChanges=false;

    buildFileTree(newFiles);
    showToast(`Loaded ${newFiles.size} files`);
    refreshUI();
  }

  function readFile(file){
    return new Promise((resolve)=>{ const r = new FileReader(); r.onload = e=> resolve(e.target.result||''); r.onerror = ()=> resolve(''); r.readAsText(file); });
  }

  function buildFileTree(files){
    const tree = {};
    for(const [path] of files){
      const parts = path.split('/');
      let cur = tree;
      for(let i=0;i<parts.length;i++){
        const part = parts[i];
        if(i===parts.length-1){ cur[part] = {type:'file', path}; }
        else { cur[part] = cur[part] || {type:'folder', children:{}}; cur = cur[part].children; }
      }
    }
    state.fileTree = tree;

    // mark all folders committed by default (so counts/filters behave)
    const addFolders = (node, prefix='')=>{
      for(const [name, item] of Object.entries(node)){
        const p = prefix? `${prefix}/${name}`: name;
        if(item.type==='folder'){
          if(!matchesGitignore(p, state.gitignorePatterns)){
            state.selectedFiles.add(p); state.committedFiles.add(p);
          }
          addFolders(item.children, p);
        }
      }
    };
    addFolders(tree);
  }

  function isFolderPath(path){
    // fast check if path exists as folder in the tree
    const parts = path.split('/');
    let node = state.fileTree;
    for(let i=0;i<parts.length;i++){
      const seg=parts[i];
      if(!node[seg]) return false;
      const n=node[seg];
      if(i===parts.length-1) return n.type==='folder';
      node = n.children;
    }
    return false;
  }

  function getFolderNode(path){
    const parts = path.split('/');
    let node = state.fileTree;
    for(let i=0;i<parts.length;i++){
      const seg=parts[i];
      if(!node[seg]) return null;
      if(i===parts.length-1) return node[seg];
      node = node[seg].children;
    }
    return null;
  }

  function pathsUnderFolder(path){
    const node = getFolderNode(path);
    const out = [path];
    (function walk(n, prefix){
      for(const [name, item] of Object.entries(n.children||{})){
        const p = `${prefix}/${name}`;
        if(item.type==='file') out.push(item.path);
        else { out.push(p); walk(item, p); }
      }
    })(node, path);
    return out;
  }

  function folderSelectionState(path){
    // 0 none, 1 partial, 2 full
    const all = pathsUnderFolder(path).filter(p=>!p.endsWith('/'));
    const sel = all.filter(p=> state.selectedFiles.has(p));
    if(sel.length===0) return 0;
    if(sel.length===all.length) return 2;
    return 1;
  }

  function toggleSelection(path){
    if(isFolderPath(path)){
      const all = pathsUnderFolder(path);
      const currentlySelected = folderSelectionState(path) === 2;
      if(currentlySelected){
        all.forEach(p=>{ state.selectedFiles.delete(p); state.committedFiles.delete(p); });
      } else {
        all.forEach(p=>{ if(!matchesGitignore(p, state.gitignorePatterns)){ state.selectedFiles.add(p); state.committedFiles.add(p);} });
      }
    } else {
      if(state.selectedFiles.has(path)){ state.selectedFiles.delete(path); state.committedFiles.delete(path);}
      else { state.selectedFiles.add(path); state.committedFiles.add(path);}
    }
    refreshUI();
  }

  function selectAll(sel){
    state.selectedFiles.clear(); state.committedFiles.clear();
    if(sel){
      for(const [path] of state.files){ if(!matchesGitignore(path, state.gitignorePatterns)){ state.selectedFiles.add(path); state.committedFiles.add(path);} }
      // include all folders
      const addFolders=(node, p='')=>{
        for(const [name, it] of Object.entries(node)){
          const fp = p?`${p}/${name}`:name;
          if(it.type==='folder'){
            if(!matchesGitignore(fp, state.gitignorePatterns)){ state.selectedFiles.add(fp); state.committedFiles.add(fp); }
            addFolders(it.children, fp);
          }
        }
      };
      addFolders(state.fileTree);
    }
    refreshUI();
  }

  function expandAll(on){
    state.expandedFolders = new Set();
    if(on){
      const walk=(node,p='')=>{
        for(const [name, it] of Object.entries(node)){
          const fp=p?`${p}/${name}`:name;
          if(it.type==='folder'){ state.expandedFolders.add(fp); walk(it.children, fp); }
        }
      };
      walk(state.fileTree);
    }
    renderTree();
  }

  function openFile(path){
    if(state.hasUnsavedChanges && state.currentFile){ if(!confirm('You have unsaved changes. Continue?')) return; }
    state.currentFile = path; state.hasUnsavedChanges=false;
    editor.value = state.files.get(path)||'';
    currentFileLabel.textContent = path;
    editorToolbar.style.display='flex';
    mainTreePane.style.display='block';
    editorPane.style.display='block';
    renderLineNumbers(); updateSaveButton();
  }

  function handleEditorChange(){
    if(!state.currentFile) return;
    const content = editor.value;
    state.files.set(state.currentFile, content);
    state.sizes.set(state.currentFile, new Blob([content]).size);
    state.hasUnsavedChanges=true;
    updateSaveButton(); renderLineNumbers();
  }
  editor.addEventListener('input', handleEditorChange);
  editor.addEventListener('scroll', ()=>{ linenumsInner.style.transform = `translateY(${-editor.scrollTop}px)`; });

  function saveCurrentFile(){ if(!state.currentFile) return; state.hasUnsavedChanges=false; updateSaveButton(); showToast('File saved'); }
  function updateSaveButton(){ saveBtn.disabled = !state.hasUnsavedChanges; currentFileLabel.textContent = state.currentFile + (state.hasUnsavedChanges?' (modified)':''); }
  function exitEditor(){ if(state.hasUnsavedChanges && !confirm('You have unsaved changes. Continue?')) return; editorToolbar.style.display='none'; editorPane.style.display='none'; }

  function copyWithLineNumbers(){
    if(!state.currentFile) return;
    const text = state.files.get(state.currentFile)||'';
    const numbered = text.split('\n').map((l,i)=> `${i+1}: ${l}`).join('\n');
    const out = `FILE: ${state.currentFile}\n${'='.repeat(40)}\n${numbered}`;
    copyToClipboard(out, 'Copied with line numbers!');
  }

  function applyFilters(){
    const include = document.getElementById('includeFilter').value;
    const exclude = document.getElementById('excludeFilter').value;
    state.filters.include=include; state.filters.exclude=exclude;
    if(state.lastLoaded.length) handleFilesLoaded(state.lastLoaded);
  }

  function exportCombinedText(){
    const selected = state.committedFiles.size? Array.from(state.committedFiles) : Array.from(state.files.keys());
    if(!selected.length){ showToast('No files committed for export'); return; }
    const out = [];
    out.push(generateReport(true)); out.push('');
    out.push('//--- FILE CONTENTS WITH LINE NUMBERS ---'); out.push('');
    for(const path of selected.sort()){
      if(path.endsWith('/')) continue;
      const content = state.files.get(path)||'';
      out.push(`=== FILE: ${path} ===`);
      const lines = content.split('\n');
      lines.forEach((line,i)=> out.push(`${i+1}: ${line}`));
      out.push('');
    }
    const blob = new Blob([out.join('\n')], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download = `diranalyze-combined-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Combined export downloaded (${selected.length} items)`);
  }

  /* -------- Report wrappers -------- */
  function sizeFromState(path){ return state.sizes.get(path) || 0; }
  function getExt(name){ const i = name.lastIndexOf('.'); return i>0 ? name.slice(i) : '(no ext)'; }
  function formatSize(bytes){ if(bytes<1024) return bytes+' B'; if(bytes<1024*1024) return (bytes/1024).toFixed(1)+' KB'; return (bytes/(1024*1024)).toFixed(2)+' MB'; }

  function generateReport(committedOnly){
    const included = committedOnly && state.committedFiles.size
      ? Array.from(state.committedFiles)
      : Array.from(state.files.keys());
    const fileOnly = included.filter(p=>!p.endsWith('/'));
    const scope = committedOnly && state.committedFiles.size ? 'Committed (current view)' : 'Full scanned directory';
    return generateV3Report({
      allPaths: fileOnly,
      getSize: sizeFromState,
      getExt: getExt,
      scopeLabel: scope
    });
  }

  /* ------------------------------- Rendering ------------------------------ */
  function renderTree(){
    treeEl.innerHTML='';
    if(!state.fileTree) return;
    const entries = Object.entries(state.fileTree)
      .sort(([a,aVal],[b,bVal])=>{ if(aVal.type!==bVal.type) return aVal.type==='folder'?-1:1; return a.localeCompare(b); });
    for(const [name, node] of entries){
      treeEl.appendChild(renderNode(name, node, name, 0));
    }
  }

  function renderNode(name, node, path, depth){
    const row = document.createElement('div'); row.className='tree-item'; row.style.paddingLeft = (depth*16+8)+'px';

    const caret = document.createElement('button');
    caret.className = 'icon-btn has-tip'; caret.setAttribute('data-tip','Expand/Collapse');
    caret.innerHTML = `<svg class="ico" style="transform:${state.expandedFolders.has(path)?'rotate(90deg)':'none'}"><use href="#i-caret"/></svg>`;
    caret.onclick = (e)=>{ e.stopPropagation(); if(state.expandedFolders.has(path)) state.expandedFolders.delete(path); else state.expandedFolders.add(path); renderTree(); };

    const cb = document.createElement('input'); cb.type='checkbox'; cb.className='checkbox has-tip'; cb.setAttribute('data-tip','Select');
    const icon=document.createElement('svg'); icon.className='ico';
    const label = document.createElement('span'); label.className='tree-name'; label.textContent = name;
    const sizeSpan = document.createElement('span'); sizeSpan.className='muted small'; sizeSpan.style.marginLeft='auto';

    if(node.type==='folder'){
      // checkbox reflects aggregated selection
      const stateVal = folderSelectionState(path);
      cb.checked = stateVal===2;
      cb.indeterminate = stateVal===1;
      cb.onclick = (e)=>{ e.stopPropagation(); toggleSelection(path); };

      icon.innerHTML = `<use href="${state.expandedFolders.has(path)?'#i-folder-open':'#i-folder'}"/>`;
      label.onclick = ()=> caret.click(); // label toggles expand
      row.append(caret, cb, icon, label);
      if(state.expandedFolders.has(path)){
        const children = document.createElement('div');
        const sorted = Object.entries(node.children).sort(([a,aVal],[b,bVal])=>{ if(aVal.type!==bVal.type) return aVal.type==='folder'?-1:1; return a.localeCompare(b); });
        for(const [childName, child] of sorted){ children.appendChild(renderNode(childName, child, `${path}/${childName}`, depth+1)); }
        const wrap = document.createElement('div'); wrap.append(row, children); return wrap;
      }
    } else {
      cb.checked = state.selectedFiles.has(node.path);
      cb.onclick = (e)=>{ e.stopPropagation(); toggleSelection(node.path); };
      icon.innerHTML = `<use href="${fileIconId(name)}"/>`;
      sizeSpan.textContent = formatSize(sizeFromState(node.path));
      label.onclick = ()=> openFile(node.path);
      row.append(caret, cb, icon, label, sizeSpan);
      caret.style.visibility='hidden'; // no caret for files
    }
    return row;
  }

  function fileIconId(filename){
    const ext = (filename.split('.').pop()||'').toLowerCase();
    if(ext==='md') return '#i-md';
    if(ext==='json') return '#i-json';
    if(['png','jpg','jpeg','gif','svg','webp','ico'].includes(ext)) return '#i-image';
    if(ext==='html' || ext==='htm') return '#i-html';
    if(ext==='css') return '#i-css';
    if(ext==='js' || ext==='mjs' || ext==='cjs') return '#i-js';
    if(ext==='ts' || ext==='tsx' || ext==='jsx') return '#i-file-code';
    return '#i-file';
  }

  function renderLineNumbers(){
    const lines = (editor.value||'').split('\n');
    linenumsInner.innerHTML = lines.map((_,i)=> `<div>${i+1}</div>`).join('');
    linenumsInner.style.transform = `translateY(${-editor.scrollTop}px)`;
  }

  function refreshUI(){
    const hasFiles = state.files.size>0;
    sidebarEmpty.style.display = hasFiles? 'none':'block';
    sidebarControls.style.display = hasFiles? 'block':'none';
    committedBadge.textContent = `${state.committedFiles.size} committed files`;
    copyTreeBtn.disabled = state.committedFiles.size===0;

    if(state.committedFiles.size>0){
      treeReportEl.style.display='block'; emptyState.style.display='none';
      treeReportEl.textContent = generateReport(true);
    } else {
      treeReportEl.style.display='none'; emptyState.style.display='flex';
      emptyTitle.textContent = hasFiles? 'No files committed':'No files loaded';
      emptyDesc.textContent = hasFiles? "Select files or folders in the sidebar to see the report." : "Drop a folder to get started.";
      if(hasFiles){ statsRow.style.display='flex'; totalFilesBadge.textContent=`${state.files.size} total files`; selectedFilesBadge.textContent=`${state.selectedFiles.size} selected`; }
      else { statsRow.style.display='none'; }
    }

    // Status bar
    statusFiles.textContent = `${state.files.size} files`;
    statusSelected.textContent = `${state.selectedFiles.size} selected`;
    const totalBytes = Array.from(state.committedFiles.size? state.committedFiles: state.files.keys())
      .reduce((acc,p)=> acc + (p.endsWith('/')?0:sizeFromState(p)), 0);
    statusSize.textContent = formatSize(totalBytes);

    renderTree();

    // Copy report (current view)
    copyTreeBtn.onclick = ()=> copyToClipboard(generateReport(state.committedFiles.size>0), 'Report copied');

    // Theme icon
    themeIcon.setAttribute('href', state.isDark ? '#i-sun' : '#i-moon');
  }

  function setStatus(msg){ statusMsg.textContent = msg; }
  function showToast(msg){ toast.textContent = msg; toast.style.display='block'; setTimeout(()=> toast.style.display='none', 1800); setStatus(msg); }

  function clearProject(){
    if(!confirm('Clear the entire project?')) return;
    state.files=new Map(); state.sizes=new Map(); state.fileTree=null;
    state.selectedFiles=new Set(); state.committedFiles=new Set();
    state.expandedFolders=new Set(); state.currentFile=null;
    state.hasUnsavedChanges=false;
    state.filters={include:'', exclude:'node_modules,.git,dist,build,.DS_Store', showHidden:false};
    state.gitignorePatterns=[]; state.placeholders=new Map(); state.lastLoaded=[];
    refreshUI(); showToast('Project cleared');
  }

  async function traverse(entry, files, path=''){
    return new Promise((resolve)=>{
      if(entry.isFile){
        entry.file((file)=>{
          Object.defineProperty(file,'webkitRelativePath',{ value: path + entry.name, configurable:true});
          files.push(file); resolve();
        });
      } else if(entry.isDirectory){
        const reader = entry.createReader();
        reader.readEntries(async (ents)=>{
          for(const e of ents){ await traverse(e, files, path+entry.name+'/'); }
          resolve();
        });
      } else resolve();
    });
  }

  function toggleTheme(){
    state.isDark = !state.isDark;
    document.documentElement.classList.toggle('dark', state.isDark);
    localStorage.setItem('diranalyze-theme', state.isDark? 'dark':'light');
    refreshUI();
  }

  function copyToClipboard(text, msg){ navigator.clipboard.writeText(text); showToast(msg); }
})();
