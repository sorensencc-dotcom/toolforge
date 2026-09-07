# Workspace Storage Cleaner - Usage Guide

Audits and safely purges stale artifacts, orphaned nested git clones, oversized execution logs, and stray temp files across Antigravity Brain and the development workspace.

**Version**: 1.0.0
**Runtime**: Python 3
**Status**: active
**Category**: maintenance
**Entrypoint**: scripts/clean-storage.py

---

## Purpose

Two problem areas:

1. Antigravity Brain sessions accumulate nested .git clones and multi-megabyte task-*.log files.
2. Project workspaces accumulate stray root files (null, vault-sync.log, sync lock/db) plus redundant installer archives and stale IJFW dream logs.

This skill audits first (default) and only deletes when you pass --apply. It protects the current conversation id when provided.

---

## When to use

- Disk pressure under the brain root or C drive dev workspace
- After long agent sessions that left nested repos or huge task logs
- Periodic maintenance before backups

Do not use this as a general git cleaner for real project repos. It targets known brain/workspace junk patterns only.

---

## Prerequisites

- Python 3
- Permission to read (and with --apply, delete) under brain and workspace roots
- Optional: CONVERSATION_ID env or --current-cid so the active session is skipped

---

## How to run

Script: skills/workspace-storage-cleaner/scripts/clean-storage.py

Audit only (default):

python scripts/clean-storage.py

Apply deletions:

python scripts/clean-storage.py --apply

Useful flags:

- --brain-root: default ~/.gemini/antigravity/brain
- --workspace-root: default C:\dev
- --current-cid: active conversation id to exempt (defaults from CONVERSATION_ID)
- --apply: perform deletions; omit for dry-run

---

## What it detects

### Brain audit

For each session directory except current-cid:

- Nested .git directory size (type brain_nested_git)
- Files named task-*.log larger than 2 MB (type brain_oversized_log)

### Workspace audit

Under workspace-root:

- Stray files named: null, sync.ffs_db, sync.ffs_lock, vault-sync.log
- Installer/archive globs under claude-skills: python-installer.exe, python.zip
- .ijfw/logs/dream-2026-06*.log stale dream logs

---

## Inputs and outputs

### Inputs

- brainRoot, workspaceRoot, current-cid, apply flag (see above)

### Outputs (stdout report)

- Mode line: AUDIT / DRY-RUN or APPLY
- Counts and MB for brain vs workspace candidates
- Planned action list in dry-run, or [CLEANED] / [FAILED] lines when applying
- Total reclaimable or successfully reclaimed MB

No JSON file is written; this is a CLI report tool.

---

## Examples

Dry-run against defaults:

python C:\dev\skills\workspace-storage-cleaner\scripts\clean-storage.py

Apply while protecting the active conversation:

python C:\dev\skills\workspace-storage-cleaner\scripts\clean-storage.py --current-cid <cid> --apply

Custom roots:

python scripts/clean-storage.py --brain-root D:\brain --workspace-root D:\work --apply

---

## Troubleshooting

**Everything is clean**

No matching patterns found. That is success.

**FAILED could not remove path**

File locked or permission denied. Close handles and rerun with --apply; chmod is attempted for nested git trees before rmtree.

**Active session cleaned**

Pass --current-cid or set CONVERSATION_ID. Without it, only the default empty string is exempted.

**Expected more reclaim**

Patterns are intentionally narrow (task-*.log over 2MB, specific stray names, dream-2026-06* logs). This is not a generic temp wiper.

**Wrong workspace**

Override --workspace-root; default is C:\dev.

---

## See also

- Skill Operator Guide: docs/meta/skill-operator-guide.md
- SKILL.md / README.md / SKILL.json
- Related: session / brain maintenance skills; do not confuse with git repo cleanup tools
