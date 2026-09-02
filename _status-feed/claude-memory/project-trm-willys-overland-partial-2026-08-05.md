---
name: project-trm-willys-overland-partial-2026-08-05
description: willys-overland topic ingested + committed in trm-vault; score/report + cuba/helene staging + unsorted bucket still open
metadata: 
  node_type: memory
  type: project
  originSessionId: d1db0f41-6f9a-4e79-b19e-65e816931f74
  modified: 2026-08-06T01:01:11.075Z
---

trm-vault: topics/charlie/willys-overland created, route-intake --apply run, ingest-dir done (9/9 real Vision OCR, 0 fail), extract done (32 facts from PDF SRC-001, 8 image sources skipped by extract — normal, image facts come from ImageAnalyzer at ingest time not the extract command), validate clean. Committed `986dac0` in trm-vault repo.

**Gotcha hit:** `trm create` path arg must be relative to `topics/` root (e.g. `charlie/willys-overland`), not `topics/charlie/willys-overland` — the CLI prefixes `topics/` itself. Passing the prefixed form silently creates a doubled `topics/topics/...` nesting instead of erroring.

**Not yet done (same route-intake run, runId 20260805-b88caebe):**
- `score charlie/willys-overland` + `report charlie/willys-overland` — pipeline stops after extract/validate, score+report not run
- `cuba` topic has 1 file staged in `_staging-intake-20260805-b88caebe`, never ingested
- `helene` topic has 2 files staged in same run, never ingested
- `unsorted` bucket: 101 files route-intake couldn't match to any topic — needs review before they age out
- Possible crosslink: willys-overland ↔ willow-run or existing treatment section (Ford 9N tractor / Sorensen angle) — not evaluated

**Why:** user paused mid-pipeline to end session; explicitly asked to resume in a new session rather than continue now.

**How to apply:** next trm-vault session, resume at score+report for willys-overland, then clear cuba/helene staging dirs, then look at the unsorted 101.

See [[project-trm-route-intake-shipped-2026-08-05]], [[project-trm-vault-deliberately-local-only]].
