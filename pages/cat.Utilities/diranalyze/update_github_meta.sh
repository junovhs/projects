#!/bin/bash
# Script to fetch GitHub issues and milestones into local files.

# Ensure we are in the script's directory (which should be the repo root)
# For this script, we assume it's run from the repo root already.
# If you wanted to make it runnable from anywhere:
# REPO_ROOT_DIR="$(git rev-parse --show-toplevel)"
# cd "$REPO_ROOT_DIR" || exit

echo "Current directory: $(pwd)"
echo "This script should be run from the root of your 'diranalyze' Git repository."
echo ""

mkdir -p .github_meta ; \
echo "Fetching issues (JSON) into .github_meta/issues.json ..." ; \
gh issue list --limit 500 --state all \
  --json number,title,body,state,author,labels,milestone,createdAt,updatedAt,assignees,comments,url \
  > .github_meta/issues.json ; \
echo "Generating issues.md into .github_meta/issues.md ..." ; \
gh issue list --limit 500 --state all \
  --json number,title,body,state,author,labels,milestone,createdAt,updatedAt,assignees,comments,url \
  --template "$(cat <<'EOF_ISSUES'
{{range .}}
## Issue #{{.number}}: {{.title}}

- **State:** {{.state}}
- **Author:** {{.author.login}}
- **Milestone:** {{if .milestone}}{{.milestone.title}}{{else}}N/A{{end}}
- **Assignees:** {{if .assignees}}{{join ", " (pluck "login" .assignees)}}{{else}}N/A{{end}}
- **Labels:** {{if .labels}}{{join ", " (pluck "name" .labels)}}{{else}}N/A{{end}}
- **Created:** {{.createdAt | timefmt "2006-01-02T15:04:05Z"}}
- **Updated:** {{.updatedAt | timefmt "2006-01-02T15:04:05Z"}}
- **URL:** {{.url}}

{{if .body}}
**Body:**
{{.body}}
{{else}}
No description provided.
{{end}}

{{if .comments}}
**Comments ({{len .comments}}):**
{{range .comments}}
- *Comment by {{.author.login}} at {{.createdAt | timefmt "2006-01-02T15:04:05Z"}} ({{.url}})*
  {{.body}}
{{end}}
{{end}}
---
{{end}}
EOF_ISSUES
)" > .github_meta/issues.md ; \
echo "Fetching milestones (JSON) into .github_meta/milestones.json ..." ; \
GH_REPO_OWNER=$(gh repo view --json owner --jq .owner.login 2>/dev/null) ; \
GH_REPO_NAME=$(gh repo view --json name --jq .name 2>/dev/null) ; \
if [ -n "$GH_REPO_OWNER" ] && [ -n "$GH_REPO_NAME" ]; then \
  gh api "repos/${GH_REPO_OWNER}/${GH_REPO_NAME}/milestones?state=all" \
    > .github_meta/milestones.json ; \
  echo "Generating milestones.md into .github_meta/milestones.md ..." ; \
  jq -r '.[] | ("## Milestone: " + .title + "\n\n- **State:** " + .state + "\n- **Open Issues:** " + (.open_issues|tostring) + "\n- **Closed Issues:** " + (.closed_issues|tostring) + "\n- **Due Date:** " + (.due_on // "N/A" | if . != "N/A" then split("T")[0] else . end) + "\n- **Description:**\n  " + (.description // "N/A" | gsub("\r\n"; "\n  ") | gsub("\n"; "\n  ")) + "\n- **URL:** " + .html_url + "\n---\n")' .github_meta/milestones.json > .github_meta/milestones.md ; \
else \
  echo "Error: Could not determine GitHub repository owner or name. Skipping milestone fetch. Are you in a gh-initialized repo and logged in?" ; \
fi ; \
echo "GitHub metadata fetched into .github_meta/"
