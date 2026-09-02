---
name: decision-ijfw-journal-schema-canonical-2026-07-26
description: canonical ijfw project-journal.md format is schema:1 / session-end entries; ijfw-schema:v1 / observation-tag format is deprecated
metadata: 
  node_type: memory
  type: project
  originSessionId: 0a494a8b-02a6-43ca-9ef9-72788e831d5a
  modified: 2026-07-26T14:46:43.806Z
---

Two divergent project-journal.md formats existed across repos: `<!-- ijfw schema:1 -->` with `session-end: #N` entries (root C:\dev, cic-ingestion — 2 of 3 repos), and `<!-- ijfw-schema: v1 -->` with tagged `**observation** [tags]:` entries (rewrite-docs/cic-os — 1 of 3 repos).

**Why:** Majority format wins, and cic-os's journal was also 31 days stale (last entry 2026-06-25) while the format mismatch masked that new entries weren't even attempted in a way consistent with the rest of the fleet.

**How to apply:** `schema:1` / `session-end: #N` is canonical going forward. `rewrite-docs/ijfw/memory/project-journal.md` migrated 2026-07-26 (header changed, catch-up entry backfilled for the 31-day gap covering MAAL feedback-loop/drift-routing fix, Cloud Extension Layer, Phase 5 canary/TorqueQuery v2, Phase 26 TS cleanup). New repos' journals should use `schema:1` from creation; if a repo shows the old observation-tag format again, migrate it the same way rather than treating it as a valid alternate.
