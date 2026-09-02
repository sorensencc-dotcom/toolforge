---
name: feedback_check_git_add_a_embedded_repo_warnings
description: "always scan git add -A output for \"adding embedded git repository\" warnings before committing, across all repos"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: de2f1c5c-6819-41a4-9422-e6d06c50274d
  modified: 2026-07-26T12:54:47.136Z
---

`git add -A` silently stages broken gitlinks (mode `160000`, no `.gitmodules` entry) whenever a nested directory has its own `.git`. This happened three times found in one sweep on 2026-07-26: `trm/` and `docs/archive/build-output/CIP/CIC/` in the `toolforge` (c:\dev) repo, and `notebooklm-mcp-cli` in `kb-sync` (that one was *already committed* broken, before this session — clone `--recursive` would have silently produced an empty dir there).

**Why:** a broken gitlink looks fine in `git status` (`?? trm/` or later `M notebooklm-mcp-cli`) but carries zero content — only a dangling commit SHA with no URL. Nothing backs it up; a fresh clone gets nothing.

**How to apply:** before committing after `git add -A` in any repo, check the command output (not just `git status`) for `warning: adding embedded git repository: <path>`. If found: don't commit it as-is. Decide per case — (a) it's a real separate project with its own remote → `git rm --cached`, gitignore the path, push it independently on its own remote (matches existing pattern for `cic-ingestion/`, `kb-sync/`, etc. already excluded in c:\dev's `.gitignore`); (b) it's vendored third-party code (e.g. `notebooklm-mcp-cli`) → deregister + gitignore, treat like `node_modules`; (c) it's genuinely meant to be shared/versioned → register properly in `.gitmodules`, not a bare gitlink. Never leave it as a silent broken gitlink.
