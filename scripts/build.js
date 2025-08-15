#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Clean, strict build:
 * 1) Fail if 'public/pages' exists (we only source from '/pages').
 * 2) Generate 'public/projects.json' by scanning '/pages/**/index.html'.
 * 3) Run 'vite build'.
 * 4) Copy '/pages' → '/dist/pages' for static serving on Vercel.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, 'pages');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST_DIR  = path.join(ROOT, 'dist');

async function exists(p) { try { await fsp.access(p); return true; } catch { return false; } }

async function* walk(dir, base = dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const res = path.resolve(dir, e.name);
    if (e.isDirectory()) yield* walk(res, base);
    else yield path.relative(base, res);
  }
}

async function copyDir(src, dest) {
  if (!(await exists(src))) return;
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fsp.copyFile(s, d);
  }
}

async function generateProjectsJson() {
  await fsp.mkdir(PUBLIC_DIR, { recursive: true });
  const projects = [];
  if (await exists(PAGES_DIR)) {
    for await (const rel of walk(PAGES_DIR)) {
      if (rel.endsWith(path.sep + 'index.html') || rel.endsWith('/index.html') || rel === 'index.html') {
        const abs = path.join(PAGES_DIR, rel);
        const raw = await fsp.readFile(abs, 'utf8').catch(() => '');
        const titleMatch = raw && raw.match(/<title>\s*([^<]+?)\s*<\/title>/i);
        const title = (titleMatch && titleMatch[1]) || path.basename(path.dirname(abs)) || 'Untitled';
        // slug is directory path of index.html (no 'index.html', no leading slash)
        let slug = rel.slice(0, -'index.html'.length).replace(/\\/g, '/');
        if (slug.endsWith('/')) slug = slug.slice(0, -1);
        const href = `/pages/${slug}`;
        const segments = slug.split('/').filter(Boolean);
        const category = segments[0] || '';
        projects.push({ title, path: href, category, slug });
      }
    }
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    count: projects.length,
    projects
  };
  const out = path.join(PUBLIC_DIR, 'projects.json');
  await fsp.writeFile(out, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✔ Wrote ${out} with ${projects.length} entries`);
}

async function main() {
  // 1) Hard fail if legacy tree exists
  const legacy = path.join(PUBLIC_DIR, 'pages');
  if (await exists(legacy)) {
    throw new Error(
      "Found 'public/pages'. Move all content into '/pages' and delete 'public/pages'.\n" +
      "This build intentionally fails to keep the repo clean."
    );
  }

  // 2) Generate projects.json
  await generateProjectsJson();

  // 3) Build SPA with Vite
  console.log('▶ Running Vite build...');
  cp.execSync('npx vite build', { stdio: 'inherit' });

  // 4) Copy /pages → /dist/pages
  console.log('▶ Copying /pages → /dist/pages ...');
  await copyDir(PAGES_DIR, path.join(DIST_DIR, 'pages'));
  console.log('✔ Copied pages');

  // 5) Optional: sanity — prevent heavy apps under /pages
  // If you *do* want nested apps, comment this out.
  const forbidden = cp.execSync('git ls-files "pages/**/package.json" || true').toString().trim();
  if (forbidden) {
    console.warn('\n⚠ Found package.json under /pages (looks like a full app inside pages):\n', forbidden);
    console.warn('  Consider moving full apps to their own folder/repo. Build continuing...\n');
  }
}

main().catch((err) => {
  console.error('✖ Build failed:\n', err && err.message ? err.message : err);
  process.exit(1);
});
