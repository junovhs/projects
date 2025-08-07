// scripts/build.js
import fs from 'fs/promises';
import path from 'path';

const PAGES_DIR = 'pages';
const OUTPUT_DIR = 'dist'; // Vercel's default output is 'public', but 'dist' is a common standard

async function build() {
    console.log('🚀 Starting build...');
    try {
        // 1. Find all directories inside 'pages' that contain an 'index.html'
        const projectFolders = (await fs.readdir(PAGES_DIR, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory());

        const projects = [];
        for (const folder of projectFolders) {
            try {
                await fs.access(path.join(PAGES_DIR, folder.name, 'index.html'));
                projects.push({
                    id: folder.name,
                    name: folder.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                });
            } catch {
                // Not a project folder, ignore it
            }
        }
        projects.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`🔍 Found ${projects.length} projects.`);

        // 2. Prepare the output directory
        await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // 3. Copy the 'public' folder contents (your website shell)
        await fs.cp('public', OUTPUT_DIR, { recursive: true });

        // 4. Copy the actual project pages
        await fs.cp(PAGES_DIR, path.join(OUTPUT_DIR, PAGES_DIR), { recursive: true });
        console.log('✅ Copied project and public files.');

        // 5. Create the projects.json file for the frontend to use
        await fs.writeFile(
            path.join(OUTPUT_DIR, 'projects.json'),
            JSON.stringify(projects)
        );
        console.log('✅ Created projects.json.');
        console.log('🎉 Build successful!');

    } catch (error) {
        console.error('🔥 Build failed:', error);
        process.exit(1);
    }
}

build();
