<!--
AI UPDATE INSTRUCTIONS:
This document outlines the process for managing GitHub Issues in the DirAnalyze project.
To update this document:
1. If the list of active labels changes (new ones added, old ones deprecated), update the "Labels" section. Provide their meaning/purpose.
2. If new milestones are defined or existing ones change purpose, update the "Milestones" section.
3. If the protocol for creating, working on, or closing issues is refined, update the relevant sections.
4. Ensure any example `gh` CLI commands for issue management are current and correct.
Provide the complete updated Markdown content for this file.
-->

# GitHub Issue Management Protocol for DirAnalyze

This document outlines the conventions and processes for using GitHub Issues to track work, bugs, features, and other tasks for the DirAnalyze project. Consistent issue management helps maintain clarity, facilitates collaboration, and provides a historical record of development.

## 1. Purpose of GitHub Issues

In the DirAnalyze project, GitHub Issues are the primary mechanism for tracking:

*   **Bug Reports:** Documenting defects, unexpected behavior, or errors in the application.
*   **Feature Requests:** Proposing new functionalities or enhancements to existing ones.
*   **Tasks:** Breaking down larger features or internal chores (e.g., refactoring, dependency updates) into actionable work items.
*   **Research Spikes:** Allocating time for investigating new technologies, complex problems, or feasibility studies before committing to a full feature.
*   **Documentation Work:** Tracking the need for new documentation, or updates/corrections to existing documents.

## 2. Issue Lifecycle

A typical issue lifecycle in DirAnalyze flows as follows:

1.  **Open:** The issue is created by any contributor or user.
2.  **(Optional) Triage & Discussion:**
    *   The project maintainer(s) or relevant team members review the issue.
    *   Labels like `needs-triage`, `question`, or `needs-discussion` may be applied.
    *   Clarifications might be sought via comments.
3.  **Prioritization & Milestone Assignment:**
    *   The issue is assigned a priority label (e.g., `p1-high`, `p2-medium`, `p3-low`).
    *   The issue is assigned to a relevant milestone (e.g., `v0.2 - Core Backend Bootstrap`, `Research (Ongoing)`).
