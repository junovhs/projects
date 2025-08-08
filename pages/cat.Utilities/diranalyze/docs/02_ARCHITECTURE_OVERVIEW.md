<!--
AI UPDATE INSTRUCTIONS:
This document provides a high-level overview of DirAnalyze's technical architecture.
To update this document:
1. If the main architecture diagram changes (e.g., adding a major new component like a dedicated runner service), update the diagram (represented as text/code block here) and its textual explanation.
2. If significant changes occur in the backend (Rust) or frontend (JS) that alter their core responsibilities or interaction patterns at a high level, summarize these changes.
3. Ensure links to more detailed architecture documents (like for the Versioning System) are current.
4. If new major architectural components are planned (e.g., Semantic Sketch, Plugin API), add brief introductory sections for them, noting their planned status.
Provide the complete updated Markdown content for this file.
-->

# DirAnalyze: Technical Architecture Overview

DirAnalyze is designed as a local-first application with a clear separation between its frontend user interface and a backend service. The backend handles core logic, proxies interactions with the file system (via the browser for the web version), and manages communication with external AI models.

## 1. High-Level Components

The planned architecture involves the following major pieces:

```text
Browser UI (HTML/JS/CSS) ─── HTTP/WebSocket ───┐
                                                │
                                                ▼
                          DirAnalyze Backend Binary (Rust)
                         (HTTP Server, LLM Proxy, Indexing,
                          Logging, Versioning Database,
                          Planned Runner Coordination)
                                                │
                                                ▲
                  External LLM HTTPS Endpoint   │ Optional External Runners
                  (e.g., OpenAI, Anthropic,     │ (e.g., tree-sitter CLI,
                   Ollama)                      │  compilers via gRPC - planned)
```

*Diagram represents the target design; some components like dedicated runners and full indexing are planned. The Versioning Database component is currently in progress.*

**Key Interactions:**

*   **Browser UI to Backend:**
    *   The backend serves static assets (HTML, JS, CSS) for the frontend.
    *   It handles API requests from the frontend via HTTP (e.g., proxying LLM calls, creating version snapshots).
    *   WebSockets are used for potential real-time updates (currently basic echo functionality is implemented).
*   **Backend to External LLM:**
    *   The backend acts as a proxy, forwarding user-constructed prompts to configured LLM API endpoints over HTTPS. This allows for secure handling of API keys on the backend.
*   **Backend to Local Resources:**
    *   **File System Interaction:** For the current web-based UI, all direct file system access (reading project structures, reading file content, writing changes) is performed by the frontend JavaScript using the browser's File System Access API. The backend is informed of these structures (e.g., for versioning) but does not directly access the user's file system in this mode.
    *   **SQLite Database:** The backend manages a local SQLite database (`.diranalyze_db.sqlite3`) for:
        *   The Deterministic Versioning System (see `03_VERSIONING_SYSTEM_ARCHITECTURE.md`).
        *   Operational logging.
        *   (Planned) Storing the Hierarchical Semantic Sketch index.
*   **Backend to Optional External Runners (Planned):**
    *   A future enhancement involves the backend coordinating with external command-line tools or services (e.g., Tree-sitter CLI for advanced parsing, compilers, linters). This communication is envisioned to occur via a gRPC interface.

## 2. Frontend (Browser UI)

*   **Technology:** Standard HTML, CSS, and modern JavaScript (utilizing ES Modules).
*   **Core Responsibilities:**
    *   Rendering the entire user interface and managing user interactions.
    *   Loading projects using the File System Access API (directory picker, drag-and-drop functionality).
    *   Displaying the directory tree structure, file statistics, and generated text reports.
    *   Providing in-browser file editing capabilities using the CodeMirror library.
    *   Managing local application state (e.g., `appState` object in `main.js`).
    *   Constructing and sending requests to the backend API (e.g., for the AI Debriefing Assistant package, LLM proxy calls, initial project snapshot for versioning).
    *   Implementing the AI Patcher workflow: parsing CAPCA JSON, displaying diffs of proposed changes, and using the File System Access API to apply accepted patches to local files.
    *   (Planned) UI for displaying version history and initiating restore operations.
*   **Key Browser APIs Leveraged:**
    *   **File System Access API:** Crucial for all local file and directory operations (reading structure, file content, writing changes).
    *   **Fetch API:** For all HTTP-based communication with the backend.
    *   **WebSockets:** For real-time communication channels with the backend.
    *   **Web Crypto API (`crypto.subtle`):** (Planned) For client-side calculation of file hashes (e.g., SHA-256) to be sent to the backend for versioning.
