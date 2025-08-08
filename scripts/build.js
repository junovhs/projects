// scripts/build.js
// Build: generates projects.json, runs Vite, and copies /pages to /dist/pages.

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const PAGES_DIR = 'pages';
const PUBLIC_DIR = 'public';
const OUTPUT_DIR = 'dist';

function titleize(s) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

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
        id: relPath, // keep the real folder name (includes "cat.")
        name: titleize(entry.name.slice(4)), // pretty label without "cat."
        type: 'category',
        children: await scan(fullPath, relPath),
      });
    } else {
      try {
        await fs.access(path.join(fullPath, 'index.html'));
        items.push({
          id: relPath, // FULL relative path, not just the folder name
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
