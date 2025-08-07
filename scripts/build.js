// scripts/build.js (New Self-Contained Version)
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process'; // Import a tool to run shell commands

// --- Configuration ---
const PAGES_DIR = 'pages';
const PUBLIC_DIR = 'public';
const OUTPUT_DIR = 'dist'; // The final deployment folder

// --- Main Build Function ---
async function main() {
    console.log('🚀 Starting Showcase build process...');
    try {
        // --- Step 1: Discover projects and create projects.json ---
        console.log('🔍 Scanning for projects...');
        const projectTree = await discoverAndBuild(PAGES_DIR);
        console.log(`✅ Discovered project structure with ${projectTree.length} top-level items.`);
        
        await fs.writeFile(
            path.join(PUBLIC_DIR, 'projects.json'),
            JSON.stringify(projectTree, null, 2)
        );
        console.log('✅ Created projects.json in public directory.');

        // --- Step 2: Run the standard Vite build process ---
        console.log('📦 Building the React application with Vite...');
        execSync('vite build', { stdio: 'inherit' });
        console.log('✅ Vite build complete.');

        // --- Step 3: Copy the 'pages' directory into the final output ---
        console.log(`🚚 Copying '${PAGES_DIR}' directory to '${OUTPUT_DIR}'...`);
        await fs.cp(PAGES_DIR, path.join(OUTPUT_DIR, PAGES_DIR), { recursive: true });
        console.log(`✅ Copied pages successfully.`);
        
        console.log('🎉 Showcase build finished!');

    } catch (error) {
        if (error.code === 'ENOENT' && (error.path === 'pages' || error.path === 'public/pages')) {
             console.warn('⚠️  `pages` directory not found. Creating empty projects list.');
             await fs.writeFile(path.join(PUBLIC_DIR, 'projects.json'), '[]');
             // Still try to build the main app
             execSync('vite build', { stdio: 'inherit' });
        } else {
            console.error('🔥 Build failed:', error);
            process.exit(1);
        }
    }
}


// --- Helper Functions (No changes needed below this line) ---

async function discoverAndBuild(directory) {
    const items = [];
    try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const fullPath = path.join(directory, entry.name);
            if (entry.name.startsWith('cat.')) {
                items.push({
                    id: entry.name,
                    name: entry.name.substring(4).replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    type: 'category',
                    children: await discoverAndBuild(fullPath)
                });
            } else {
                try {
                    await fs.access(path.join(fullPath, 'index.html'));
                    items.push({
                        id: entry.name,
                        name: entry.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        type: 'project'
                    });
                } catch {}
            }
        }
        return items.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'category' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    } catch {
        return []; // Return empty array if pages dir doesn't exist
    }
}

main();