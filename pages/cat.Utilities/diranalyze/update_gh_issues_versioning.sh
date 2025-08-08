#!/bin/bash

GH_REPO="junovhs/diranalyze" # !!! UPDATE THIS IF YOUR REPO IS DIFFERENT !!!
MILESTONE_V02="v0.2 - Core Backend Bootstrap"
MILESTONE_V03="v0.3 - CLI Alpha"

echo "--- Updating Existing Issue #7 ---"
gh issue comment 7 --repo "$GH_REPO" --body "Partial implementation complete for versioning foundation:
- SQLite schema (ProjectVersions, VersionFiles, OperationLog) established.
- Backend API (/api/snapshot/initial) for creating the initial Version 0 snapshot is functional.
This issue will remain open to track the full scope of deterministic logging and versioning features. Follow-up issues are being created for specific sub-tasks."
echo "Comment added to issue #7."

echo ""
echo "--- Creating New Issues for Versioning Feature ---"

# Issue 1: Frontend - Calculate File Hashes & Send Initial Snapshot Data
gh issue create --repo "$GH_REPO" \
--title "feat(frontend): Calculate file hashes and send initial snapshot data" \
--body "Implement frontend logic to:
1. After initial directory scan (\`processDirectoryEntryRecursive\`), iterate through \`appState.fullScanData.allFilesList\`.
2. For each file, read its content (using File System Access API) and calculate its SHA-256 hash (e.g., using \`crypto.subtle.digest\` or a JS library).
3. Compile a list of \`ScannedFileInfo\` objects ({ path, hash, size }).
4. Send this list and the project name as a JSON payload to the backend \`/api/snapshot/initial\` endpoint.
5. Handle success/error responses from the backend.

**Acceptance Criteria:**
- On initial project load, after scanning, the frontend successfully sends snapshot data to the backend.
- Backend confirms snapshot creation (as seen in server logs and API response).
- No snapshot is sent if the project load fails or is empty.
- Errors during hashing or API call are handled gracefully and reported to the user." \
--label "feature,frontend,versioning,p2-medium" \
--milestone "$MILESTONE_V02"
echo "Created: Frontend - Calculate File Hashes & Send Initial Snapshot Data"

# Issue 2: Backend - API & Logic for Subsequent Version Snapshots (Post-Patch)
gh issue create --repo "$GH_REPO" \
--title "feat(backend): API & Logic for subsequent version snapshots (post-patch)" \
--body "Implement backend functionality to create new project versions after patches are applied.
1. Design and implement a new API endpoint (e.g., \`/api/snapshot/create_from_patch\`).
2. This endpoint should accept:
    - \`parent_version_id\`.
    - A description for the new version (e.g., summary of patches).
    - A list of files that were changed/added/deleted, including their new content hashes and sizes.
3. Backend logic should:
    - Create a new entry in \`ProjectVersions\` linking to the \`parent_version_id\`.
    - Update/insert entries in \`VersionFiles\` for all files in the project, reflecting the new state.
    - Log the operation in \`OperationLog\`.

**Acceptance Criteria:**
- Backend can create a new version linked to a parent.
- \`VersionFiles\` accurately reflects the state of all project files for the new version.
- Operation is logged." \
--label "feature,backend,versioning,p1-high" \
--milestone "$MILESTONE_V02"
echo "Created: Backend - API & Logic for Subsequent Version Snapshots"

# Issue 3: UI - Version History Timeline Display
gh issue create --repo "$GH_REPO" \
--title "feat(ui): Display version history timeline" \
--body "Implement a new UI section to display the project's version history.
1. Backend: Create an API endpoint (e.g., \`/api/versions\`) to fetch all \`ProjectVersions\`.
2. Frontend:
    - Fetch version data from the backend.
    - Display versions in a chronological or hierarchical list/timeline.
    - Allow a user to click/select a version.
    - Selecting a version should enable a 'Restore This Version' button.

**Acceptance Criteria:**
- User can view a list of all saved project versions.
- Version information (ID, time, description) is clearly displayed.
- User can select a version from the timeline." \
--label "feature,ui,versioning,p2-medium" \
--milestone "$MILESTONE_V03"
echo "Created: UI - Version History Timeline Display"

# Issue 4: Core - Restore Project to a Selected Version
gh issue create --repo "$GH_REPO" \
--title "feat(core): Restore project to a selected version" \
--body "Implement the functionality to restore the user's local file system to a previously saved version.
1. Backend:
    - Create an API endpoint (e.g., \`/api/versions/{version_id}/restore\`).
    - Given a \`version_id\`, determine all files and their content hashes for that version.
    - Reconstruct file content (e.g., from Version 0 + applying diffs if diffs are stored, or by retrieving full content if an alternative storage for original Version 0 files is implemented).
    - Send file paths and their reconstructed content to the frontend.
2. Frontend:
    - On 'Restore This Version' click (after confirmation):
        - Call the backend restore endpoint.
        - Receive file paths and content.
        - Use File System Access API to write files to local disk.
        - Trigger a re-scan of the project in DirAnalyze.

**Acceptance Criteria:**
- User can select a version and click 'Restore'.
- Local project files are overwritten to match the selected version.
- DirAnalyze UI updates to reflect the restored state." \
--label "feature,core-logic,backend,frontend,versioning,p1-high" \
--milestone "$MILESTONE_V03"
echo "Created: Core - Restore Project to a Selected Version"

# Issue 5: Backend - Store/Retrieve File Diffs Between Versions
gh issue create --repo "$GH_REPO" \
--title "feat(backend): Store and use file diffs for versioning optimization" \
--body "Optimize version storage and reconstruction by storing diffs between file versions.
1. When creating a new version snapshot (post-patch):
    - For each file that changed, calculate and store a diff in a new \`FileDiffs\` table.
2. When reconstructing a file for a specific version:
    - Use Version 0 (or closest snapshot with full data) and apply stored diffs sequentially.

**Acceptance Criteria:**
- Diffs are generated and stored for changed files.
- File content for historical versions can be reconstructed by applying stored diffs.
- This should be more storage-efficient than storing full file contents for every version." \
--label "feature,backend,versioning,optimization,p2-medium" \
--milestone "$MILESTONE_V03"
echo "Created: Backend - Store/Retrieve File Diffs Between Versions"

echo ""
echo "--- GitHub Issue Update Complete ---"
echo "Remember to run './update_github_meta.sh' again to refresh local issues.md and milestones.md if you want to see these changes reflected there immediately."