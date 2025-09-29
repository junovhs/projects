# ffmpeg.wasm CDN MVP

This is a single-file demo proving we can load `ffmpeg.wasm` **core** from a CDN and run a trivial transcode fully in the browser.

## What it does
- Loads the **single-thread** core from jsDelivr (no special headers required)
- Converts a tiny WebM to a 2s MP4 (or lets you pick a local file)
- Shows basic logs & progress

## How to deploy (Vercel)
1. Create a new project from this folder.
2. (Optional, only for multi-thread): include `vercel.json` so COOP/COEP headers are set.
3. Visit your deployment and click **1) Load core** → **2) Convert sample**.

## How to deploy (GitHub Pages)
Commit `index.html` to your repo’s root and enable Pages. That’s it for single-thread mode.

## Multithread (optional)
- Switch the base URL in `index.html` from `@ffmpeg/core` to `@ffmpeg/core-mt`.
- Add `workerURL` in `ffmpeg.load(...)` (and keep `coreURL` + `wasmURL`).
- Ensure COOP/COEP headers (the provided `vercel.json` handles that on Vercel).
