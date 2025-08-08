<!--
AI UPDATE INSTRUCTIONS:
This document is the primary guide for developers contributing to DirAnalyze.
To update this document:
1. If the development setup process changes (e.g., new dependencies, build commands), update the "Development Setup" section.
2. If Git conventions are modified, update the "Git Conventions" section.
3. Add new common debugging tips or troubleshooting steps to the "Debugging Guide" section as they are discovered.
4. Update contribution guidelines (forking, branching, PRs) if the process evolves.
5. If new tools for linting, testing, or building are introduced, document their usage.
Provide the complete updated Markdown content for this file.
-->

# Development and Contributing Guide for DirAnalyze

Thank you for your interest in contributing to DirAnalyze! This guide provides information on setting up your development environment, our coding and Git conventions, and how to contribute effectively.

## 1. Getting Started: Development Setup

### 1.1. Prerequisites

*   **Git:** For version control.
*   **Rust Toolchain:** For building the backend. Install from [https://rustup.rs/](https://rustup.rs/). This will provide `rustc` (the compiler) and `cargo` (the package manager and build tool).
*   **(Windows Specific) Visual Studio C++ Build Tools:** Required for some Rust dependencies, particularly if they involve native code or linking. Install via the Visual Studio Installer (select "Desktop development with C++" workload, and ensure the MSVC build tools and Windows SDK are included).
*   **`gh` CLI (Recommended):** For interacting with GitHub issues, PRs, etc., from the command line. Install from [https://cli.github.com/](https://cli.github.com/).
*   **Node.js and npm/yarn (Optional, for advanced frontend work):** Currently, the frontend JavaScript is written as vanilla ES Modules and does not require a separate build step. However, if linters, formatters (like Prettier for JS/CSS), or a bundler are introduced for the frontend in the future, Node.js would be needed.
*   **Text Editor/IDE:** Any modern text editor or IDE with good Rust and JavaScript support (e.g., VS Code with the `rust-analyzer` extension).

### 1.2. Cloning the Repository
```bash
git clone https://github.com/junovhs/diranalyze.git # Replace with your fork if contributing via PR
cd diranalyze
```

### 1.3. Backend Development

The backend is a Rust application located in the `/backend` directory.

*   **Building:**
    ```bash
    cd backend
    cargo build
    ```
*   **Running (for development):**
    ```bash
    cd backend
    cargo run
    ```
    This will start the backend server, typically on `http://127.0.0.1:8000`. The server serves the frontend static files from the project root and provides the API.
*   **Testing (Planned):** Unit and integration tests for Rust will be added. Run with `cargo test`.
*   **Formatting:** Use `rustfmt` (usually installed with `rustup`) to format Rust code.
    ```bash
    cd backend
    cargo fmt
    ```
*   **Linting:** Use `clippy` (usually installed with `rustup`) for Rust linting.
    ```bash
    cd backend
    cargo clippy
    ```

### 1.4. Frontend Development

The frontend consists of HTML, CSS, and JavaScript files located primarily in the project root (`index.html`), `/css`, and `/js` directories.

*   **No Build Step (Currently):** The JavaScript uses ES Modules and is served directly by the backend.
*   **Running:** Simply run the backend server (`cargo run` in the `/backend` directory) and open `http://127.0.0.1:8000` in a modern web browser (Chrome or Edge recommended for File System Access API support).
*   **Debugging:** Use your browser's developer tools (typically F12) for JavaScript debugging, console output, and inspecting HTML/CSS.
*   **Formatting/Linting (Manual/Planned):**
    *   Manually ensure consistent code style.
    *   (Planned) Prettier or ESLint might be introduced for automated JS formatting/linting.

## 2. Contribution Workflow

1.  **Find/Create an Issue:** Look for existing issues on GitHub that you'd like to work on, or create a new one if you're proposing a new feature or bug fix. Discuss your intended approach if it's a significant change.
2.  **Fork the Repository (if you're an external contributor):** Create your own fork of `junovhs/diranalyze` on GitHub.
3.  **Clone Your Fork:**
    ```bash
    git clone git@github.com:YOUR_USERNAME/diranalyze.git
    cd diranalyze
    ```
4.  **Add Upstream Remote (Recommended):**
    ```bash
    git remote add upstream https://github.com/junovhs/diranalyze.git
    ```
5.  **Create a Branch:** Create a new branch from `main` for your feature or fix, following the naming conventions in Section 3 (Git Conventions).
    ```bash
    git fetch upstream # Ensure your main is up-to-date with upstream/main first
    git checkout main
    git rebase upstream/main
    git checkout -b feat/my-new-feature # or fix/issue-123-bug-fix
    ```
6.  **Make Your Changes:** Write your code, add tests (if applicable), and update documentation as needed.
7.  **Commit Your Changes:** Follow the commit message conventions (see Section 3). Commit frequently with small, logical changes.
8.  **Test Thoroughly:** Ensure your changes work as expected and don't break existing functionality.
9.  **Push to Your Fork:**
    ```bash
    git push origin feat/my-new-feature
    ```
10. **Open a Pull Request (PR):**
    *   Go to your fork on GitHub and click the "New pull request" button.
    *   Ensure the base repository is `junovhs/diranalyze` and base branch is `main`.
    *   Ensure the head repository is your fork and head branch is your feature/fix branch.
    *   Write a clear PR title and description, summarizing your changes and linking to the relevant issue(s) (e.g., "Closes #123").
    *   Submit the PR.
11. **Code Review:** Await feedback and address any requested changes.
12. **Merge:** Once approved, your PR will be merged into the main codebase.

## 3. Git Conventions

This section outlines the Git conventions used for the DirAnalyze project. Adhering to these conventions helps maintain a clean, understandable, and manageable commit history, and facilitates collaboration.

### 3.1. Commit Messages

We follow the **Conventional Commits** specification (v1.0.0). This makes commit history more readable and allows for easier automation of changelogs and versioning.

**Format:**
```text
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

**`<type>`:** Must be one of the following:
*   **feat:** A new feature (user-facing).
*   **fix:** A bug fix (user-facing).
*   **docs:** Documentation only changes.
*   **style:** Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.).
*   **refactor:** A code change that neither fixes a bug nor adds a feature.
*   **perf:** A code change that improves performance.
*   **test:** Adding missing tests or correcting existing tests.
*   **build:** Changes that affect the build system or external dependencies (example scopes: Cargo, npm, packaging).
*   **ci:** Changes to our CI configuration files and scripts.
*   **chore:** Other changes that don't modify `src` or `test` files (e.g., updating `.gitignore`).

**`<scope>` (optional):**
A noun describing the section of the codebase affected.
Examples: `parser`, `ui`, `treeView`, `aiPatcher`, `deps`, `readme`, `backend`, `frontend`, `versioning`.

**`<subject>`:**
*   Use the imperative, present tense: "add" not "added" nor "adds".
*   Don't capitalize the first letter (unless it's a proper noun/acronym).
*   No dot (`.`) at the end.
*   Keep it concise (ideally under 50 characters, max 72).
*   **Example for AI:** If the AI is asked to "fix the drop zone to accept folders", a good subject might be "fix(dropZone): allow folder drops via input".

**`<body>` (optional):**
*   Use the imperative, present tense.
*   Include motivation for the change and contrast this with previous behavior.
*   Explain *what* and *why* vs. *how*. Use a blank line between the subject and the body.

**`<footer>` (optional):**
*   **Breaking Changes:** Start with `BREAKING CHANGE:` (or `BREAKING-CHANGE:`) followed by a description of the change, justification, and migration notes.
*   **Issue Linking:** Reference issues that this commit closes (e.g., `Closes #123`, `Fixes #456`).

**Examples:**
```text
feat(lang): add polish language
```
```text
fix(css): correct styles for left sidebar resizer

The resizer was previously overlapping content. This commit adjusts
its z-index and ensures proper flex behavior in the app container.
Closes #42
```
```text
refactor(fileSystem): simplify processDirectoryEntryRecursive logic

BREAKING CHANGE: The `parentAggregator` parameter is now mandatory
and expects a different structure. See docs for migration.
```

### 3.2. Branching Strategy

We use a simple feature branch workflow based on `main`:

*   **`main`:** This is the primary branch representing the latest stable release or active development state. Direct commits to `main` are highly discouraged. All changes should come through Pull Requests.
*   **Feature Branches:** Create a new branch from `main` for each new feature or significant change.
    *   Naming: `feat/<descriptive-name>` (e.g., `feat/sidebar-resizer`, `feat/version-timeline-ui`)
*   **Fix Branches:** Create a new branch from `main` for bug fixes.
    *   Naming: `fix/<issue-number-or-description>` (e.g., `fix/123-commit-button-disabled`, `fix/css-overflow-mainview`)
*   **Chore/Docs Branches:** For non-code changes if they are substantial.
    *   Naming: `chore/<description>` or `docs/<area>` (e.g., `docs/update-contributing-guide`)

After work is complete on a branch, open a Pull Request to merge it into `main`. Rebase your branch on the latest `main` before submitting a PR if `main` has moved on.

### 3.3. Pull Requests (PRs)

*   All changes to `main` **must** be made through PRs.
*   PR titles should be clear and ideally follow Conventional Commit subject lines (e.g., `feat(aiPatcher): Implement patch review modal`).
*   PR descriptions should summarize the changes, explain the rationale ("why this change?"), and link to any relevant issues.
*   Ensure code is reasonably tested locally before opening a PR.
*   (For teams) Seek code review. (For solo) Do a self-review before merging.

### 3.4. General Principles for Commits & Branches

*   **Commit Often:** Make small, atomic commits that represent a single logical change.
*   **Test Before Committing:** Don't commit broken code to shared branches. Run relevant tests.
*   **Keep `main` Deployable:** The `main` branch should always be in a state that could (in theory) be released.

## 4. Debugging Guide (Initial)

### 4.1. Backend (Rust)
*   **Logging:** Use `println!` or `eprintln!` for quick debugging. For more structured logging, the `log` crate with an appropriate logger (like `env_logger`) might be integrated later.
*   **Cargo Check/Build:** `cargo check` is faster than `cargo build` for catching compile errors.
*   **Clippy:** `cargo clippy` provides excellent linting and suggestions.
*   **Debugger:** Use a debugger like GDB or LLDB, or IDE-integrated debuggers (e.g., in VS Code with `rust-analyzer`).
*   **Database Inspection:** Use `sqlite3.exe` (or a GUI tool like DB Browser for SQLite) to inspect the `.diranalyze_db.sqlite3` file in the `backend` directory to verify data persistence.

### 4.2. Frontend (JavaScript)
*   **Browser Developer Tools (F12):**
    *   **Console:** Check for errors, log messages (`console.log`, `console.error`).
    *   **Debugger/Sources:** Set breakpoints, step through code.
    *   **Network:** Inspect API calls to the backend and their responses.
    *   **Elements:** Inspect HTML structure and CSS.
    *   **Application:** Inspect `localStorage`, `sessionStorage`.
*   **`debugger;` statement:** Insert this in your JS code to trigger the browser's debugger.
*   **Alerts:** `alert()` can be used for quick "print debugging" in the browser, but `console.log` is generally better.

## 5. Keeping Documentation and Metadata Updated

*   When adding features or making significant changes, update relevant documentation in the `/docs` folder.
*   After making changes to GitHub issues or milestones (either via the UI or `gh` CLI), run `./update_github_meta.sh` in the project root to synchronize the local `.github_meta/` files. Commit these updated metadata files.

By following these guidelines, we can maintain a healthy and productive development environment for DirAnalyze.