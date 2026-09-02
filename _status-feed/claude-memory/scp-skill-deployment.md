---
name: scp-skill-deployment
description: SCP skill portable deployment guide; reusable for new users/migrations
metadata: 
  node_type: memory
  type: reference
  originSessionId: 634d2733-de5b-486e-a577-4a51780bbf56
---

## SCP Skill Deployment Guide

**Location:** `~/.claude/skills/skill-contribution-pipeline.md` 
**Status:** Deployed globally (2026-06-11) 
**Purpose:** Self-contained setup + implementation guide for Phase 28a

### What's In the Skill

- Quick start (5 steps)
- Setup instructions (manifest, token, Slack)
- Implementation phases (28a.1–28a.7 with timelines)
- Full manifest schema + examples
- Contributions tracking metadata
- Usage commands (register, check, contribute, status)
- Troubleshooting (token, 404, 429, PR collision, auth)
- Phase 2 enhancements (deferred)
- Migration checklist

### When to Use

**New environment setup:**
1. Copy `~/.claude/skills/skill-contribution-pipeline.md`
2. Create `.env` with `GITHUB_TOKEN`
3. Create `~/.claude/skills/manifest.json` (empty)
4. Follow "Setup Instructions" in skill
5. Register initial skills
6. Run `/skill-check-upstream` to detect changes
7. Set up cron for daily checks

**Migration to new user:**
1. Copy skill file
2. Copy `~/.claude/skills/manifest.json`
3. Copy `~/.claude/skills/contributions/*.json` (metadata)
4. Copy `~/.claude/skills/contributions/*.log` (history)
5. Update `.env` with new GitHub token
6. Run `/skill-contrib-status` to resume monitoring

### Key Implementation Details in Skill

- **Token validation:** `ghp_*` format check + GitHub API HEAD request
- **Backoff strategy:** 1s→2s→4s (capped 60s), max 3 retries
- **Error handling:** 404 (unavailable), 401 (halt), 422 (escalate), timeout >10s (retry)
- **PR collision:** sequential suffix, comment on existing, auto-cleanup >60d
- **Stale detection:** 30d no activity alert, closure logging, merge celebration

### Manifest Backup for Migration

**Before migration, preserve:**
```
~/.claude/skills/manifest.json                          # skill registry
~/.claude/skills/contributions/*.json                   # PR metadata
~/.claude/skills/contributions/merged.log               # success history
~/.claude/skills/contributions/auth-failure.log         # failures
```

### Related

- [[phase-28a-skill-contribution-pipeline]] — Design spec
- CIC_MASTER_ROADMAP.md Phase 28a
- docs/SKILL-CONTRIBUTION-PIPELINE.md (full spec in project)
