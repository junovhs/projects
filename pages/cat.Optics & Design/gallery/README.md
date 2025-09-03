# Dream Series Manager

A content management tool for organizing AI-generated dream imagery into a structured 10-post Instagram series.

## Project Background

This project stems from a fascination with "that dream feeling" - the uncanny, liminal quality of dream consciousness where familiar elements become strange through impossible configurations. The goal is to create a series of AI-generated images that capture this specific phenomenological experience and organize them into a compelling social media narrative.

### The Creative Vision

The series explores dream logic through visual metaphors:
- **Escalators ascending infinitely** into void
- **Familiar spaces rendered impossible** (endless mall corridors, floating architecture)
- **Liminal environments** that feel both recognizable and wrong
- **Emotional logic over rational physics** (things that shouldn't exist but feel inevitable)

Each image uses specific AI prompting techniques to achieve a "shitty phone camera" aesthetic - low quality, harsh flash, compression artifacts - that makes the impossible feel candidly real.

## Technical Architecture

### Current Setup
- **Single HTML file** - Self-contained application with embedded CSS/JavaScript
- **Browser localStorage** - Client-side persistence, no backend required  
- **Drag & drop interface** - Visual organization of images into series structure
- **Export functionality** - JSON backup of organized content

### Existing Infrastructure 
The broader project includes a monorepo with:
- **Vercel hosting** with automatic GitHub deployment
- **Vercel Blob storage** for image hosting (1GB free tier)
- **Vercel KV** for metadata persistence
- **Shared API routes** (`/api/images.js`, `/api/generate.js`) for file management and AI generation
- **Multiple specialized apps** sharing common backend services

## Current Application Features

### Series Organization
- **10-post structure** matching planned Instagram campaign
- **8 images per post** (Instagram carousel limit)
- **Drag & drop workflow** from unassigned pool to specific post slots
- **Visual progress tracking** showing completion status per post

### Image Management
- **Metadata storage**: AI prompts used, tags, custom names
- **Search and filtering** by tags and prompts
- **Modal editing** for detailed image information
- **Delete functionality** with series cleanup

### Content Planning
- **Export system** for backup and sharing
- **Local persistence** for offline work
- **Mobile-responsive** for on-the-go content review

## Development Goals

### Immediate Priorities
1. **Server integration** - Replace localStorage with existing Vercel Blob/KV infrastructure
2. **Prompt management** - Save and reuse successful AI prompts
3. **Batch operations** - Tag multiple images, move series positions
4. **Preview mode** - See how posts will look on Instagram

### Future Enhancements
1. **Instagram API integration** - Direct posting from the tool
2. **Analytics tracking** - View engagement metrics per post
3. **Collaboration features** - Share series with others for feedback
4. **Template system** - Create new series based on successful patterns

## Integration Approach

The application should leverage existing infrastructure rather than rebuild:

### API Integration
```javascript
// Replace localStorage with existing API endpoints
await fetch('/api/images', { method: 'POST', body: imageData });
await fetch('/api/generate', { method: 'POST', body: promptData });
```

### Authentication
- Use existing `AI_API_PASSWORD` bearer token system
- Integrate with current `/api/_lib/auth.js` helpers

### File Storage
- Utilize existing Vercel Blob setup for image hosting
- Maintain current metadata structure in `/api/images.js`

## Content Strategy

The series follows a narrative arc:
1. **"After Hours"** - Empty but normal spaces that feel wrong
2. **"Something's Off"** - Familiar elements with incorrect proportions  
3. **"Patterns"** - Unnatural synchronization and repetition
4. **"Familiar Strangers"** - Recognition without memory
5. **"Bleeding Through"** - Past intrudes into present
6. **"Time Collapse"** - Temporal boundaries dissolve
7. **"The Watchers"** - Everything has consciousness
8. **"Invitation"** - Portals to impossible spaces
9. **"The Deep"** - Full reality breakdown
10. **"Integration"** - Seeing both realities simultaneously

Each post builds psychological tension while maintaining the core aesthetic of "phone camera documenting the impossible."

## Technical Considerations

### Performance
- Images stored as base64 in current implementation (size limitations)
- Should migrate to blob URLs with server storage
- Lazy loading for large image collections

### User Experience  
- Optimized for desktop content creation workflow
- Mobile-responsive for content review and planning
- Keyboard shortcuts for power users

### Data Structure
```javascript
{
  images: [{
    id: String,
    name: String,
    data: String, // base64 or blob URL
    prompt: String, // AI prompt used
    tags: Array,
    uploadDate: String,
    seriesPosition: { post: Number, slot: Number }
  }],
  series: {
    post1: { title: String, images: Array },
    // ... post10
  }
}
```

## Development Environment

### Prerequisites
- Node.js for development server
- Vercel CLI for deployment
- Access to existing environment variables:
  - `BLOB_READ_WRITE_TOKEN`
  - `AI_API_PASSWORD` 
  - `GEMINI_API_KEY`

### Setup
```bash
git clone [repository]
cd projects/pages/dream-series/
# Open index.html in browser for local development
# OR integrate with existing Vercel project
```

## Success Metrics

### Creative Goals
- Generate 80+ compelling images exploring dream phenomenology
- Achieve consistent aesthetic across varied impossible scenarios
- Build narrative tension through 10-post progression

### Technical Goals  
- Seamless content organization workflow
- Zero-friction image management and editing
- Reliable backup and export functionality
- Mobile-friendly content review experience

### Strategic Goals
- Create production-ready content management system for AI art series
- Document effective prompting techniques for dream-like imagery  
- Build audience engagement through systematic visual narrative
- Scale system for multiple concurrent art projects