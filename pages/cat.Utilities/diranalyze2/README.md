# DirAnalyze2/README.md
# DirAnalyze 2.0

A refactor/progression of **DirAnalyze (dav1)** into **dav2**:
- Keep the core idea: let AI see exact line numbers and return minimal patches.
- Trim complexity: pure-frontend, browser File System Access API.
- Make LNRP (Line-Number Range Patches) the canonical patch format.

## Quick Start
1. Serve this folder over HTTP (modules need http, not file://).
   - Example: `python -m http.server 5173`
2. Open: `http://localhost:5173/frontend/index.html`
3. Click **Open Folder** and select a project directory (or this repo’s `frontend/`).
4. Pick a file to preview with line numbers.
5. Paste an LNRP patch JSON into the **AI Patch** panel and click **Apply Patch**.

## How this progresses from dav1
- **dav1 → dav2**: removed unified-diff parsing and fuzzy matching failures.
- Respect **exact line numbers** the AI *just* saw (copy-with-line-numbers).
- Preserve whitespace exactly; strip accidental `123:` prefixes from AI output.
- Optional guards: naive `context_prefix`/`context_suffix` checks for drift.

## LNRP (Line-Number Range Patches)
Example:
{
  "version": "lnrp-0.1",
  "description": "Example tweak",
  "files": [
    {
      "path": "src/example.txt",
      "patches": [
        { "range": [2,3], "replace": ["new line 2", "new line 3"] }
      ]
    }
  ]
}

- `range` is inclusive, 1-based.
- `replace` is an array of lines written **as-is** (no auto-reindent).
- The patcher strips leading `"  123: "` if the AI echoes line numbers.

## Notes
- Works best in Chromium-based browsers with File System Access API.
- You can extend with: multi-select copy-with-line-numbers, snapshots in IndexedDB, marker-based patching, guard hashing, etc.

License: MIT
