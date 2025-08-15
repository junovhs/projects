'use strict';
const fs0 = require('fs');
const fsp = require('fs/promises');
const path0 = require('path');
const cp = require('child_process');
const ROOT = process.cwd();
const PAGES_DIR = path0.join(ROOT,'pages');
const PUBLIC_DIR = path0.join(ROOT,'public');
const DIST_DIR = path0.join(ROOT,'dist');
async function exists(p){ try{ await fsp.access(p); return true; } catch{ return false; } }
async function* walk(dir, base){
  const entries = await fsp.readdir(dir,{withFileTypes:true});
  for (const e of entries){
    const res = path0.join(dir,e.name);
    if (e.isDirectory()) { yield* walk(res, base); }
    else { yield path0.relative(base,res).replace(/\\/g,'/'); }
  }
}
async function copyDir(src,dst){
  if (!(await exists(src))) return;
  await fsp.mkdir(dst,{recursive:true});
  const entries = await fsp.readdir(src,{withFileTypes:true});
  for (const e of entries){
    const s = path0.join(src,e.name);
    const d = path0.join(dst,e.name);
    if (e.isDirectory()) await copyDir(s,d);
    else await fsp.copyFile(s,d);
  }
}
async function generateProjectsJson(){
  await fsp.mkdir(PUBLIC_DIR,{recursive:true});
  const outFile = path0.join(PUBLIC_DIR,'projects.json');
  const projects = [];
  if (await exists(PAGES_DIR)){
    for await (const rel of walk(PAGES_DIR,PAGES_DIR)){
      if (rel.endsWith('/index.html') || rel === 'index.html'){
        const abs = path0.join(PAGES_DIR,rel);
        let title = 'Untitled';
        try { const raw = await fsp.readFile(abs,'utf8'); const m = raw.match(/<title>\s*([^<]+?)\s*<\/title>/i); if (m) title = m[1]; } catch {}
        let slug = rel.slice(0,-'index.html'.length); if (slug.endsWith('/')) slug = slug.slice(0,-1);
        const href = '/pages/' + slug;
        const category = (slug.split('/').filter(Boolean)[0]) || '';
        projects.push({ title, path: href, category, slug });
      }
    }
  }
  const payload = { generatedAt: new Date().toISOString(), count: projects.length, projects };
  await fsp.writeFile(outFile, JSON.stringify(payload,null,2), 'utf8');
  console.log('wrote ' + outFile + ' with ' + projects.length + ' entries');
}
(async function(){
  const legacy = path0.join(PUBLIC_DIR,'pages');
  if (await exists(legacy)) { console.error("Found 'public/pages'. Move everything into '/pages' and delete 'public/pages'."); process.exit(1); }
  await generateProjectsJson();
  console.log('vite build...');
  cp.execSync('npx vite build',{stdio:'inherit'});
  console.log('copy pages to dist/pages...');
  await copyDir(PAGES_DIR, path0.join(DIST_DIR,'pages'));
  console.log('done');
})().catch((err)=>{ console.error(err && err.stack ? err.stack : err); process.exit(1); });
