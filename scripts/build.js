// scripts/build.js
import fs from 'fs/promises';
import path from 'path';

const PAGES_DIR = 'pages';
const PUBLIC_DIR = 'public'; // Vite will copy contents of 'public' to the final build

async function build() {
    console.log('🚀 Starting pre-build script...');
    try {
        const projectFolders = (await fs.readdir(PAGES_DIR, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory());

        const projects = [];
        for (const folder of projectFolders) {
            try {
                // Check if an index.html exists to consider it a valid project
                await fs.access(path.join(PAGES_DIR, folder.name, 'index.html'));
                projects.push({
                    id: folder.name,
                    name: folder.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                });
            } catch {
                // Ignore folders that aren't valid projects
            }
        }
        projects.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`🔍 Found ${projects.length} projects.`);

        // Write the projects list to a JSON file inside the `public` directory
        await fs.writeFile(
            path.join(PUBLIC_DIR, 'projects.json'),
            JSON.stringify(projects)
        );
        console.log('✅ Created projects.json in public directory.');

    } catch (error) {
        // If the `pages` directory doesn't exist, don't fail the build.
        // Just create an empty projects list.
        if (error.code === 'ENOENT' && error.path === 'pages') {
             console.warn('⚠️  `pages` directory not found. Creating empty projects list.');
             await fs.writeFile(path.join(PUBLIC_DIR, 'projects.json'),'[]');
        } else {
            console.error('🔥 Pre-build script failed:', error);
            process.exit(1);
        }
    }
}

build();