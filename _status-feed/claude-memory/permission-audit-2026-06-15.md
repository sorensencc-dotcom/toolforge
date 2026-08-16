---
name: permission-audit-2026-06-15
description: Permission audit completed; 7 patterns added to allowlist; 247 total rules
metadata: 
  node_type: memory
  type: project
  originSessionId: a14f113d-b302-4fe0-a540-5c59deae3fce
---

## Permission Audit — 2026-06-15

**Status**: Completed. Allowlist expanded from 240 → 247 rules.

### Motivation

User was experiencing excessive permission prompts during IR and heavy development runs. Requested proactive allowlist expansion to reduce friction.

### Analysis

**Transcripts Scanned**: 20 most recent JSONL files across ~/.claude/projects/c--dev/

**Patterns Extracted**: 51 unique command patterns

**Filtering Results**:
- Already auto-allowed: 18 (git log, grep, find, ls, cat, etc.)
- Already in allowlist: 7 (docker-compose, git status, gh pr, etc.)
- Too rare (<3 hits): 15
- Dangerous (declined): 0
- New candidates: 7

### Patterns Added

**Batch 1 (User-Requested)**:
1. `Bash(gh workflow *)` — query/list GitHub workflows
2. `Bash(gh pr checks *)` — check PR status
3. `Bash(npm audit *)` — dependency audit command
4. `Bash(bun *)` — bun tool general access

**Batch 2 (Audit-Discovered)**:
5. `PowerShell(Stop-Process *)` — process termination queries (7 hits in transcripts)
6. `PowerShell(Get-Job *)` — job status queries (3 hits)
7. `Bash(wsl *)` — Windows Subsystem for Linux access (3 hits)

### High-Frequency Patterns (Top 10)

| Pattern | Count | Status |
|---------|-------|--------|
| `docker-compose` | 30 | Already covered by `docker-compose *` |
| `git` | 29 | Auto-allowed |
| `grep` | 15 | Auto-allowed |
| `find` | 14 | Auto-allowed |
| `ls` | 12 | Auto-allowed |
| `Stop-Process` | 7 | **Added** |
| `curl` | 6 | Already in list as `curl *` |
| `docker` | 6 | Already in list as `docker *` |
| `Get-Job` | 3 | **Added** |
| `wsl` | 3 | **Added** |

### Settings Updated

File: `c:\dev\.claude\settings.json`

- **Section**: `permissions.allow` array
- **Before**: 240 rules
- **After**: 247 rules
- **Net**: +7 rules
- **Duplicates**: 0 (all new entries deduplicated)
- **Groups affected**: GitHub CLI (gh), process control (PowerShell), cross-platform tools (wsl/bun)

### Expected Impact

- Eliminates prompts for common IR workflow operations
- `gh workflow`, `gh pr checks` — frequent GitHub inspection
- `Stop-Process`, `Get-Job` — common debugging workflows
- `npm audit` — dependency scanning
- `bun *` — expanded bun tool access (test runs, type checks)

### Future Approach

Rather than periodic audits, recommend:
1. Watch for permission prompts during actual work
2. Add patterns immediately on first prompt
3. Run `/fewer-permission-prompts` after heavy 4+ hour sessions

Allowlist is now comprehensive enough for typical development flow. Marginal ROI on additional patterns.

### Notes

- Settings.json is local-only (not git-tracked)
- Allowlist applies globally across all projects
- No patterns were deemed dangerous or excluded
- Most high-frequency commands (ls, grep, git) are already auto-allowed by Claude Code, reducing entries needed
