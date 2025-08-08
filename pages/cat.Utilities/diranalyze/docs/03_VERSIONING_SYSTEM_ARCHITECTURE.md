<!--
AI UPDATE INSTRUCTIONS:
This document details the architecture of the DirAnalyze Versioning System.
To update this document:
1. If the SQLite schema for `ProjectVersions`, `VersionFiles`, `OperationLog`, or `FileDiffs` (planned) changes, update the schema definitions and explanations. Ensure SQL `CREATE TABLE` statements are accurate.
2. If API endpoints related to versioning (e.g., creating snapshots, listing versions, restoring versions) are added, modified, or removed, update their specifications (path, method, request/response bodies).
3. If the logic for creating snapshots (initial, post-patch) or restoring versions changes significantly, update the data flow descriptions.
4. If decisions are made about diffing strategies or storage of historical file content, document them here.
5. As frontend UI for versioning is developed, add screenshots or descriptions of the user workflow.
Provide the complete updated Markdown content for this file.
-->

# Versioning System Architecture

The DirAnalyze Versioning System is a core component designed to provide a safety net and audit trail for project modifications, especially those assisted by AI. It allows users to snapshot their project at various stages and potentially restore to previous states. This aligns with the "Deterministic First" design principle.

## 1. Goals

*   **Track Project States:** Capture the state of all project files at significant moments (e.g., initial load, after applying a set of AI patches).
*   **Enable Restore:** Allow users to revert their local working directory to a previously saved version.
*   **Audit Trail:** Provide a history of changes and snapshots, integrated with the broader `OperationLog`.
*   **Efficiency:** Aim for reasonable storage efficiency, likely by storing full initial states and subsequent diffs rather than full copies for every version.

## 2. Core Components

