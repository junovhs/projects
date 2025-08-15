'use strict';
const fs0 = require('fs');
const fsp = fs0.promises;
const path0 = require('path');
const cp = require('child_process');
const ROOT = process.cwd();
const PAGES_DIR = path0.join(ROOT,'pages');
const PUBLIC_DIR = path0.join(ROOT,'public');
const DIST_DIR = path0.join(ROOT,'dist');

function titleize(s){ return String(s).replace(/[-_]/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }
function slugify(str){ return String(str).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-'); }
const slugTaken = new Map();
function uniqueSlug(base, relPath){ let slug = base||'project'; let i=2; while(slugTaken.has(slug) && slugTaken.get(slug)!==relPath){ slug = base + '-' + (i++); } slugTaken.set(slug, relPath); return slug; }
async function exists(p){ try{ await fsp.access(p); return true; }catch{ return false; } }
async function readMeta(fullPath){ try{ const raw = await fsp.readFile(path0.join(fullPath,'meta.json'),'utf8'); const json = JSON.parse(raw); return json && typeof json==='object' ? json : {}; } catch{ return {}; } }

async function scan(dir, rel = ''){
  const items = [];
  let entries = [];
  try { entries = await fsp.readdir(dir,{withFileTypes:true}); } catch { return items; }
  for (const entry of entries){
    if(!entry.isDirectory()) continue;
    const fullPath = path0.join(dir, entry.name);
    const relPath = rel ? rel + '/' + entry.name : entry.name;
    if (entry.name.startsWith('cat.')){
      items.push({
        id: relPath,
        name: titleize(entry.name.slice(4)),
        type: 'category',
        children: await scan(fullPath, relPath),
      });
    } else {
      try {
        await fsp.access(path0.join(fullPath,'index.html'));
        const meta = await readMeta(fullPath);
        const stat = await fsp.stat(fullPath);
        const name = meta.title ? String(meta.title) : titleize(entry.name);
        const slug = uniqueSlug(slugify(entry.name), relPath);
        items.push({
          id: relPath,
          slug: slug,
          name: name,
          type: 'project',
          updatedAt: (meta.date ? new Date(meta.date) : stat.mtime).toISOString(),
          tags: Array.isArray(meta.tags) ? meta.tags : undefined,
          summary: typeof meta.summary === 'string' ? meta.summary : undefined,
        });
      } catch {
        /* no index.html -> ignore */
      }
    }
  }
  return items.sort((a,b)=>{ if(a.type!==b.type) return a.type==='category' ? -1 : 1; return a.name.localeCompare(b.name); });
}

async function copyDir(src,dst){ if(!(await exists(src))) return; await fsp.mkdir(dst,{recursive:true}); const entries = await fsp.readdir(src,{withFileTypes:true}); for(const e of entries){ const s=path0.join(src,e.name); const d=path0.join(dst,e.name); if(e.isDirectory()) await copyDir(s,d); else await fsp.copyFile(s,d); } }

(async function(){
  const legacy = path0.join(PUBLIC_DIR,'pages');
  if (await exists(legacy)) { console.error("Found 'public/pages'. Move everything into '/pages' and delete 'public/pages'."); process.exit(1); }
  await fsp.mkdir(PUBLIC_DIR,{recursive:true});
  const tree = await scan(PAGES_DIR,'');
  await fsp.writeFile(path0.join(PUBLIC_DIR,'projects.json'), JSON.stringify(tree,null,2), 'utf8');
  console.log('wrote ' + path0.join(PUBLIC_DIR,'projects.json') + ' with ' + tree.length + ' top-level nodes');
  console.log('vite build...');
  cp.execSync('npx vite build',{stdio:'inherit'});
  console.log('copy pages to dist/pages...');
  await copyDir(PAGES_DIR, path0.join(DIST_DIR,'pages'));
  console.log('done');
})().catch(err=>{ console.error(err && err.stack ? err.stack : err); process.exit(1); });