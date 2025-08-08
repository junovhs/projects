// scripts/build.js
// Build: generates projects.json (with slugs), runs Vite, and copies /pages to /dist/pages.

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const PAGES_DIR = 'pages';
const PUBLIC_DIR = 'public';
const OUTPUT_DIR = 'dist';

// ---- helpers -------------------------------------------------------------
function titleize(s) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')                         // remove diacritics
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')               // non-alnum -> dash
    .replace(/^-+|-+$/g, '')                   // trim dashes
    .replace(/-{2,}/g, '-');                   // collapse
}

// global registry so slugs are unique across the whole tree
const slugTaken = new Map(); // slug -> relPath
function uniqueSlug(base, relPath) {
  let slug = base || 'project';
  let i = 2;
  while (slugTaken.has(slug) && slugTaken.get(slug) !== relPath) {
    slug = `${base}-${i++}`;
  }
  slugTaken.set(slug, relPath);
  return slug;
}

// ---- discovery -----------------------------------------------------------
async function scan(dir, rel = '') {
  const items = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return items;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;

    if (entry.name.startsWith('cat.')) {
      items.push({
        id: relPath, // real folder name (includes "cat.")
        name: titleize(entry.name.slice(4)),
        type: 'category',
        children: await scan(fullPath, relPath),
      });
    } else {
      try {
        await fs.access(path.join(fullPath, 'index.html'));
        const slug = uniqueSlug(slugify(entry.name), relPath);
        items.push({
          id: relPath,         // full relative path used to resolve the iframe src
          slug,                // pretty, category-less URL segment
          name: titleize(entry.name),
          type: 'project',
        });
      } catch {
        // no index.html → ignore
      }
    }
  }

  // Categories first, then alphabetical
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'category' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ---- main ----------------------------------------------------------------
async function main() {
  console.log('🚀 Showcase build start');
  const tree = await scan(PAGES_DIR);

  await fs.writeFile(
    path.join(PUBLIC_DIR, 'projects.json'),
    JSON.stringify(tree, null, 2)
  );
  console.log('✅ Wrote public/projects.json');

  console.log('📦 Running Vite build…');
  execSync('vite build', { stdio: 'inherit' });
  console.log('✅ Vite build complete');

  console.log('📁 Copying pages → dist/pages …');
  await fs.cp(PAGES_DIR, path.join(OUTPUT_DIR, PAGES_DIR), { recursive: true });
  console.log('✅ Done');

  console.log('🎉 Build finished');
}

main().catch((err) => {
  console.error('🔥 Build failed', err);
  process.exit(1);
});
