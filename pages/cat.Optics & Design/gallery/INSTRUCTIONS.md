# Image Album Manager - Deployment Instructions

## GitHub + Vercel Deployment

This image album manager is built with pure HTML/CSS/JavaScript and works perfectly with GitHub Pages and Vercel.

### Setup Steps:

1. **Create GitHub Repository**
   - Create a new repository on GitHub
   - Upload all files (index.html, app.js, upload.js, storage.js, styles.css)
   - Ensure the repository is public

2. **Deploy with Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account
   - Click "New Project"
   - Import your GitHub repository
   - No build configuration needed - it's static files
   - Deploy!

### How It Works:
- Images are stored locally in your browser's IndexedDB
- No server required - everything runs client-side
- Images are preserved in their original quality as base64 data
- Download feature strips metadata for clean exports
- Works offline after initial load

### Storage Limits:
- IndexedDB typically allows 50MB+ per domain
- Perfect for personal image collections
- If you need more storage, consider implementing cloud storage integration

### Features:
- Drag & drop upload
- Tag management
- Search and sort
- Metadata-stripped downloads
- Responsive design
- Works on mobile and desktop

No server costs, no database costs - completely free hosting!

