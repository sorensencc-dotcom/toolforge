---
name: batch-2-tickets-location
description: "Ticket batches (2–5) stored at docs/roadmaps/tickets/batch-N/ — one file per ticket, index with status table = parallel-window coordination point"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3dc4e968-5918-4920-abac-fb18557321da
---

Ticket batches stored as individual files at `c:\dev\docs\roadmaps\tickets\batch-N\` with `index.md` status table. Batch 2 (14 tickets, Tracks 7-19), Batch 3 (18 tickets, Tracks 20-29, deep architecture), Batch 4 (17 tickets, Tracks 30-36, next-gen runtime: TQ v3, CIC Runtime v4, RL Crawler v2, World-Search v2, Foundry CI/CD, Runtime Orchestrator v4, Fusion Engine v3 — written 2026-07-04), Batch 5 (Tracks with CIC Runtime v5 / RL-6.x / world-corpus v3 / multi-agent orchestration / autonomous governance — written by parallel window 2026-07-04). mkdocs nav updated under Roadmaps → Tickets; strict build passes.

**Why:** User runs tickets in parallel chat windows; each window picks one ticket file. Status column in index.md is the coordination point — update Open → In Progress → Done (commit hash) when shipping.

**How to apply:** New batches follow same pattern: `docs/roadmaps/tickets/batch-N/`, one kebab-case file per ticket, index table with Track column, Parallelization Waves section, nav entry, `mkdocs build --strict` check. Batch 1 was never stored in repo. Cross-ticket dependencies noted in each ticket's Dependencies section with cross-batch relative links (../batch-N/). Parallel windows edit mkdocs.yml concurrently — re-read before editing nav. Related: [[cic-os-doc-unification-2026-07-03]].
