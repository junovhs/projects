<!--
AI UPDATE INSTRUCTIONS:
This document tracks the project's roadmap and changelog.
To update this document for the ROADMAP section:
1. Review recent progress against the tasks listed under current and upcoming versions.
2. Mark completed tasks with `[x]`.
3. Add new tasks or adjust priorities based on project decisions (e.g., new issues created, features reprioritized).
4. Update target dates or version focuses if they change.
To update this document for the CHANGELOG section:
1. For each new version released or significant set of features merged:
    - Add a new version heading (e.g., `## [0.2.1] - YYYY-MM-DD`).
    - List notable changes under subheadings like `Added`, `Changed`, `Fixed`, `Removed`, `Security`.
    - Reference relevant issue numbers.
Provide the complete updated Markdown content for this file.
-->

# Roadmap and Changelog

This document outlines the planned development path (Roadmap) for DirAnalyze and a log of notable changes made in each version (Changelog).

## Part 1: Roadmap

### Version 0.1 - UI Prototype (Done - 2025-06-05)
- [x] Browser-based UI for project loading and visualization.
- [x] Live local file editing via the File System Access API.
- [x] AI Debriefing Assistant for context generation.
- [x] AI Patcher with direct local file system writing.
- [x] Removal of obsolete UI components (Combine Mode).

### Version 0.2 - Core Backend Bootstrap (Target Q3 2025)
- [x] CLI `serve` command; proxy to OpenAI, Anthropic, Ollama.
- [x] Deterministic hash log v1 (SQLite schema for versioning: ProjectVersions, VersionFiles, OperationLog).
- [x] Backend API for initial project snapshot (Version 0).
- [ ] Frontend: Calculate file hashes & send initial snapshot data to backend API (Issue #21).
- [ ] Backend: API & Logic for subsequent version snapshots (post-patch) (Issue #22).
- [ ] Tree-sitter parsers: Swift & JS (Issue #20).
- [ ] Sketch index builder + budget walker (Hierarchical Semantic Sketch foundation).
- [ ] TruffleHog gate — hard fail on secret detection before LLM send.

### Version 0.3 - CLI Alpha & Versioning Enhancements (Planned)
- [ ] UI: Display version history timeline (Issue #23).
- [ ] Core: Restore project to a selected version (Issue #24).
- [ ] Backend: Store and use file diffs for versioning optimization (Issue #25).
- [ ] 10-prompt retrieval benchmark vs. naive FTS (for Semantic Sketch evaluation).
- [ ] Config file `~/.config/diranalyze.toml` (stores key, model, budget).
- [ ] GitHub sync script v2 (labels, milestones auto-sync from a config file).

### Version 0.4 - GUI Alpha (Planned)
- [ ] Embedded web-view UI (exploring Tauri, Wails, or similar instead of Electron).
- [ ] "Log" tab with live hash stream (including versioning events, operation log entries).
- [ ] Key storage UI (for LLM API keys, encrypted on disk).

### Version 0.5 - Plugin Runner API (Planned)
- [ ] gRPC runner interface (`Spawn`, `Exec`, `FetchLog`).
- [ ] Example Python runner (system interpreter).
- [ ] Security sandbox spec for runners.

---

### Backlog (Deferred / Research / Extended)
*   **Research (Ongoing):**
    *   `#17 research(security): Implement Cross-Platform Resource Sandboxing`
    *   `#16 research(runner): Explore Remote iOS Simulator Mirroring`
    *   `#15 research(ranking): Develop Holoform Graph Index & Smart Ranker`
*   **Extended (Target: Q2 2026+ or later):**
    *   `#14 research(runner): Investigate Embeddable CPython for Python Runner`
    *   `#13 feat(plugin): Implement Experimental Screen Capture Plugin`
    *   `#12 feat(runner): Implement iOS Device Runner (Sideload & Syslog)`
*   **General Backlog:**
    *   Additional Tree-sitter grammars (Python, Zig, C/C++, TypeScript)
    *   Runner: Remote SSH attach
    *   Patch-generation constraints (tests & secret safety)
    *   IDE integration (LSP or VS Code plugin)
    *   Offline LLM support via Ollama / LM Studio integration beyond basic proxy
    *   Search metrics dashboard (token usage, retrieval hit-rate)

Open an issue with the **help-wanted** label to propose or adopt a task.

---

## Part 2: Changelog

*(This section will be populated as versions are released or significant features are completed.)*

### Unreleased

*   **Added:** Foundational backend infrastructure for project versioning:
    *   SQLite database schema for `ProjectVersions`, `VersionFiles`, `OperationLog`.
    *   Backend API endpoint (`/api/snapshot/initial`) to create an initial "Version 0" snapshot of a project, storing file paths, content hashes, and sizes.
*   **Changed:** Updated documentation structure for better organization and comprehensiveness.
*   **Changed:** Updated GitHub issue management process and created detailed issues for versioning feature development.

<!--
Template for new releases:

## [X.Y.Z] - YYYY-MM-DD
### Added
- New feature A.
- New feature B.
### Changed
- Update to existing feature C.
- Refactoring of module D.
### Fixed
- Bug E in component F (Closes #issue_number).
- Typo in documentation.
### Removed
- Deprecated feature G.
### Security
- Addressed vulnerability H.
-->