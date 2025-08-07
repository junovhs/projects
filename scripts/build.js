// scripts/build.js (New Recursive Version)
import fs from 'fs/promises';
import path from 'path';

const PAGES_DIR = 'public/pages';

// This function recursively scans directories to build a nested structure
async function discoverAndBuild(directory) {
    const items = [];
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const fullPath = path.join(directory, entry.name);

        // Check if it's a category
        if (entry.name.startsWith('cat.')) {
            items.push({
                id: entry.name,
                name: entry.name.substring(4).replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type: 'category',
                children: await discoverAndBuild(fullPath) // Recursion!
            });
        } else {
            // Otherwise, check if it's a valid project folder
            try {
                await fs.access(path.join(fullPath, 'index.html'));
                items.push({
                    id: entry.name,
                    name: entry.name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    type: 'project'
                });
            } catch {
                // Not a project, ignore
            }
        }
    }
    
    // Sort with categories first, then alphabetically
    return items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'category' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}


async function main() {
    console.log('🚀 Starting build with nested discovery...');
    try {
        const projectTree = await discoverAndBuild(PAGES_DIR);
        console.log(`🔍 Discovered project structure.`);

        await fs.writeFile(
            path.join('public', 'projects.json'),
            JSON.stringify(projectTree, null, 2)
        );
        console.log('✅ Created nested projects.json in public directory.');
        console.log('🎉 Build successful!');
    } catch (error) {
        if (error.code === 'ENOENT' && error.path === 'public/pages') {
             console.warn('⚠️  `public/pages` directory not found. Creating empty projects list.');
             await fs.writeFile(path.join('public', 'projects.json'), '[]');
        } else {
            console.error('🔥 Build failed:', error);
            process.exit(1);
        }
    }
}

main();