*   **SQLite Database:** A local SQLite database (`.diranalyze_db.sqlite3` within the backend's working directory) stores all versioning metadata.
*   **Backend API (Rust/Axum):** Endpoints for creating snapshots, listing versions, and (planned) restoring versions.
*   **Frontend UI (JavaScript):** (Planned) A timeline or list view to display versions and trigger restore operations.
*   **File Hashing:** SHA-256 is used to identify unique file contents.

## 3. Database Schema

The versioning system relies on the following SQLite tables:

### 3.1. `ProjectVersions`

Stores metadata for each distinct project snapshot.

```sql
CREATE TABLE IF NOT EXISTS ProjectVersions (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_version_id INTEGER,           -- NULL for initial version (v0), references ProjectVersions(version_id) for subsequent versions
    timestamp TEXT NOT NULL,             -- ISO 8601 format (YYYY-MM-DDTHH:MM:SS.SSSZ)
    description TEXT,                    -- e.g., "Initial load", "Applied patch: Fix login bug", "Restored from v2"
    CONSTRAINT fk_parent_version
        FOREIGN KEY (parent_version_id)
        REFERENCES ProjectVersions (version_id)
        ON DELETE CASCADE
);
```

*   `version_id`: Unique identifier for the snapshot.
*   `parent_version_id`: Links to the preceding version, forming a history chain. The first version has a `NULL` parent.
*   `timestamp`: When the version was created.
*   `description`: A human-readable summary of what this version represents.

### 3.2. `VersionFiles`

Records the state (specifically, the content hash and size) of every file that exists within a particular project version.

```sql
CREATE TABLE IF NOT EXISTS VersionFiles (
    version_file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_version_id INTEGER NOT NULL, -- Foreign key to ProjectVersions(version_id)
    file_path TEXT NOT NULL,             -- Relative path within the project (e.g., "MyProject/src/main.js")
    content_hash TEXT NOT NULL,          -- SHA-256 hash of the file content at this version
    file_size INTEGER NOT NULL,          -- Original size of the file at this version
    CONSTRAINT fk_project_version
        FOREIGN KEY (project_version_id)
        REFERENCES ProjectVersions (version_id)
        ON DELETE CASCADE,
    UNIQUE (project_version_id, file_path) -- Ensures one entry per file per project version
);
```

*   For a given `project_version_id`, this table lists all files and their content identifiers.
*   To reconstruct a version, one would need to retrieve all files associated with that `project_version_id` and then find their actual content (see Section 5: Content Storage & Retrieval).

### 3.3. `OperationLog`

A more general log for various backend operations. Version creation events are also logged here.

```sql
CREATE TABLE IF NOT EXISTS OperationLog (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    linked_project_version_id INTEGER, -- Optional: Links an operation to a specific ProjectVersion snapshot
    timestamp TEXT NOT NULL,
    operation_type TEXT NOT NULL,       -- e.g., 'PROJECT_SNAPSHOT_INITIAL', 'PROJECT_SNAPSHOT_PATCH', 'API_CALL_LLM_PROXY'
    target_entity TEXT,                 -- e.g., project name, file path, API endpoint
    content_hash_before TEXT,           -- SHA-256 of content before op (if applicable)
    content_hash_after TEXT,            -- SHA-256 of content after op (if applicable)
    details_json TEXT                   -- JSON blob for additional info (e.g., patch instructions, file list for snapshot)
);
```

*   `linked_project_version_id`: Connects specific log entries (like a snapshot creation event) to an entry in `ProjectVersions`.

### 3.4. `FileDiffs` (Planned)

This table is planned for storing diffs between versions of a file to save space.

```sql
-- PLANNED TABLE --
CREATE TABLE IF NOT EXISTS FileDiffs (
    diff_id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_project_version_id INTEGER NOT NULL, -- The version this diff helps create
    file_path TEXT NOT NULL,
    diff_content TEXT NOT NULL,                 -- The actual diff (e.g., unified diff format)
    source_content_hash TEXT,                   -- Hash of the file *before* this diff was applied (for validation)
    target_content_hash TEXT NOT NULL,          -- Hash of the file *after* this diff is applied
    CONSTRAINT fk_target_project_version
        FOREIGN KEY (target_project_version_id)
        REFERENCES ProjectVersions (version_id)
        ON DELETE CASCADE
);
```

## 4. Data Flow & API Endpoints

### 4.1. Initial Project Snapshot (Version 0) - Implemented

1.  **Frontend Trigger:** After a project is loaded and scanned for the first time using the File System Access API.
2.  **Frontend Action:**
    *   Iterates through all scanned files (`appState.fullScanData.allFilesList`).
    *   For each file: reads content, calculates SHA-256 hash.
    *   Compiles a JSON payload:
```json
{
  "project_root_name": "MyProject",
  "files": [
    { "path": "MyProject/file1.txt", "hash": "hash1", "size": 100 },
    { "path": "MyProject/src/file2.js", "hash": "hash2", "size": 200 }
  ]
}
```
3.  **Backend API Endpoint:** `POST /api/snapshot/initial`
    *   **Request Body:** The JSON payload described above.
    *   **Action (Rust `version_control::create_initial_project_snapshot` function):**
        1.  Starts a database transaction.
        2.  Inserts a new row into `ProjectVersions` with `parent_version_id = NULL` and a description like "Initial snapshot of project: [project_root_name]". Gets the new `version_id`.
        3.  For each file in the `files` array of the request:
            *   Inserts a row into `VersionFiles` with the `version_id`, `file_path`, `content_hash`, and `file_size`.
        4.  Inserts a row into `OperationLog` detailing the snapshot creation.
        5.  Commits the transaction.
    *   **Response:**
```json
{
  "message": "Initial snapshot created successfully",
  "version_id": 1 
}
```

### 4.2. Subsequent Snapshots (e.g., Post-Patch) - Planned

1.  **Trigger:** After a set of AI patches have been successfully applied and saved to disk.
2.  **Frontend/Backend Action:**
    *   Determine the `parent_version_id` (the current latest version).
    *   Scan the project (or affected files) to get new content hashes and sizes.
    *   (Planned) For changed files, calculate diffs against their state in the `parent_version_id`.
3.  **Backend API Endpoint (Proposed):** `POST /api/snapshot/create`
    *   **Request Body (Example):**
```json
{
  "parent_version_id": 1,
  "description": "Applied login bug fix patch #123",
  "files": [ 
    { "path": "MyProject/file1.txt", "hash": "hash1_new", "size": 110 }, 
    { "path": "MyProject/src/file2.js", "hash": "hash2", "size": 200 }  
  ],
  "diffs": [ 
    { "file_path": "MyProject/file1.txt", "diff_content": "...", "source_hash": "hash1", "target_hash": "hash1_new"}
  ]
}
```
    *   **Action:** Similar to initial snapshot, but sets `parent_version_id` and potentially populates `FileDiffs`.

### 4.3. Listing Versions - Planned

1.  **Backend API Endpoint (Proposed):** `GET /api/versions`
    *   **Action:** Queries `ProjectVersions` table, orders by timestamp or ID.
    *   **Response (Example):**
```json
[
  { "version_id": 1, "parent_version_id": null, "timestamp": "...", "description": "Initial load" },
  { "version_id": 2, "parent_version_id": 1, "timestamp": "...", "description": "Applied patch X" }
]
```

### 4.4. Restoring a Version - Planned

1.  **Frontend Trigger:** User selects a version from the timeline and clicks "Restore."
2.  **Backend API Endpoint (Proposed):** `POST /api/versions/{version_id}/restore`
    *   **Action:**
        1.  Identify all files and their target `content_hash` for the requested `version_id` from `VersionFiles`.
        2.  For each file: Reconstruct Content (likely by applying diffs from Version 0 or closest full snapshot).
        3.  Backend sends the full reconstructed content of each file to the frontend.
    *   **Response (Example):**
```json
{
  "status": "success",
  "version_id_restored": 2,
  "files_to_write": [
    { "path": "MyProject/file1.txt", "content": "..." },
    { "path": "MyProject/src/file2.js", "content": "..." }
  ]
}
```
3.  **Frontend Action:**
    *   Receives the list of files and their full content.
    *   Uses the File System Access API to write each file to the local disk.
    *   Handles file deletions if necessary.
    *   Triggers a full re-scan of the project in DirAnalyze.

## 5. Content Storage & Retrieval Strategy

*   **Current (Version 0):** `VersionFiles` stores `content_hash` and `file_size`. Actual content is on the local file system.
*   **Planned (Subsequent Versions & Restore):**
    *   Store **diffs** in the `FileDiffs` table.
    *   Restore by applying diffs sequentially from Version 0 (or a full snapshot) to the target version.
    *   Consideration: Robustness may require DirAnalyze to internally cache Version 0 file contents (by hash) if the user heavily modifies their local V0 files outside of DirAnalyze control.

## 6. Future Considerations

*   Branching/Merging of Versions.
*   Garbage Collection/Pruning Old Versions.
*   Performance of diffing and restoration.
*   UI for browsing versions and diffs between arbitrary versions.