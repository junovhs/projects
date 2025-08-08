# DirAnalyze

*The tiny, local-first AI cockpit for huge codebases.*

- **Single binary (planned)** – no Docker, no Node, no Python runtime
- **Paste-and-go (planned)** – drop a repo, paste your LLM key, start coding
- **Hierarchical Semantic Sketch (planned)** – budget-bounded tree of package → file → symbol summaries; ships only what the model needs.
- **Hard secret gate (planned)** – TruffleHog scan; refuses to leak keys or tokens.
- **Deterministic hash log & Versioning (in progress)** – Every file state, prompt, and diff can be recorded for audit, replay, and version control. Initial project snapshotting (Version 0) API and database schema are functional.
- **MIT licence** – fork it, remix it, just keep the header.

> **Security advisory:** DirAnalyze is **not sandboxed**. You are editing your local file system directly. Run trusted code only.
> **Status:** Alpha. Core UI workflow for project analysis, AI debriefing, and AI patching is functional. Rust backend provides serving, LLM proxy, and foundational versioning capabilities.

---

## 1. Vision & Goals

DirAnalyze aims to be an indispensable, lightweight, and trustworthy companion for developers leveraging AI. It solves common pain points like IDE bloat, inefficient LLM context preparation, and the "black box" nature of AI changes by offering a local-first, deterministic, and transparent tool.

For a detailed understanding of the project's vision, target users, and key use cases, please see:
*   **[`docs/01_PROJECT_OVERVIEW_AND_GOALS.md`](./docs/01_PROJECT_OVERVIEW_AND_GOALS.md)**

## 2. Current State (Notable Features - As of 2025-06-08)

| Component                      | State                | Notes                                                      |
|--------------------------------|----------------------|------------------------------------------------------------|
| Backend (Rust)                 | **In Progress**      | Serves UI, proxies LLM calls. Initial version snapshot API (SQLite based) is functional. |
| Browser UI (HTML/JS/CSS)       | **Functional**       | Project loading, tree view, stats, text reports, file editing (via File System Access API). |
| AI Debriefing Assistant        | **Functional**       | Packages project context for LLMs.                           |
| AI Patcher Workflow            | **Functional**       | Applies AI-generated CAPCA patches to local files with review. |
| Versioning System Foundation   | **In Progress**      | SQLite schema and backend API for initial project snapshots are complete. Further development ongoing. |
| Hierarchical Semantic Sketch   | Spec Drafted         | Core logic for intelligent context minimization is planned.    |

## 3. Quick Start

1.  Clone the repository.
2.  Install the [Rust toolchain](https://rustup.rs/).
3.  **(Windows)** Install [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
4.  Navigate to the `backend` directory: `cd backend`
5.  Run the backend server: `cargo run`
6.  Open `http://127.0.0.1:8000` in a modern browser (Chrome, Edge recommended).
7.  Drop your project folder onto the UI and grant read/write permissions.

For more detailed setup, see [`docs/04_DEVELOPMENT_AND_CONTRIBUTING.md`](./docs/04_DEVELOPMENT_AND_CONTRIBUTING.md).

## 4. Documentation Suite

DirAnalyze maintains a comprehensive set of documentation in the `/docs` folder:

*   **[`01_PROJECT_OVERVIEW_AND_GOALS.md`](./docs/01_PROJECT_OVERVIEW_AND_GOALS.md):** Core vision, principles, target users, and key use cases.
*   **[`02_ARCHITECTURE_OVERVIEW.md`](./docs/02_ARCHITECTURE_OVERVIEW.md):** High-level technical architecture.
*   **[`03_VERSIONING_SYSTEM_ARCHITECTURE.md`](./docs/03_VERSIONING_SYSTEM_ARCHITECTURE.md):** Deep dive into the versioning system.
*   **[`04_DEVELOPMENT_AND_CONTRIBUTING.md`](./docs/04_DEVELOPMENT_AND_CONTRIBUTING.md):** Guide for setting up, developing, and contributing (includes Git conventions).
*   **[`05_ROADMAP_AND_CHANGELOG.md`](./docs/05_ROADMAP_AND_CHANGELOG.md):** Project roadmap and version history.
*   **[`06_GITHUB_ISSUE_MANAGEMENT.md`](./docs/06_GITHUB_ISSUE_MANAGEMENT.md):** Protocol for using GitHub Issues.

## 5. Design Principles

DirAnalyze adheres to several core principles:
1.  **Own the Stack**
2.  **Deterministic First**
3.  **Machine-First Interface (for AI)**
4.  **Small Surface First**
5.  **Offline by Default**
6.  **Local-First & User Control**
7.  **Transparency & Auditability**

(Elaborated in `docs/01_PROJECT_OVERVIEW_AND_GOALS.md`)

## 6. Planned Core Architecture

```text
Browser UI ─── HTTP/WebSocket ───┐
                                  │
                                  ▼
            DirAnalyze Backend Binary (Rust)
           (HTTP Server, LLM Proxy, Indexing,
            Logging, Versioning Database,
            Planned Runner Coordination)
                                  │
                                  ▲
    External LLM HTTPS Endpoint   │ Optional External Runners
```

(More details in `docs/02_ARCHITECTURE_OVERVIEW.md`)

## 7. Limitations

*   Not an IDE – no IntelliSense or advanced refactoring tools yet.
*   Security isolation is research-phase; run only trusted code with direct file system access.

## 8. Contributing

We welcome contributions! Please see [`docs/04_DEVELOPMENT_AND_CONTRIBUTING.md`](./docs/04_DEVELOPMENT_AND_CONTRIBUTING.md) for details on our workflow and Git conventions. Check for issues tagged `good first issue` or `help wanted`.

## 9. License

MIT. Third-party tools retain their original licences.