Here’s a fully rewritten **README.md** for your project, with all the recent fixes and architecture updates baked in. You can copy-paste this over your existing file.

---

# Dream Series Manager

A content management tool for organizing AI-generated dream imagery into a structured Instagram series.

---

## Project Background

This project explores the uncanny, liminal quality of dream consciousness where familiar elements become strange through impossible configurations. The tool enables creation and management of a 10-post Instagram narrative arc built around AI-generated “dream logic” imagery.

The creative direction emphasizes:

* **Impossible familiarity** (endless malls, floating escalators, warped architecture)
* **Emotional logic over physical logic** (things that shouldn’t exist but feel inevitable)
* **“Phone camera” aesthetic** (harsh flash, noise, compression artifacts) to make impossibility feel candid

---

## Technical Architecture

### Current Setup

* **Single HTML file** — App runs fully client-side in browser
* **Vercel Blob Storage** — Images uploaded and persisted remotely
* **Metadata JSON (`meta/images.json`)** — Synced with server, cached locally
* **LocalStorage** — Used only for lightweight metadata cache (IDs, tags, prompts)
* **Drag & Drop interface** — Organize unassigned images into posts visually
* **Toast notifications** — Show upload/delete feedback
* **Storage badge** — Displays remote usage (MB + image count)

### Infrastructure

* **Vercel hosting** with GitHub auto-deploys
* **Shared API routes**:

  * `/api/images` — Upload, list, update, and delete images
  * `/api/generate` — AI generation endpoint
* **Authentication**: Simple bearer token (`AI_API_PASSWORD`)

---

## Current Features

### Series Organization

* **10-post Instagram campaign structure**
* **8 images per post** (carousel limit)
* **Drag & drop** from unassigned pool to slots
* **Visual progress tracking** per post

### Image Management

* **Custom naming** — User assigns display names (file names ignored)
* **Metadata editing** — Name, prompt, tags via modal editor
* **Delete** — Removes both blob and metadata; resilient to missing blobs
* **Search & filter** — Across names, tags, and prompts
* **Feedback** — Upload success shown via toast + console logs
* **Remote sync** — Always reflects server state after upload

### Content Planning

* **Export/import** (via JSON backup)
* **Responsive design** for desktop workflow and mobile review
* **Keyboard shortcuts** for faster editing

---

## Development Goals

### Immediate Priorities

* ✅ **Server integration** — Replace base64/localStorage with Vercel Blob
* ✅ **Simplified editing** — Remove redundant file name/date fields
* ✅ **Upload feedback** — Toast + logs for debugging
* ✅ **Robust delete** — Handles already-missing blobs gracefully
* 🔄 **Drag/drop polish** — Improve slot placement reliability

### Future Enhancements

* Instagram API integration for direct publishing
* Analytics tracking (engagement metrics)
* Batch operations (bulk tag, bulk move)
* Template system for new series reuse
* Collaboration & shared editing

---

## Data Model

```json
{
  "images": [
    {
      "id": "string",
      "name": "string",        // custom user name
      "data": "string",        // blob URL
      "prompt": "string",      // AI prompt used
      "tags": ["array"],
      "uploadDate": "string",
      "pathname": "string",    // blob path
      "isRemote": true
    }
  ],
  "posts": [
    {
      "id": "string",
      "title": "string",
      "slots": 8,
      "images": ["imageIds"]
    }
  ]
}
```

---

## Development Environment

### Requirements

* Node.js for API route development
* Vercel CLI for local testing + deploy
* Environment variables:

  * `BLOB_READ_WRITE_TOKEN`
  * `AI_API_PASSWORD`
  * `GEMINI_API_KEY`

### Setup

```bash
git clone [repository]
cd projects/pages/dream-series/
# Run locally: open index.html in browser
# Or deploy via Vercel
```

---

## Success Metrics

### Creative

* 80+ images that capture “dream phenomenology”
* Consistent aesthetic across impossible scenarios
* Builds narrative tension over 10 posts

### Technical

* Smooth drag & drop workflow
* Reliable upload/delete with visual feedback
* Sync state always matches server
* Lightweight local cache

### Strategic

* Production-ready CMS for AI art series
* Reusable prompting + curation framework
* Scalable for multiple art projects

