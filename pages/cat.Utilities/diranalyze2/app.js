(function(){
  /* ---------------------------- State & Helpers --------------------------- */
  const state = {
    files: new Map(),              // path -> content (string)
    sizes: new Map(),              // path -> bytes
    fileTree: null,                // nested structure
    selectedFiles: new Set(),
    committedFiles: new Set(),
    expandedFolders: new Set(),
    currentFile: null,
    hasUnsavedChanges: false,
    view: 'tree',                  // 'tree' | 'editor'
    filters: { include:'', exclude:'node_modules,.git,dist,build,.DS_Store', showHidden:false },
    gitignorePatterns: [],
    placeholders: new Map(),
    lastLoaded: [],
    isDark: false,
    sidebarWidth: 320
  };

  // DOM refs
  const folderInput = document.getElementById('folderInput');
  const selectBtn = document.getElementById('selectBtn');
  const sidebarEmpty = document.getElementById('sidebarEmpty');
  const sidebarControls = document.getElementById('sidebarControls');
  const treeEl = document.getElementById('tree');
  const committedBadge = document.getElementById('committedBadge');
  const copyTreeBtn = document.getElementById('copyTreeBtn');
  const treeReportEl = document.getElementById('treeReport');
  const emptyState = document.getElementById('emptyState');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyDesc = document.getElementById('emptyDesc');
  const statsRow = document.getElementById('statsRow');
  const totalFilesBadge = document.getElementById('totalFilesBadge');
  const selectedFilesBadge = document.getElementById('selectedFilesBadge');
  const mainTreePane = document.getElementById('mainTreePane');
  const editorPane = document.getElementById('editorPane');
  const editor = document.getElementById('editor');
  const editorToolbar = document.getElementById('editorToolbar');
  const linenumsInner = document.getElementById('linenumsInner');
  const statusFiles = document.getElementById('statusFiles');
  const statusSelected = document.getElementById('statusSelected');
  const statusSize = document.getElementById('statusSize');
  const statusMsg = document.getElementById('statusMsg');
  const saveBtn = document.getElementById('saveBtn');
  const currentFileLabel = document.getElementById('currentFileLabel');
  const patchDialog = document.getElementById('patchDialog');
  const patchInput = document.getElementById('patchInput');
  const toast = document.getElementById('toast');

  // Buttons
  document.getElementById('themeBtn').onclick = toggleTheme;
  document.getElementById('clearBtn').onclick = clearProject;
  document.getElementById('textReportBtn').onclick = () => copyToClipboard(generateReport(true), 'Text report copied');
  document.getElementById('combinedBtn').onclick = exportCombinedText;
  document.getElementById('selectAllBtn').onclick = ()=> selectAll(true);
  document.getElementById('selectNoneBtn').onclick = ()=> selectAll(false);
  document.getElementById('expandAllBtn').onclick = ()=> expandAll(true);
  document.getElementById('collapseAllBtn').onclick = ()=> expandAll(false);
  document.getElementById('includeFilter').onblur = applyFilters;
  document.getElementById('excludeFilter').onblur = applyFilters;
  document.getElementById('showHiddenChk').onchange = (e)=>{ state.filters.showHidden=e.target.checked; applyFilters(); };
  document.getElementById('copyLinesBtn').onclick = copyWithLineNumbers;
  document.getElementById('patchBtn').onclick = ()=> patchDialog.showModal();
  document.getElementById('applyPatchesBtn').onclick = applyPatches;
  document.getElementById('saveBtn').onclick = saveCurrentFile;
  document.getElementById('closeBtn').onclick = exitEditor;

  // Sidebar file select
  selectBtn.onclick = ()=> folderInput.click();
  folderInput.addEventListener('change',(e)=>{
    const files = Array.from(e.target.files||[]);
    if(files.length) handleFilesLoaded(files);
  });

  // Drag & drop support on entire sidebar
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
    if(saved==='dark'){ document.documentElement.classList.add('dark'); state.isDark=true; }
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

    // discover .gitignore
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
        // placeholder stats for ignored heavy dirs
        const parts = path.split('/'); const stack=[];
        for(let i=0;i<parts.length-1;i++){
          const seg=parts[i]; stack.push(seg);
          if(KNOWN_BUILD_DIRS.has(seg)){
            const dir=stack.join('/');
            const rec = placeholders.get(dir) || {count:0,size:0,name:seg};
            rec.count++; rec.size += (typeof f.size==='number'? f.size:0);
            placeholders.set(dir, rec);
            break;
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

    state.files = newFiles;
    state.sizes = newSizes;
    state.selectedFiles = newSelected;
    state.committedFiles = newCommitted;
    state.placeholders = placeholders;
    state.lastLoaded = Array.from(fileList);
    state.gitignorePatterns = patterns;
    state.currentFile=null;
    state.hasUnsavedChanges=false;

    buildFileTree(newFiles);
    showToast(`Loaded ${newFiles.size} files`);
    refreshUI();
  }

  function readFile(file){
    return new Promise((resolve)=>{
      const r = new FileReader();
      r.onload = e=> resolve(e.target.result||'');
      r.onerror = ()=> resolve('');
      r.readAsText(file);
    });
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
    // preselect folders as committed
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

  function checkIfFolder(targetPath){
    const find = (node, path)=>{
      for(const [name, item] of Object.entries(node)){
        if(path===name && item.type==='folder') return true;
        if(item.children && find(item.children, path)) return true;
      }
      return false;
    };
    return find(state.fileTree, targetPath);
  }

  function getAllPathsUnder(folderPath){
    const paths=[folderPath];
    const findNode = (node, target)=>{
      if(node[target]) return node[target];
      for(const [k,v] of Object.entries(node)){
        if(v && typeof v==='object'){
          const res = findNode(v.children||v, target); if(res) return res;
        }
      }
      return null;
    };
    const folderNode = findNode(state.fileTree, folderPath);
    const add = (currentPath, item)=>{
      if(!item) return;
      if(item.type==='file'){ paths.push(item.path); return; }
      for(const [name, child] of Object.entries(item.children||{})) add(`${currentPath}/${name}`, child);
    };
    add(folderPath, folderNode);
    return paths;
  }

  function toggleSelection(path){
    const isFolder = checkIfFolder(path);
    if(isFolder){
      const shouldSelect = !state.selectedFiles.has(path);
      const all = getAllPathsUnder(path);
      if(shouldSelect){
        all.forEach(p=>{ if(!matchesGitignore(p, state.gitignorePatterns)){ state.selectedFiles.add(p); state.committedFiles.add(p);} });
      } else {
        all.forEach(p=>{ state.selectedFiles.delete(p); state.committedFiles.delete(p); });
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
      for(const [path] of state.files){
        if(!matchesGitignore(path, state.gitignorePatterns)){
          state.selectedFiles.add(path); state.committedFiles.add(path);
        }
      }
      const addFolders=(node, p='')=>{
        for(const [name, it] of Object.entries(node)){
          const fp = p?`${p}/${name}`:name;
          if(it.type==='folder'){
            if(!matchesGitignore(fp, state.gitignorePatterns)){
              state.selectedFiles.add(fp); state.committedFiles.add(fp);
            }
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
    if(state.hasUnsavedChanges && state.currentFile){
      if(!confirm('You have unsaved changes. Continue?')) return;
    }
    state.currentFile = path;
    state.view='editor';
    state.hasUnsavedChanges=false;
    editor.value = state.files.get(path)||'';
    currentFileLabel.textContent = path;
    editorToolbar.style.display='flex';
    mainTreePane.style.display='none';
    editorPane.style.display='block';
    renderLineNumbers(); updateSaveButton();
  }

  function handleEditorChange(){
    if(!state.currentFile) return;
    const content = editor.value;
    state.files.set(state.currentFile, content);
    state.sizes.set(state.currentFile, new Blob([content]).size); // keep sizes in sync on edit
    state.hasUnsavedChanges=true;
    updateSaveButton();
    renderLineNumbers();
  }
  editor.addEventListener('input', handleEditorChange);
  editor.addEventListener('scroll', ()=>{
    // lock the line-number strip to the textarea scroll
    linenumsInner.style.transform = `translateY(${-editor.scrollTop}px)`;
  });

  function saveCurrentFile(){ if(!state.currentFile) return; state.hasUnsavedChanges=false; updateSaveButton(); showToast('File saved'); }
  function updateSaveButton(){ saveBtn.disabled = !state.hasUnsavedChanges; currentFileLabel.textContent = state.currentFile + (state.hasUnsavedChanges?' (modified)':''); }
  function exitEditor(){ if(state.hasUnsavedChanges && !confirm('You have unsaved changes. Continue?')) return; state.view='tree'; editorToolbar.style.display='none'; mainTreePane.style.display='block'; editorPane.style.display='none'; }

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
    out.push(generateReport(true));
    out.push('');
    out.push('//--- FILE CONTENTS WITH LINE NUMBERS ---');
    out.push('');
    for(const path of selected.sort()){
      const content = state.files.get(path)||'';
      out.push(`=== FILE: ${path} ===`);
      const lines = content.split('\n');
      lines.forEach((line,i)=> out.push(`${i+1}: ${line}`));
      out.push('');
    }
    const blob = new Blob([out.join('\n')], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download = `diranalyze-combined-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Combined export downloaded (${selected.length} files)`);
  }

  /* -------- Report wrappers (v3.2.1) -------- */
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
    const cb = document.createElement('input'); cb.type='checkbox'; cb.className='checkbox';
    const label = document.createElement('span'); label.className='tree-name'; label.textContent = name;
    const sizeSpan = document.createElement('span'); sizeSpan.className='muted'; sizeSpan.style.fontSize='12px'; sizeSpan.style.marginLeft='auto';

    if(node.type==='folder'){
      cb.style.visibility='hidden';
      const icon=document.createElement('span'); icon.textContent = state.expandedFolders.has(path)? '📂':'📁'; icon.style.width='18px';
      row.append(icon, label);
      row.onclick = ()=>{ if(state.expandedFolders.has(path)) state.expandedFolders.delete(path); else state.expandedFolders.add(path); renderTree(); };
      if(state.expandedFolders.has(path)){
        const children = document.createElement('div');
        const sorted = Object.entries(node.children).sort(([a,aVal],[b,bVal])=>{ if(aVal.type!==bVal.type) return aVal.type==='folder'?-1:1; return a.localeCompare(b); });
        for(const [childName, child] of sorted){ children.appendChild(renderNode(childName, child, `${path}/${childName}`, depth+1)); }
        const wrap = document.createElement('div'); wrap.append(row, children); return wrap;
      }
    } else {
      cb.checked = state.selectedFiles.has(node.path);
      cb.onclick = (e)=>{ e.stopPropagation(); toggleSelection(node.path); };
      row.onclick = ()=> openFile(node.path);
      const icon=document.createElement('span'); icon.textContent = fileEmoji(name); icon.style.width='18px';
      sizeSpan.textContent = formatSize(sizeFromState(node.path));
      row.append(cb, icon, label, sizeSpan);
    }
    return row;
  }

  function fileEmoji(filename){
    const ext = (filename.split('.').pop()||'').toLowerCase();
    const map = { js:'📜', jsx:'⚛️', ts:'📘', tsx:'⚛️', json:'📋', html:'🌐', css:'🎨', md:'📝', txt:'📄', png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', svg:'🎨' };
    if(filename==='.gitignore') return '🚫'; if(filename==='package.json') return '📦'; if(filename==='README.md') return '📖';
    return map[ext] || '📄';
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
      emptyDesc.textContent = hasFiles? "Select files in the sidebar and click 'Commit' to see the directory structure" : "Drop a folder to get started with directory analysis";
      if(hasFiles){ statsRow.style.display='flex'; totalFilesBadge.textContent=`${state.files.size} total files`; selectedFilesBadge.textContent=`${state.selectedFiles.size} selected`; }
      else { statsRow.style.display='none'; }
    }

    // Status bar
    statusFiles.textContent = `${state.files.size} files`;
    statusSelected.textContent = `${state.selectedFiles.size} selected`;
    const totalBytes = Array.from(state.committedFiles.size? state.committedFiles: state.files.keys())
      .reduce((acc,p)=> acc + sizeFromState(p), 0);
    statusSize.textContent = formatSize(totalBytes);

    renderTree();

    // Wire Copy Report after render so it uses current view
    copyTreeBtn.onclick = ()=> copyToClipboard(generateReport(state.committedFiles.size>0), 'Report copied');
  }

  function setStatus(msg){ statusMsg.textContent = msg; }
  function showToast(msg){ toast.textContent = msg; toast.style.display='block'; setTimeout(()=> toast.style.display='none', 2000); setStatus(msg); }

  function clearProject(){
    if(!confirm('Are you sure you want to clear the entire project? This cannot be undone.')) return;
    state.files=new Map(); state.sizes=new Map(); state.fileTree=null;
    state.selectedFiles=new Set(); state.committedFiles=new Set();
    state.expandedFolders=new Set(); state.currentFile=null;
    state.hasUnsavedChanges=false; state.view='tree';
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
  }

  function copyToClipboard(text, msg){ navigator.clipboard.writeText(text); showToast(msg); }

  function applyPatches(){
    const text = (patchInput.value||'').trim();
    if(!text){ showToast('No patches to apply'); return; }
    try{
      const patches = parsePatchText(text);
      let applied=0, failed=0;
      for(const p of patches){ if(applyPatch(p)) applied++; else failed++; }
      showToast(applied? (`Applied ${applied} patch(es)` + (failed?` (${failed} failed)`:'')) : 'No patches could be applied');
      patchDialog.close(); patchInput.value='';
      if(state.currentFile) { editor.value = state.files.get(state.currentFile)||''; renderLineNumbers(); }
    } catch(err){ showToast('Error: '+err.message); }
  }

  function parsePatchText(text){
    const patches=[]; const lines=text.split('\n'); let i=0;
    while(i<lines.length){
      if(lines[i].startsWith('FILE:')){
        const filename = lines[i].slice(5).trim(); i++;
        while(i<lines.length && !/^\d+-\d+:/.test(lines[i])) i++;
        if(i<lines.length){
          const m = lines[i].match(/^(\d+)-(\d+):/);
          if(m){
            const start= parseInt(m[1]); const end=parseInt(m[2]); i++;
            const repl=[];
            while(i<lines.length && !lines[i].startsWith('FILE:') && !/^\d+-\d+:/.test(lines[i])){
              let line = lines[i].replace(/^\s*\d+:\s?/, '');
              repl.push(line); i++;
            }
            patches.push({file:filename, startLine:start, endLine:end, replacement: repl.join('\n')});
          }
        }
      } else i++;
    }
    return patches;
  }

  function applyPatch(patch){
    if(!state.files.has(patch.file)) return false;
    const content = state.files.get(patch.file);
    const lines = content.split('\n');
    if(patch.startLine <1 || patch.endLine > lines.length) return false;
    const newLines = [
      ...lines.slice(0, patch.startLine-1),
      ...patch.replacement.split('\n'),
      ...lines.slice(patch.endLine)
    ];
    state.files.set(patch.file, newLines.join('\n'));
    state.sizes.set(patch.file, new Blob([state.files.get(patch.file)]).size);
    return true;
  }
})();
