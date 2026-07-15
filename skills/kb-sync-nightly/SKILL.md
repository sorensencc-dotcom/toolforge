---
skill_name: kb-sync-nightly
version: 1.0.2
name: kb-sync-nightly
category: governance
description: Nightly KB sync orchestrator. Runs full pipeline (NotebookLM + Obsidian staging + interactive artifact generation) from C:\dev\kb-sync.
author: Chris (Tier 1)
tags: [kb-sync, nightly, automation]
last_updated: 2026-07-14
status: ACTIVE
---

# kb-sync-nightly

Knowledge base sync with integrated cross-reference layer. Syncs CIC docs to wiki/ and builds cross-refs with docs/.

**Status: IMPLEMENTED & VERIFIED** (v1.0.2, 2026-07-14)

## Metadata

- **ID:** kb-sync-nightly
- **Version:** 1.0.2 (corrected command path, 2026-07-14)
- **Category:** governance
- **Runtime:** bash
- **Entrypoint:** src/run.sh
- **Requires:** Node.js 18+, npm, bash
- **Working Directory:** C:\dev\kb-sync
- **Scheduled Command:** `bash C:\dev\skills\kb-sync-nightly\src\run.sh`

## Execution

### For Scheduled Task Registration

```bash
bash C:\dev\skills\kb-sync-nightly\src\run.sh
```

**Schedule:** Daily (nightly, default 21:00)  
**Working Directory:** Auto-set by script to C:\dev\kb-sync  
**Logging:** Capture stdout/stderr to timestamped log

### Manual Execution

```bash
cd C:\dev\skills\kb-sync-nightly
bash src/run.sh
```

## Pipeline Architecture

**Stage 1: Multi-Target Sync** (Fail-Soft)
- NotebookLM ingestion (`npm run kb:sync:notebooklm`)
- Obsidian staging (`npm run kb:sync:obsidian`)
- Each target runs independently; partial failure continues to Stage 2

**Stage 2: Artifact Generation** (Fail-Soft)
- Interactive report with impact scoring
- Output: `C:\dev\kb-sync\_integration\kb-sync-interactive-report.html`
- Failure does not block nightly automation; operator notified

## Outputs

- `obsidian/vault/wiki/index.md` — Consolidated wiki
- `_integration/kb-sync-interactive-report.html` — Interactive report
- `obsidian/vault/_kb-sync-staging/<timestamp>/` — Staging snapshot

## Reference

See README.md for usage and docs/ for details.

## Change History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-11 | Initial (broken Python path) |
| 1.0.1 | 2026-07-13 | Fixed to npm, corrected path (Tier 1 approval) |
| 1.0.2 | 2026-07-14 | Updated scheduled task definition with verified command |


