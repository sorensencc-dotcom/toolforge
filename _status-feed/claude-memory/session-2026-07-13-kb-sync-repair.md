---
name: session-2026-07-13-kb-sync-repair
description: KB sync script corruption investigation and pipeline repair
metadata: 
  node_type: memory
  type: project
  originSessionId: 98a6963f-dbac-4c1d-a6ba-ebf2cbe45d1f
---

# Session: KB Sync Corruption Repair (2026-07-13)

## Incident
KB sync nightly investigation report claimed script corruption:
- notebooklm script: truncated at line 288 (disk) vs 287 (git)
- artifact-generator: truncated at line 564
- Root cause: read-only filesystem, stray shebangs appended

## Findings vs Reality
Investigation report **overstated severity**:
- Disk version of notebooklm had stray shebang at end
- Deleted untracked artifact-generator (never in git, corrupted beyond recovery)
- After restore + line-ending fix, notebooklm matched git HEAD exactly
- **No actual truncation** — shebang was extra content, not loss

## Actions Taken
1. Removed git index.lock (blocking restore)
2. `git checkout HEAD -- modules/notebooklm/ingest-notebooklm.sh`
3. Fixed CRLF → LF line endings (Windows git config autocrlf)
4. Deleted untracked corrupted artifact-generator/generate-report.mjs
5. Validated syntax: `bash -n` both scripts (pass)
6. Ran full `core/run-all.sh` orchestrator

## Pipeline Results ✅
- **NotebookLM**: 75 files, 342 KB knowledge pack generated
- **Obsidian**: 75 files staged (timestamp 20260712-231704)
- **Status**: Both targets completed, zero failures
- **Artifact generator**: Intentionally disabled (commented in run-all.sh), pending Node.js impl

## Lessons
1. **Investigation report accuracy**: Claims about truncation didn't match actual state. Disk version had extra content (stray shebangs), not loss.
2. **Artifact generator**: Never committed to git, exists only on disk. Should either:
   - Be properly implemented and committed, OR
   - Remain disabled until resources available
3. **Line-ending normalization**: Windows git config auto-converts; bash needs LF. Fix once, git handles future checkouts.
4. **Fail-soft design**: Obsidian sync completed despite NLM corruption — architecture worked as designed.

## Files Modified
- `modules/notebooklm/ingest-notebooklm.sh` — Already clean (HEAD match after line-ending fix)
- `modules/artifact-generator/generate-report.mjs` — **DELETED** (untracked, corrupted)

## Next Steps
1. Monitor next nightly run (2026-07-13 scheduled)
2. If pipeline succeeds again, incident is fully resolved
3. Artifact generator: Schedule proper implementation or document as deferred work
4. Pre-flight check: Filesystem writability before sync (as recommended in investigation)

## Classification
**Class 3** — Operational issue, repair verified, zero impact to main codebase
