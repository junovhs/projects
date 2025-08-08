// scripts/build.js
// Build: generates projects.json (with slugs + optional metadata), runs Vite, and copies /pages to /dist/pages.

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const PAGES_DIR = 'pages';
const PUBLIC_DIR = 'public';
const OUTPUT_DIR = 'dist';

// ---------- helpers ----------
function titleize(s) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// unique slugs across tree
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

async function readMeta(fullPath) {
  // Optional /pages/.../meta.json with {title, date, tags, summary}
  try {
    const raw = await fs.readFile(path.join(fullPath, 'meta.json'), 'utf8');
    const json = JSON.parse(raw);
    return json && typeof json === 'object' ? json : {};
  } catch {
    return {};
  }
}

// ---------- discovery ----------
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
        id: relPath,
        name: titleize(entry.name.slice(4)),
        type: 'category',
        children: await scan(fullPath, relPath),
      });
    } else {
      try {
        await fs.access(path.join(fullPath, 'index.html'));
        const meta = await readMeta(fullPath);
        const stat = await fs.stat(fullPath);
        const name = meta.title ? String(meta.title) : titleize(entry.name);
        const slug = uniqueSlug(slugify(entry.name), relPath);

        items.push({
          id: relPath,            // full relative path used for iframe src
          slug,                   // short URL /<slug>
          name,                   // display name (can be overridden by meta.title)
          type: 'project',
          updatedAt: (meta.date ? new Date(meta.date) : stat.mtime).toISOString(),
          tags: Array.isArray(meta.tags) ? meta.tags : undefined,
          summary: typeof meta.summary === 'string' ? meta.summary : undefined,
        });
      } catch {
        // no index.html -> ignore
      }
    }
  }

  // Categories first, then alphabetical
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'category' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ---------- main ----------
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