4.  **(Optional) Help Wanted / Good First Issue:** If suitable, the issue is marked for community contribution.
5.  **To Do / Backlog:** The issue is acknowledged and planned but not actively being worked on.
6.  **In Progress:** A developer assigns the issue to themselves (or is assigned) and begins active development. A feature branch is typically created following conventions in `GIT_CONVENTIONS.md`.
7.  **In Review:** Development is complete, and a Pull Request (PR) has been opened, linking to this issue. The PR is awaiting code review.
8.  **Closed (Resolved/Completed/Won't Fix):**
    *   **Resolved/Completed:** The PR is merged, and the functionality is implemented, or the bug is fixed. The issue is typically closed automatically if the PR description uses keywords like "Closes #issue_number".
    *   **Won't Fix/Invalid:** The issue is deemed out of scope, invalid, a duplicate, or cannot be reproduced. A clear explanation should be provided in a comment before closing.

## 3. Crafting Effective Issues

### Titles
*   **Clarity and Conciseness:** The title should summarize the issue effectively.
*   **Conventional Commits Prefix (Preferred):** Use prefixes like `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`, `build:`, `ci:`.
    *   Example: `feat(parser): Integrate Tree-sitter for JS & Swift`
    *   Example: `fix(ui): Save button remains disabled after changes`

### Descriptions (Issue Body)

*   **For Bug Reports:**
    *   **Clear Description:** What is the bug?
    *   **Steps to Reproduce (STR):** Detailed, numbered steps.
    *   **Expected Behavior:** What should have happened?
    *   **Actual Behavior:** What actually happened?
    *   **Screenshots/GIFs:** Highly encouraged if they help illustrate the problem.
    *   **Environment:** DirAnalyze version (if applicable, once releases start), Browser & OS, specific project characteristics if relevant.
*   **For Features/Tasks:**
    *   **User Story (Recommended for user-facing features):** "As a [type of user], I want [to perform an action] so that [I can achieve this benefit/value]."
    *   **Problem/Motivation:** Why is this feature/task needed? What problem does it solve?
    *   **Proposed Solution (if any):** A brief outline of the intended approach.
    *   **Acceptance Criteria (AC):** A clear, testable list of conditions that must be met for the issue to be considered complete.
    *   **(Optional) Mockups/Diagrams:** For UI features or complex logic.
    *   **(Optional) Technical Notes:** Any known technical considerations or constraints.

## 4. Labels

Labels help categorize, filter, and prioritize issues. (This list should be periodically synchronized with the actual labels defined on the GitHub repository).

*   **Type:**
    *   `bug`: A problem with existing functionality.
    *   `feature`: A new feature or request.
    *   `enhancement`: An improvement to an existing feature.
    *   `docs`: Documentation-related tasks.
    *   `research`: Investigation or exploratory tasks.
    *   `chore`: Maintenance tasks, refactoring, build process updates.
    *   `question`: Indicates the issue is primarily a question.
*   **Component/Area:**
    *   `backend`: Relates to the Rust backend.
    *   `frontend`: Relates to the HTML/JS/CSS frontend.
    *   `ui`: Specific to user interface elements or experience.
    *   `core-logic`: Relates to fundamental application logic.
    *   `versioning`: Related to the project versioning system.
    *   `parser`: Related to code parsing, ASTs, Tree-sitter.
    *   `aiPatcher`: Related to the AI Patcher functionality.
    *   `debriefingAssistant`: Related to the AI Debriefing Assistant.
    *   `performance`: Related to speed or resource usage.
    *   `security`: Related to security aspects.
    *   `optimization`: Related to performance or storage optimization.
*   **Priority:**
    *   `p1-high`: Highest priority, critical.
    *   `p2-medium`: Medium priority, important.
    *   `p3-low`: Lower priority, can be deferred.
*   **Status/Meta:**
    *   `good first issue`: Suitable for new contributors.
    *   `help wanted`: Actively seeking community contributions.
    *   `needs-triage`: Requires review and categorization by maintainers.
    *   `needs-discussion`: Requires more input or clarification before work can begin.

Labels are managed directly on GitHub under the "Issues" -> "Labels" section or via the `gh label` command.

## 5. Milestones

Milestones group issues towards a specific release version or a significant project phase. Current and planned milestones include:

*   `v0.1 - UI Prototype` (Completed)
*   `v0.2 - Core Backend Bootstrap` (In Progress)
*   `v0.3 - CLI Alpha` (Planned)
*   `Core 1.0 (Target: End of 2025)` (Long-term goal, many early items closed under this)
*   `Extended (Target: Q2 2026+)` (Future features)
*   `Research (Ongoing)` (Exploratory tasks without fixed deadlines)

Issues should be assigned to the most relevant active milestone. Milestones are managed on GitHub or via `gh api`.

## 6. Using the `gh` (GitHub CLI)

The `gh` CLI is highly recommended for managing issues from the command line.

**Creating an Issue (Example):**
```bash
gh issue create --repo "junovhs/diranalyze" \
  --title "feat(versioning): Add button to view version diff" \
  --body "As a user, I want to see the diff between two selected versions in the timeline so I can understand changes easily.
**Acceptance Criteria:**
- Button appears when two versions are selected.
- Diff view is shown in a modal or dedicated panel." \
  --label "feature,ui,versioning,p2-medium" \
  --milestone "v0.3 - CLI Alpha"
```

**Commenting:**
```bash
gh issue comment <ISSUE_NUMBER> --repo "junovhs/diranalyze" --body "This is a progress update."
```

**Closing:**
```bash
gh issue close <ISSUE_NUMBER> --repo "junovhs/diranalyze" --comment "Resolved in PR #XYZ."
```

**Editing (e.g., adding a milestone):**
```bash
gh issue edit <ISSUE_NUMBER> --repo "junovhs/diranalyze" --milestone "v0.3 - CLI Alpha"
```

Refer to `gh issue --help` and `gh api --help` for more commands and options.

## 7. Local Metadata Sync (`update_github_meta.sh`)

The project contains a script `./update_github_meta.sh`. This script fetches the current state of issues and milestones from GitHub and updates local files:
*   `diranalyze/.github_meta/issues.json`
*   `diranalyze/.github_meta/issues.md`
*   `diranalyze/.github_meta/milestones.json`
*   `diranalyze/.github_meta/milestones.md`

Run this script after making changes to issues/milestones on GitHub (or via `gh` CLI) to keep these local "debriefing documents" synchronized. Commit any changes to these files.