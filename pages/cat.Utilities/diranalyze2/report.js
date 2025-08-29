// DIRANALYSE MATRIX REPORT (v3.2.1)
function generateV3Report({ allPaths, getSize, getExt, scopeLabel }) {
  const version = 'v3.2.1';
  const now = new Date().toISOString();
  const paths = (allPaths || []).filter(p => !p.endsWith('/'));
  const rootName = (paths[0] || '').split('/')[0] || '(root)';
  const scope = scopeLabel || 'Full scanned directory';

  function makeNode(name){ return { name, dirs:new Map(), files:[], totals:{files:0, dirs:0, size:0} }; }
  const root = makeNode(rootName);

  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    const startIdx = parts[0] === rootName ? 1 : 0;
    for (let i = startIdx; i < parts.length; i++) {
      const seg = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        node.files.push({ name: seg, path: p, size: getSize(p), ext: getExt(seg) });
      } else {
        if (!node.dirs.has(seg)) node.dirs.set(seg, makeNode(seg));
        node = node.dirs.get(seg);
      }
    }
  }

  function agg(node){
    let files = node.files.length;
    let size  = node.files.reduce((a,f)=> a + (f.size||0), 0);
    let dirs  = 0;
    for(const [,child] of node.dirs){
      const t = agg(child);
      files += t.files; size += t.size; dirs += 1 + t.dirs;
    }
    node.totals = { files, dirs, size };
    return node.totals;
  }
  agg(root);

  function formatSize(bytes){
    if(bytes < 1024) return bytes + ' Bytes';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(2) + ' KB';
    if(bytes < 1024*1024*1024) return (bytes/(1024*1024)).toFixed(2) + ' MB';
    return (bytes/(1024*1024*1024)).toFixed(2) + ' GB';
  }

  function printDir(node, prefix){
    const out = [];
    if(prefix===''){
      out.push(`${node.name}/ (Files: ${node.totals.files}, Subdirs: ${node.totals.dirs}, Size: ${formatSize(node.totals.size)})`);
    }
    const dirNames = Array.from(node.dirs.keys()).sort((a,b)=> a.localeCompare(b));
    const fileObjs = node.files.slice().sort((a,b)=> a.name.localeCompare(b.name));
    const totalKids = dirNames.length + fileObjs.length;
    let idx = 0;
    const nextPref = (isLast) => prefix + (isLast ? '    ' : '│   ');
    for(const d of dirNames){
      idx++; const child = node.dirs.get(d); const isLast = idx === totalKids;
      out.push(`${prefix}${isLast?'└── ':'├── '}${d}/ (Files: ${child.totals.files}, Subdirs: ${child.totals.dirs}, Size: ${formatSize(child.totals.size)})`);
      out.push(...printDir(child, nextPref(isLast)));
    }
    for(const f of fileObjs){
      idx++; const isLast = idx === totalKids;
      out.push(`${prefix}${isLast?'└── ':'├── '}${f.name} (Size: ${formatSize(f.size)}, Ext: ${f.ext})`);
    }
    return out;
  }

  const header = [
    `//--- DIRANALYSE MATRIX REPORT (${version}) ---//`,
    `// Timestamp: ${now}`,
    `// Root Path: ${root.name}`,
    `// Scope: ${scope}`,
    `// Note: File sizes reflect original scanned values.`,
    `//`,
    `//--- DIRECTORY STRUCTURE ---`,
  ].join('\n');

  const body = printDir(root, '');
  const totals = root.totals;
  const summary = [
    `//`,
    `//--- SUMMARY (Current View) ---`,
    `Total Files in View    : ${totals.files}`,
    `Total Folders in View  : ${totals.dirs + 1}`,
    `Total Size (Original)  : ${formatSize(totals.size)}`,
    `//`,
    `//--- END OF REPORT ---//`
  ].join('\n');

  return `${header}\n${body.join('\n')}\n${summary}`;
}
