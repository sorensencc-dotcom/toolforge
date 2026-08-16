---
name: governance_roadmap_location
description: "Roadmaps belong in docs/meta/, not root. Check governance policy before file placement."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a93499f4-6577-4680-bdd3-467b313ad54c
  modified: 2026-07-19T15:28:33.698Z
---

**Rule:** Roadmap and meta-documentation files go in `docs/meta/`, not root directory.

**Why:** CLAUDE.md specifies governance structure in `docs/meta/governance/documentation-policy.md`. All meta docs (specs, roadmaps, governance) belong in `docs/meta/`. Root-level files violate codebase convention.

**How to apply:** Before creating any documentation file, check:
1. Is it meta/governance/policy documentation? → `docs/meta/`
2. Is it project-specific (CIC, KB-sync, etc.)? → That project's `docs/`
3. When in doubt, default to `docs/meta/` and verify with documentation-policy.md

**Incident (2026-07-19):** Created ROADMAP.md at root instead of `docs/meta/toolforge-platform-roadmap.md`. Caught by user review; moved + committed + pushed.
