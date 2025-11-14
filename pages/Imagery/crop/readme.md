# crop — lilapps production asset prep tool

A tiny, fast, professional-grade browser tool for turning any image into production-ready assets.

No sign-ups. No ads. No bullshit. Just drop, frame, export.

Born from a real workflow: as marketers, designers, and devs, we constantly pull images from “Location A” (vendor sites, Google, screenshots, internal decks) and need them adapted for “Location B” (website hero, email header, slider, blog card, social thumb, etc.). Firing up heavy design software for these small but frequent tasks is a massive, repeating tax.

`crop` exists to erase that tax.

You are already in the browser. You drag or paste the image. You set or pick the frame. You get exactly the sizes you need. Fast, precise, and pleasant.

This document outlines:
- Current behavior and priorities
- UX and interaction principles
- Vision: evolving from “crop tool” into the world’s best browser-native production asset prep tool
- Future capabilities (artboards, variants, dev/URL integration, etc.)

All while remaining a small, focused, “lilapps”-style product.

---

## Core Principles

1. Instant
   - Loads fast.
   - Drag-and-drop or paste to start.
   - No accounts, no onboarding wall, no clutter.

2. In-browser and trustworthy
   - All processing client-side.
   - No image uploads to a server.
   - No tracking garbage.
   - Safe for work assets and client materials.

3. Single-screen, single-purpose
   - One focused workspace.
   - No multi-page project system.
   - No trying to be Canva, Figma, or Photoshop.

4. Production-minded
   - Targeted at real, recurring jobs:
     - Website heroes, cards, sliders
     - Social posts and thumbnails
     - Email headers and imagery
     - Presentation and doc assets
   - Defaults and presets are practical, not ornamental.

5. Tiny, perfect, extensible
   - Minimal codebase.
   - Carefully chosen features.
   - Everything added must:
     - Reduce friction.
     - Increase reliability.
     - Stay understandable at a glance.

---

## Current Feature Set

These features exist or are in active development based on the current implementation:

- Global drag-and-drop:
  - Drop an image anywhere to start.
  - If an image is already loaded, drop anywhere to replace it.
  - Clear overlay hint: “Drop image to start” / “Drop image to replace.”

- Core cropping:
  - Full-viewport canvas.
  - Draggable crop area.
  - Corner handles and edge handles for resizing.
  - Minimum crop size enforced.
  - Crop constrained to image bounds.

- Aspect ratios:
  - Quick-select buttons:
    - Free
    - 1:1, 4:3, 3:2, 5:4, 16:9, 9:16, 21:9
  - Custom aspect ratio:
    - Inline input (`W:H`) reduced to simplest form.
    - Applies immediately and locks resizing to that ratio.

- Presets:
  - Social presets (examples):
    - Instagram square, portrait, story
    - Facebook posts and covers
    - X / Twitter posts and headers
    - YouTube thumbnails and frames
  - Document/print presets:
    - A4, Letter, etc. at sensible resolutions.
  - Presets apply both:
    - Crop aspect ratio.
    - Suggested export size.

- Export controls:
  - Numeric width/height fields.
  - Export aligned with current crop and/or active preset.
  - Auto-adjust dimensions to maintain locked aspect when relevant.
  - Export via canvas to a downloadable file.
  - Sensible default filenames:
    - Includes reduced aspect, size, timestamp.

- Smart viewport behavior:
  - Image auto-fits into viewport with margins.
  - When crop changes, the image recenters smoothly around the crop (commit animation).
  - ResizeObserver-driven layout updates.

- State handling:
  - Internal modes:
    - Free
    - Aspect-locked
    - Pixel preset
    - Custom pixel
  - Assertions, clamping, and validation throughout for robust behavior.

- Grid overlay:
  - Rule-of-thirds guide rendered inside the crop.
  - Toggleable.

These pieces already form a serious, high-quality cropping experience.

---

## Immediate UX Enhancements (Planned)

All planned enhancements preserve the simplicity of the UI while making the behavior feel “obvious” to non-technical users.

1. Mode simplification (user-facing)
   - Internally keep modes. Externally present:
     - Free
     - Locked ratio (via aspect buttons)
     - Preset size (via dropdowns)
   - Users never need to think in terms of “modes”; they just:
     - Select a ratio → crop locks.
     - Select a preset → frame + export size align.
     - Manually override → gracefully fall back to “Custom” or “Free” as appropriate.

2. Drag-and-drop polish
   - Ensure consistent behavior:
     - Drop anywhere = load (if empty) or replace (if existing).
   - Maintain relative crop where sensible when replacing images.
   - Clear, minimal overlays and hints.

3. Legibility and ergonomics
   - Slightly larger control typography.
   - Larger hit areas on handles and edges.
   - Subtle background refinement (dark, but not harsh) to focus the eye on content.

4. Undo / redo
   - Lightweight history for:
     - Crop changes
     - Aspect/preset changes
     - Export size adjustments
   - Standard shortcuts:
     - Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z.

---

## Vision: From Crop Tool to Production Asset Prep Tool

`crop` is evolving into:

“The world’s best browser-native production asset prep tool for people who ship things online.”

Designed for:
- Marketers who need many formats from one idea.
- Social/content teams creating consistent visuals.
- Web devs and designers enforcing image standards.
- Indie founders and studios preparing launch and campaign assets.

Key: this remains a small, single-purpose lilapp. No bloat. Just a more powerful definition of “prep.”

---

## Strategic Feature Pillars

### 1. Artboard / Frame Mode

