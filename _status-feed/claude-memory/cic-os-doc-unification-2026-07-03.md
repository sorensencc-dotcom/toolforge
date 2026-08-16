---
name: cic-os-doc-unification-2026-07-03
description: "Full CIC-OS doc unification shipped 2026-07-03 — 15 updated + 10 new docs, dual Build/Runner status convention, key repo-fact corrections"
metadata: 
  node_type: memory
  type: project
  originSessionId: 02774e76-c5bb-430c-be4c-f423df328859
---

Full CIC-OS documentation unification shipped 2026-07-03 (Fable Brief execution). 15 docs updated, 10 created (docs/roadmaps/ trio, operations/roadmap-runner+cost-tracking+weekly-sync+drift-forecast, reference/toolforge+services+system-index-builder), mkdocs.yml nav extended. `mkdocs build --strict` + verify-docs-content.js + verify-topology-docs.js all pass.

Non-obvious repo facts locked in during verification (trust these over any brief):
- `cic/ROADMAP.md` = Toolforge roadmap (`<!-- SYNC:TOOLFORGE -->`), NOT CIC phases. CIC phase truth = docs/cic/index.md + build-roadmap.json + docs/roadmaps/cic-roadmap.md.
- `projects/cic/docs/CIC_MASTER_ROADMAP.md` = Cast Iron Charlie documentary (different "CIC") — never cite for CIC-OS.
- FOUR distinct drift detectors: scripts/drift-detector.js (visual/pixelmatch), scripts/docker-drift-detector.js (image staleness), cic-ingestion/src/drift/ + root drift-detector.ts (semantic/governance), toolforge/skills/work-summarizer/src/drift-detector.ts (CIC-lag). Disambiguation table in docs/architecture/drift.md.
- roadmap-runner/state-store.json: ALL 9 phases pending, zero runs → **dual status convention**: "Build ✅ / Runner ⏸ pending" used across roadmap docs.
- Real cost system: src/lib/notify/CostNotifier.ts + src/lib/report/CicCostComputeReport.ts (no scripts/cost-notifier.js).
- cic-os/ dir = personal-knowledge-base stub only; routing = src/cic-runtime/routing/ (5 routers); toolforge/agents/ doesn't exist (💡); services/gemini-coach + services/antigravity-ide are real.
- scripts/verify-all.js broken pre-existing (CJS require in "type":"module" repo); run verify-docs-content.js + verify-topology-docs.js individually.
- Open conflicts to reconcile at weekly sync: Phase 24.5 (queued in build-roadmap.json vs complete per PHASE-28a doc). Seeded in docs/operations/drift-forecast.md.
- RL vault SHIPPED 2026-07-04: manifest docs/rewrite-labs/rl-vault-manifest.json (14 docs, 5 sections) + scripts/rl-vault-sync.js (`--pull`/`--dry-run`; exit 2 = manifest path missing at source); first sync 14/14 into C:\dev\rl-ref + generated index.md; RL_SYNC_ENABLED=true. rewrite-mcp real RL docs: docs/rewrite-labs/REWRITE_LABS_ROADMAP.md, docs/internal/rewrite_labs_overview.md, docs/roadmaps/master-roadmap.md, docs/cic/rewrite_labs_cic_fusion_layer.md (brief's proposed subset was fictional; rewrite-mcp root ROADMAP.md = Toolforge copy, excluded).
- Commits: 28f1650 (unification), ef128c5 (frontmatter — docs-manager pre-commit audit requires YAML frontmatter on all docs), d6a9f4d (RL vault source), d4dfa91 (RL vault sync system).
- HAZARD: parallel Claude windows share this repo's git index — `git add` from both windows merges into one commit, and commit messages can get swapped. Guard: check `git status --cached`/HEAD immediately before committing; amend only after verifying HEAD is yours.

**Why:** future doc/roadmap sessions will re-hit these traps (fictional cic-os/ tree, wrong ROADMAP.md, conflated drift detectors).
**How to apply:** before editing CIC-OS docs, read docs/operations/drift-forecast.md for open gaps and use the dual Build/Runner convention for runner-managed phases. See [[master-roadmap-location]].
