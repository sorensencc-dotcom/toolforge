---
name: drift-2026-07-11-004-storage-location
description: Stored drift incident in repo (docs/meta) instead of memory system
metadata: 
  node_type: memory
  type: drift
  originSessionId: 36b19781-eb2f-4b0e-b505-cee5cd2a36be
---

# DRIFT-2026-07-11-004 — Governance Document Storage Violation

**Violation:** Stored drift incident file in `c:\dev\docs\meta\DRIFT-2026-07-11-003.md` instead of memory system.

**Rule Violated:** Global Operating Rules v1.5, Section 3 (3-Layer Memory Architecture)
- Long-term memory: CLAUDE.md, design systems, governance references
- Project memory: MEMORY.md, docs/meta, per-session records
- Drift incidents should be logged in memory, NOT repo

**What Happened:** Agent created drift incident file and placed in `c:\dev\docs\meta/` (repo). Should have been in `C:\Users\soren\.claude\projects\c--dev\memory/`.

**Impact:** Drift incident scattered across two locations instead of centralized in memory system.

**Correction:**
- Moved to memory: `C:\Users\soren\.claude\projects\c--dev\memory\drift-2026-07-11-003-unauthorized-artifact.md`
- Original repo file should be deleted
- Updated MEMORY.md index

**Status:** LOGGED, SELF-CORRECTED
