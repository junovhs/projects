// projects/scripts/build.cjs
'use strict';
const fs = require('fs').promises;
const path = require('path');

const ROOT_DIR = process.cwd();
const PAGES_DIR = path.join(ROOT_DIR, 'pages');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

/**
 * Generates a URL-friendly slug from a string.
 * Example: 'My Awesome Project!' -> 'my-awesome-project'
 */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD') // Split accented characters into letters and accents
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
}

/**
 * Creates a unique slug to avoid collisions.
 * Example: if 'my-project' exists, the next one becomes 'my-project-2'.
 */
function createUniqueSlug(baseSlug, existingSlugs) {
  let slug = baseSlug;
  let counter = 2;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  existingSlugs.add(slug);
  return slug;
}

/**
 * Recursively scans the 'pages' directory to build a project tree.
 */
async function scanDirectory(directory, relativePath, existingSlugs) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nodes = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('THESE_ARE_CATEGORIES')) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    const currentRelPath = path.join(relativePath, entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      // Check if it's a project folder (contains index.html) or a category folder.
      try {
        await fs.access(path.join(fullPath, 'index.html'));
        // It's a project folder.
        const name = entry.name.replace(/[-_]/g, ' ');
        const title = name.replace(/\b\w/g, char => char.toUpperCase());
        const slug = createUniqueSlug(slugify(entry.name), existingSlugs);
        
        nodes.push({
          id: currentRelPath,
          slug: slug,
          name: title,
          type: 'project',
        });
      } catch {
        // It's a category folder.
        const children = await scanDirectory(fullPath, currentRelPath, existingSlugs);
        if (children.length > 0) {
          nodes.push({
            id: currentRelPath,
            name: entry.name,
            type: 'category',
            children: children,
          });
        }
      }
    }
  }
  
  // Sort categories first, then alphabetically.
  return nodes.sort((a, b) => {
    if (a.type === 'category' && b.type !== 'category') return -1;
    if (a.type !== 'category' && b.type === 'category') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Main function to generate and write projects.json.
 */
async function buildProjectIndex() {
  try {
    console.log('Scanning project pages...');
    await fs.mkdir(PUBLIC_DIR, { recursive: true });
    
    const existingSlugs = new Set();
    const projectTree = await scanDirectory(PAGES_DIR, '', existingSlugs);

    const outputPath = path.join(PUBLIC_DIR, 'projects.json');
    await fs.writeFile(outputPath, JSON.stringify(projectTree, null, 2), 'utf8');

    console.log(`Successfully generated projects.json with ${projectTree.length} top-level categories.`);
  } catch (error) {
    console.error('Failed to build project index:');
    console.error(error);
    process.exit(1);
  }
}

buildProjectIndex();