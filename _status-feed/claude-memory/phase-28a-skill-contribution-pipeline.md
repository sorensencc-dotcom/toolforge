---
name: phase-28a-skill-contribution-pipeline
description: Skill Contribution Pipeline MVP spec; auto-submit improvements upstream; scheduled 2026-06-18
metadata: 
  node_type: memory
  type: project
  originSessionId: 634d2733-de5b-486e-a577-4a51780bbf56
---

## Phase 28a — Skill Contribution Pipeline (SCP)

**Date:** 2026-06-11 
**Status:** Design Spec (MVP ready for implementation) 
**Execution:** 2026-06-18 through 2026-07-01 (13 days)

### Overview

Automated feedback loop for skill improvements. When skills adopted in CIC are modified (perf, bugs, tests), system:
1. Detects changes vs upstream
2. Auto-generates GitHub PR with commit/description
3. Polls GitHub for acceptance/rejection
4. Notifies via Slack/Teams on status change

### MVP Scope (7 deliverables, 28a.1–28a.7)

**Core:** Skills manifest, change detection, PR generation, status tracking, Slack notifications

**Phase 2 (deferred):** Multi-repo hosts, valuation heuristics for licensing, CLA handling, SMS/iMessage, quality gates

### Deliverables Map

| # | Name | Days | Output |
|---|------|------|--------|
| 28a.1 | SCP Spec | 1 | `docs/SKILL-CONTRIBUTION-PIPELINE.md` |
| 28a.2 | Manifest + CLI | 2 | `~/.claude/skills/manifest.json` + CLI |
| 28a.3 | Change Detector | 2 | Git diff agent |
| 28a.4 | Contributor Agent | 2 | GitHub PR creator |
| 28a.5 | Status Tracker | 1 | `~/.claude/skills/contributions/*.json` |
| 28a.6 | Notifier | 2 | Slack alerts |
| 28a.7 | Ops & Scheduling | 3 | Cron + auth setup |

**Total: 13 days**

### Key Design Decisions

- **Manifest:** File-based JSON at `~/.claude/skills/manifest.json` (not database)
- **Auth:** GitHub token (deferred to Phase 2: OAuth vs env var decision)
- **Filtering:** Auto-submit all diffs; user can reject post-merge
- **Deduplication:** Manifest tracks all modifications, prevents duplicate submissions
- **Notifications:** Slack MVP (teams/SMS Phase 2)

### Success Criteria

✅ MVP deployed by 2026-07-01 
✅ 2+ skills monitored (fewer-permission-prompts, improvement-analysis) 
✅ ≥1 PR successfully merged from local change 
✅ Slack notifications on submit/merge/stale 
✅ Daily cron checks, zero manual intervention 

### Open Questions (Phase 2)

- Valuation heuristics: what makes contribution "extremely valuable"? (licensing trigger)
- License agreements: CLA auto-signing or escalate?
- Multi-repo: priority order (GitHub → GitLab → Gitea)?

### How to Use

```bash
/skill-manifest register https://github.com/anthropics/claude-skills fewer-permission-prompts
/skill-check-upstream                    # Report changes
/skill-contribute fewer-permission-prompts    # Auto-PR changed skill
```

### Related

- [[wayland-v1-1-complete]] — skill hardening
- [[permission-audit-skill]] — skill governance
- [[skills-policy-agent-requirement]] — skill adoption policy
