'use strict';
const fs0=require('fs');
const fsp=fs0.promises;
const path0=require('path');
const cp=require('child_process');
const ROOT=process.cwd();
const PAGES_DIR=path0.join(ROOT,'pages');
const PUBLIC_DIR=path0.join(ROOT,'public');
const DIST_DIR=path0.join(ROOT,'dist');
function titleize(s){return String(s).replace(/[-_]/g,' ').replace(/\b\w/g,m=>m.toUpperCase());}
function slugify(str){return String(str).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');}
const slugTaken=new Map();
function uniqueSlug(base,rel){let slug=base||'project';let i=2;while(slugTaken.has(slug)&&slugTaken.get(slug)!==rel){slug=base+'-'+(i++);}slugTaken.set(slug,rel);return slug;}
async function exists(p){try{await fsp.access(p);return true;}catch{return false;}}
async function readMeta(full){try{const raw=await fsp.readFile(path0.join(full,'meta.json'),'utf8');const j=JSON.parse(raw);return j&&typeof j==='object'?j:{};}catch{return{};}}
async function scan(dir,rel){const out=[];let ents=[];try{ents=await fsp.readdir(dir,{withFileTypes:true});}catch{return out;}for(const e of ents){if(!e.isDirectory())continue;const full=path0.join(dir,e.name);const r=rel?rel+'/'+e.name:e.name;if(e.name.startsWith('cat.')){out.push({id:r,name:titleize(e.name.slice(4)),type:'category',children:await scan(full,r)});}else{try{await fsp.access(path0.join(full,'index.html'));const meta=await readMeta(full);const st=await fsp.stat(full);const name=meta.title?String(meta.title):titleize(e.name);const slug=uniqueSlug(slugify(e.name),r);out.push({id:r,slug:slug,name:name,type:'project',updatedAt:(meta.date?new Date(meta.date):st.mtime).toISOString(),tags:Array.isArray(meta.tags)?meta.tags:undefined,summary:typeof meta.summary==='string'?meta.summary:undefined});}catch{}}}return out.sort((a,b)=>{if(a.type!==b.type)return a.type==='category'?-1:1;return a.name.localeCompare(b.name);});}
async function copyDir(src,dst){if(!(await exists(src)))return;await fsp.mkdir(dst,{recursive:true});const ents=await fsp.readdir(src,{withFileTypes:true});for(const e of ents){const s=path0.join(src,e.name);const d=path0.join(dst,e.name);if(e.isDirectory())await copyDir(s,d);else await fsp.copyFile(s,d);}}
(async()=>{
  const skipVite=process.argv.includes('--skip-vite');
  const legacy=path0.join(PUBLIC_DIR,'pages');
  if(await exists(legacy)){console.error("Found 'public/pages'. Move to '/pages' and delete 'public/pages'.");process.exit(1);}
  await fsp.mkdir(PUBLIC_DIR,{recursive:true});
  const tree=await scan(PAGES_DIR,'');
  await fsp.writeFile(path0.join(PUBLIC_DIR,'projects.json'),JSON.stringify(tree,null,2),'utf8');
  console.log('wrote '+path0.join(PUBLIC_DIR,'projects.json')+' with '+tree.length+' top-level nodes');
  if(!skipVite){
    console.log('vite build...');
    cp.execSync('npx vite build',{stdio:'inherit'});
    console.log('copy pages to dist/pages...');
    await copyDir(PAGES_DIR,path0.join(DIST_DIR,'pages'));
    console.log('done');
  }
})().catch(e=>{console.error(e&&e.stack?e.stack:e);process.exit(1);});