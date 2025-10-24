// projects/scripts/build.cjs
'use strict';
const fs = require('fs').promises;
const path = require('path');

const ROOT_DIR = process.cwd();
const PAGES_DIR = path.join(ROOT_DIR, 'pages');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function slugify(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}
function createUniqueSlug(baseSlug, existingSlugs) {
  let slug = baseSlug; let counter = 2;
  while (existingSlugs.has(slug)) { slug = `${baseSlug}-${counter++}`; }
  existingSlugs.add(slug); return slug;
}

async function scanDirectory(directory, relativePath, existingSlugs) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nodes = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('THESE_ARE_CATEGORIES')) continue;
    const fullPath = path.join(directory, entry.name);
    const currentRelPath = path.join(relativePath, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      try {
        await fs.access(path.join(fullPath, 'index.html'));
        const name = entry.name.replace(/[-_]/g, ' ');
        const title = name.replace(/\b\w/g, char => char.toUpperCase());
        const slug = createUniqueSlug(slugify(entry.name), existingSlugs);
        nodes.push({ id: currentRelPath, slug: slug, name: title, type: 'project' });
      } catch {
        const children = await scanDirectory(fullPath, currentRelPath, existingSlugs);
        if (children.length > 0) {
          nodes.push({ id: currentRelPath, name: entry.name, type: 'category', children: children });
        }
      }
    }
  }
  return nodes.sort((a, b) => {
    if (a.type === 'category' && b.type !== 'category') return -1;
    if (a.type !== 'category' && b.type === 'category') return 1;
    return a.name.localeCompare(b.name);
  });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  try {
    console.log('1. Generating project index...');
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    const existingSlugs = new Set();
    const projectTree = await scanDirectory(PAGES_DIR, '', existingSlugs);
    await fs.writeFile(path.join(PUBLIC_DIR, 'projects.json'), JSON.stringify(projectTree, null, 2), 'utf8');
    console.log('   -> public/projects.json created.');

    console.log('2. Copying project pages to public directory...');
    await copyDir(PAGES_DIR, path.join(PUBLIC_DIR, 'pages'));
    console.log('   -> public/pages/ created.');

    console.log('\nPrepare build step complete.');
  } catch (error) {
    console.error('\nPrepare build step failed:');
    console.error(error);
    process.exit(1);
  }
}

main();