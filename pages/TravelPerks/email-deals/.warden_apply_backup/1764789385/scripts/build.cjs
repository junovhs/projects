'use strict';
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

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

/**
 * Smart Copy:
 * - Detects package.json to trigger Modern Build.
 * - FALLBACK PREVENTION: If package.json exists, it MUST build or fail. It cannot fallback to copy.
 */
async function smartCopyDir(src, dest) {
  // 1. Check for Modern App indicators
  const packageJsonPath = path.join(src, 'package.json');
  let isModernApp = false;
  
  try {
    await fs.access(packageJsonPath);
    isModernApp = true;
  } catch {
    // Double check for vite config just in case
    try {
      await fs.access(path.join(src, 'vite.config.ts'));
      isModernApp = true;
      console.log(`??  Found vite.config.ts but no package.json in ${src}. This might fail.`);
    } catch {
      // Truly legacy
    }
  }

  if (isModernApp) {
    console.log(`\n?? DETECTED MODERN APP: ${path.basename(src)}`);
    console.log(`   ?? Source: ${src}`);
    
    try {
      console.log(`   ???  Running "npm install && npm run build"...`);
      
      // Run install and build inside the sub-project
      execSync('npm install && npm run build', { 
        cwd: src, 
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' } 
      });

      const distPath = path.join(src, 'dist');
      
      // Verify build succeeded
      await fs.access(distPath);
      
      console.log(`   ? Build success. Copying ${distPath} -> ${dest}`);
      
      // Copy the *built* artifacts (dist) to the public destination
      // Using fs.cp (Node 16.7+)
      await fs.cp(distPath, dest, { recursive: true });
      return; // STOP HERE. Do not fall through to legacy copy.

    } catch (err) {
      console.error(`\n? FATAL ERROR building modern app: ${src}`);
      console.error(`   The build command failed, or dist/ was not created.`);
      console.error(`   Error details: ${err.message}`);
      // Throwing stops the entire deploy, preventing broken code from going live
      throw new Error(`Build failed for ${src}`);
    }
  }

  // 2. Legacy/Normal Directory Logic: Recursive Copy
  // Only runs if NO package.json was found.
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (let entry of entries) {
    if (['node_modules', '.git', '.warden_apply_backup', 'dist', '.DS_Store'].includes(entry.name)) continue;
    
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await smartCopyDir(srcPath, destPath);
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

    console.log('2. Processing project pages (Build/Copy)...');
    await smartCopyDir(PAGES_DIR, path.join(PUBLIC_DIR, 'pages'));
    console.log('   -> public/pages/ populated.');

    console.log('\n? Prepare build step complete.');
  } catch (error) {
    console.error('\n? Prepare build step failed:');
    console.error(error);
    process.exit(1);
  }
}

main();