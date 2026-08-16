---
name: phase-0-9-thefoundry
description: TheFoundry infrastructure phase — Docker-based deterministic Node builds for CIC OS
metadata: 
  node_type: memory
  type: project
  status: LOCKED
  version: 1.0.0
  date: 2026-06-08
  originSessionId: 634d2733-de5b-486e-a577-4a51780bbf56
---

## TheFoundry — Phase 0.9 (Infrastructure Substrate)

**Phase 0.9** is the foundational build infrastructure for CIC OS. It sits in the **Phase 0 Infrastructure Layer**, before all feature phases.

### What it does
- Seals all Node.js builds inside Docker containers (multi-stage: base → test → lint → build → runtime)
- Eliminates nondeterminism: builds are bit-for-bit reproducible across dev, CI, and production
- Removes host OS trust boundary: zero npm commands directly on Windows
- Standardizes the entire build pipeline (images, directory layout, CI templates)

### Why it matters
TheFoundry enables:
- **Phase 24** (Autonomous Governance) to rely on deterministic, auditable builds
- **Phase 4.3/4.4** (Operator Console) to use sealed, reproducible pipelines
- **All CIC agents** to execute with confidence in build isolation and repeatability
- **Reduced onboarding friction** — new devs get working env in 5 minutes

### Positioning
- **Not a blocker** — runs in parallel with all active phases
- **Force multiplier** — improves reliability and reduces friction everywhere
- **Infrastructure-grade** — same category as Phase 1 (environment hardening), Phase 3 (ingestion), Phase 4 (operator console foundations)

### Execution Timeline
- **Start:** 2026-06-08 (now)
- **Deploy:** 2026-06-22 (2 weeks)
- **Integration:** Phase 24, Phase 4.3/4.4 adopt TheFoundry as default by end of Q2

### Locked Scope
✅ Multi-stage Dockerfile patterns  
✅ npm ci (lock-file-first) conventions  
✅ Volume mount strategy (source only)  
✅ CI templates (GitHub Actions, Azure, GitLab)  
✅ Docker build/run command patterns  

### Open for Refinement
- devcontainer integration (v1.1)
- Multi-arch ARM support (v1.1)
- Polyglot support: Python, Rust, Golang (v1.1+)
- Buildkit optimizations (v1.1)

### Key Files
- **Locked Spec:** `/docs/cic/phase-0-9-thefoundry.md` — 500+ lines, full specification
- **Roadmap Entry:** `/docs/cic/CIC_MASTER_ROADMAP.md` — Phase 0.9 section
- **Dockerfiles:** `/thefoundry/images/node-build/Dockerfile`, `/thefoundry/images/node-runtime/Dockerfile`
- **CI Template:** `/thefoundry/ci/github-actions.yml`

### Success Metrics
1. ✅ All Node builds run inside Docker (zero host prompts)
2. ✅ Builds are reproducible (run twice, same hash)
3. ✅ Phase 24 integrates TheFoundry as dependency
4. ✅ Developer onboarding time reduced by 50%
5. ✅ First 3 devs successfully build locally

### Milestones
| Week | Milestone | Status |
|------|-----------|--------|
| 1 (Jun 8–14) | Core images validated locally | ✅ COMPLETE (Jun 8, 2026) |
| 2 (Jun 15–21) | Phase 24 integration complete | IN PROGRESS |
| 3 (Jun 22–28) | CI pipeline runs all tests | PENDING |
| 4 (Jun 29–Jul 5) | Developer docs + training | PENDING |

### How to Apply This Memory
- When planning Phase 24 or Phase 4.x work, assume TheFoundry is available as a hard dependency by week 2
- When onboarding new developers, point them to TheFoundry dev workflow
- When debugging build failures, check "is this inside the container?" first
- When refining Phase 0.9 scope, refer back to the "locked" vs "open for refinement" distinction

### Related Memories
- [[master-roadmap-location]] — source of truth for all phases
- [[phase-24-autonomous-governance]] — depends on TheFoundry for deterministic builds
- [[phase-4-3-codeburn-integration]] — integrates with TheFoundry pipelines