*   **Third-Party Libraries:**
    *   **CodeMirror:** Powers the in-browser file editor.
    *   **JSZip:** Used for the "Download Project as ZIP" functionality.
    *   **diff-match-patch:** Used by the AI Patcher to generate and display differences between current file content and AI-proposed changes.

The frontend is designed to be the primary interface for file system interactions in the current web-based deployment model, ensuring user control and leveraging browser security features.

## 3. Backend (Rust Binary)

*   **Technology:** Rust, utilizing the Axum web framework, Tokio for asynchronous operations, Reqwest as an HTTP client, and Rusqlite for SQLite database interactions.
*   **Core Responsibilities:**
    *   Serving the static frontend assets (HTML, CSS, JavaScript files).
    *   Providing an HTTP API for various functionalities required by the frontend.
    *   Proxying requests to external Large Language Model (LLM) APIs, which includes securely managing and injecting API keys.
    *   Managing the local SQLite database for:
        *   The Versioning System (as detailed in `03_VERSIONING_SYSTEM_ARCHITECTURE.md`).
        *   General operational logging (`OperationLog` table).
        *   (Planned) Storage for the Hierarchical Semantic Sketch index data.
    *   (Planned) Coordination of external runner processes for tasks such as advanced code parsing (e.g., using Tree-sitter CLI).
    *   Handling WebSocket connections and messages.
*   **Key Crates Used:**
    *   `axum`: For building the web server and API routes.
    *   `tokio`: The asynchronous runtime environment.
    *   `reqwest`: For making outbound HTTP requests to LLM APIs.
    *   `rusqlite`: For all interactions with the SQLite database.
    *   `serde` (with `serde_json`): For serialization and deserialization of JSON data in API requests/responses.
    *   `dotenvy`: For loading environment variables (like API keys) from a `.env` file.
    *   `tower-http`: For common HTTP middleware and utilities (e.g., serving static files).

The backend aims to be lightweight and efficient, handling core logic that is not suitable for the browser environment or requires server-side state/configuration.

## 4. Data Persistence and State

*   **User's Local File System:** This is the primary source of truth for the project code being analyzed and modified. All file operations initiated by the user or through AI patches directly affect these local files (mediated by the File System Access API in the browser).
*   **Local SQLite Database (`.diranalyze_db.sqlite3`):**
    *   Located in the backend's execution directory.
    *   Stores structured metadata: `ProjectVersions`, `VersionFiles` for the versioning system, and the `OperationLog`.
    *   (Planned) Will store the index for the Hierarchical Semantic Sketch.
    *   (Planned) Will store `FileDiffs` for efficient versioning.
*   **Browser `localStorage`:** Used sparingly for minor UI preferences, such as the remembered width of the sidebar.
*   **Backend Configuration (`.env` file):** Currently used for storing the `OPENAI_API_KEY`.
*   **(Planned) User Configuration File (`~/.config/diranalyze.toml`):** For more extensive user-specific settings, including preferred LLM endpoints, API keys (potentially encrypted), model choices, and default token budgets.

## 5. Key Planned Architectural Enhancements

*   **Hierarchical Semantic Sketch:** A sophisticated system for creating token-efficient, structured summaries of codebases. This will involve integrating Tree-sitter for accurate parsing and developing custom logic for indexing and contextual retrieval. (See related issue #20).
*   **Plugin Runner API:** A gRPC-based interface designed to allow DirAnalyze to delegate specific tasks (like linting, compiling, running tests, or custom analysis) to external tools or custom-built "runners." This promotes extensibility. (See related issue #8, though this was closed and might be superseded by newer planning).
*   **Full Versioning System UI & Logic:** Expanding on the current backend foundation to include:
    *   Frontend UI for viewing version history.
    *   Backend and frontend logic for restoring project states.
    *   Storing and applying diffs for space-efficient versioning. (See issues #22, #23, #24, #25).
*   **Enhanced Deterministic Logging:** Continuously improving the `OperationLog` to capture a wider range of critical events with sufficient detail for comprehensive auditing and potential future replay capabilities. (See issue #7).

This overview provides a snapshot of the DirAnalyze architecture. Specific systems, like the Versioning System, have more detailed dedicated documentation.