The foundational concept for everything else.

- Lock a frame:
  - Choose a preset or custom size → that becomes the fixed output frame (artboard).
- Move image, not frame:
  - Pan, zoom, rotate the underlying image within the locked frame.
- Always export at frame size:
  - Guarantees exact, repeatable dimensions.

Why:
- Matches how real-world placements work (hero slots, ad units, thumbnails).
- Becomes the base for responsive/variant logic.

Status:
- High priority. This becomes the primary interaction model when presets are used.

---

### 2. Variants: Design Once, Export Many (Auto-Variant System)

This is the flagship innovation.

Problem:
- The same visual concept must exist in many sizes:
  - 16:9 cover, 1:1 thumb, 9:16 story, email header, etc.
- Today, that work is repetitive and manual.

Goal:
- Let users define a single master composition and generate multiple size variants with minimal extra work.
- Stay deterministic and understandable (no black-box “AI auto layouts”).

Concept:
- Master layout:
  - User designs one frame (artboard) with:
    - Background image (cropped/positioned).
    - Future: logo, simple text, or extra shapes (when layers arrive).
- Variant frames:
  - User selects a set of target sizes (e.g., “Social pack,” “Ad set”).
  - Each variant:
    - Shares the master composition via simple rules:
      - How backgrounds scale.
      - How focal points align.
      - How overlays pin to corners/edges.
    - Can be gently tweaked per-variant when needed.

Principles:
- Small, predictable rule set:
  - Pinning (e.g., top-left, centered).
  - Scaling:
    - Fixed-size or relative to frame.
  - Optional overrides.
- Visual clarity:
  - Show all variants as a list or small strip.
  - Quick flip between them.
  - “Export all” in one click.

This system:
- Turns `crop` into a serious time-saver for campaigns and launches.
- Stays aligned with the lilapps ethos by using a minimal, carefully designed rule model instead of a heavy layout engine.

---

### 3. High-Confidence Export (Format and Quality Intelligence)

`crop` should quietly “do the right thing” with file formats.

Planned:
- Export formats:
  - PNG
  - JPEG
  - WebP
- Simple quality presets:
  - Crisp (high quality)
  - Balanced (recommended)
  - Tiny (for email/low-bandwidth)
- Intention-based labeling:
  - “Optimized for web”
  - “Optimized for email”
  - “Preserve sharp edges (logos/UI)”
- Under the hood:
  - sRGB normalization.
  - Smart defaults for photos vs. graphics.
  - Respect for transparency when needed.

Outcome:
- Users trust that exports are:
  - The right size.
  - The right format.
  - Reasonably optimized without manual tuning.

---

### 4. Micro Adjustments (Prep-Grade, Not Filter-Grade)

Goal:
- Only adjustments that serve readability and layout.

Planned:
- Subtle, controlled sliders:
  - Brightness
  - Contrast
  - Saturation
  - Optional: blur (e.g., for background plates)
- Designed for:
  - Making text-over-image placements cleaner.
  - Making assets consistent, not “stylized.”

No filter gimmicks. Strictly production utility.

---

### 5. Layers and Simple Compositing (Future)

Acknowledged future direction (not immediate):

- Support multiple images/elements:
  - Background image(s)
  - Logos
  - Decorative shapes or panels
  - Eventually minimal text blocks
- Presented as:
  - A very small, clear layer stack.
- Integrated with:
  - Artboard mode.
  - Variant rules (symbols-style behavior).

This will be tackled cautiously to preserve simplicity.

---

### 6. Text (Back Burner, By Design)

Text is powerful but complex.

Position:
- Will not be rushed.
- When implemented:
  - Minimal, structured:
    - Headline blocks, small labels.
  - Treated as layout elements, not a generic rich text editor.
- Must integrate cleanly with variants and artboards.

Until then:
- Focus is on framing and exporting great backplates and image-led assets.

---

### 7. Dev and URL-Based Control (Tooling for Teams)

`crop` should be delightful for non-technical users and quietly powerful for devs and system thinkers.

Planned capabilities:
- URL-driven presets:
  - Examples:
    - `croptool.app/968x600-MyHero`
    - `croptool.app/1280x720-YouTubeThumb`
  - On load:
    - Preconfigures frame size, labels, and behavior.
- Optional query parameters (introduced carefully):
  - Format (`fmt=jpg`)
  - Quality preset (`q=balanced`)
  - Grid visibility
  - Preset packs (`preset=social-basic`)
  - Variant sets (`variant=all`)
- Local favorites:
  - Save a few custom presets in-browser:
    - Names, sizes, aspect ratios.

Result:
- Teams can:
  - Standardize image prep with shareable links.
  - Embed “Edit in crop” links in docs and repos.
- Power users get an automation surface without affecting normal users.

---

## Non-Goals

To protect the product’s clarity and quality, `crop` is explicitly NOT:

- A full design suite
- A template marketplace
- A collaboration platform
- A complex video editor (video support, if any, will be extremely focused and considered separately)
- A bloated, growth-hacked SaaS product

If a feature does not:
- Make asset prep faster,
- Improve consistency,
- Or increase confidence in the output,

it does not belong.

---

## Summary

`crop` started as “I just want a better way to crop.” It is evolving into:

- A polished, trustworthy, minimal tool for:
  - Framing,
  - Resizing,
  - Lightly adjusting,
  - And intelligently exporting

marketing and product visuals at the speed of real work.

It stays small. It stays sharp. It feels like cheating compared to firing up a full design suite for simple, constant, production tasks.
