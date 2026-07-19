# Daily & Weekly Report System Design

**Date:** 2026-07-19  
**Author:** Claude  
**Status:** Approved by user

## Overview

Automated daily and weekly reports that aggregate work across all repos under `C:\dev`. Reports pull from existing data sources (git, ijfw metrics, session wraps) to surface: commits, skills invoked, tests run, files changed, tokens consumed, models used. Published as artifacts + committed to repo for historical record.

## Goals

- **Daily visibility** into work without manual logging
- **Weekly trends** to identify patterns (busiest days, token burn, skill usage)
- **PC-independent** — runs via cloud scheduler, accessible anywhere
- **Low friction** — data pre-collected during normal workflow, agents just aggregate

## System Architecture

### Layer 1: Data Collection (Enhanced Existing Skills)

**Session wrap enhancement:**
- Currently outputs markdown narrative
- Add JSON export (schema v1.0):

```json
{
  "commits": [{"hash": "abc123", "message": "...", "files": ["..."], "repo": "c:\\dev"}],
  "skills": [{"name": "brainstorming", "count": 1}],
  "tokens": 156000,
  "model": "haiku",
  "duration_minutes": 42
}
```

- Required fields: commits, skills, tokens, model
- commits array can be empty (0 commits in session)
- model cannot be null (infer from transcript if missing)
- Triggered at session end (existing flow)

**Retro skill enhancement:**
- Currently outputs narrative retrospective
- Add JSON export: `{ tests_run: number, tests_passed: number, blockers: [item], work_summary: string }`
- Triggered at session end (existing flow)

**ijfw_metrics tool:**
- Already outputs tokens, cost, sessions, model routing
- No enhancement needed — cloud agents consume directly

**Git data:**
- Cloud agents read directly via `git log --since` (all repos under C:\dev)
- No enhancement needed

### Layer 2: Scheduled Aggregation (New Cloud Agents)

**Daily Agent** (runs 6 AM every day)
- Input: git commits (last 24h from agent start time), staged JSON from session wrap, ijfw metrics (today)
- Processing: aggregate commits by repo, count skills, sum tokens, identify model mix
- Output: markdown report → artifact + commit to `docs/reports/daily/YYYY-MM-DD.md`
- Retention: keep artifacts 90 days, auto-delete older ones; git history kept forever

**Weekly Agent** (runs 6 AM every Sunday)
- Input: 7 daily JSON files + git commits (this week)
- Processing: rollup totals, compute averages, detect trends (↑↓ indicators), identify busiest days
- Fallback: if a daily JSON missing (daily agent failed), skip that day's data + continue (no abort)
- Output: markdown report → artifact + commit to `docs/reports/weekly/YYYY-W##.md` (ISO 8601 week format, e.g. 2026-W29)

### Layer 3: Output

**Artifact:**
- Published via Artifact tool (private by default, shareable)
- User can view anywhere, PC off

**Repo commit:**
- Committed to `docs/reports/` directory
- Historical record, included in git blame/log

## Daily Report Format

```
# Daily Report: 2026-07-19

## Metrics

| Metric | Count |
|--------|-------|
| Commits | 3 |
| Files Changed | 12 |
| Skills Invoked | 5 (brainstorming, writing-plans, code-review, caveman, schedule) |
| Tests Run | 23 |
| Tests Passed | 22 |
| Tokens Used | 156,000 |
| Models Used | haiku (60%), opus (40%) |

## Summary

[Narrative from session wrap: top work items, blockers, highlights]

## Breakdown by Repo

- c:\dev: 2 commits (feat: xyz, fix: abc)
- toolforge: 1 commit (docs: update)

## Tokens by Model

- haiku: 93,600 (60%)
- opus: 62,400 (40%)
```

## Weekly Report Format

```
# Weekly Report: Week of 2026-07-14

## Weekly Totals

| Metric | Total | Daily Avg | Trend |
|--------|-------|-----------|-------|
| Commits | 18 | 2.6 | ↑ |
| Files Changed | 87 | 12.4 | ↔ |
| Skills Invoked | 42 | 6 | ↓ |
| Tests Run | 156 | 22.3 | ↑ |
| Tests Passed | 149 | 21.3 | ↑ |
| Tokens Used | 1,247,000 | 178,143 | ↑ |

## Busiest Days

1. Monday (7/14): 4 commits, 287K tokens
2. Wednesday (7/16): 3 commits, 245K tokens
3. Friday (7/18): 3 commits, 198K tokens

## Top Skills

1. brainstorming (12 invocations)
2. code-review (8)
3. writing-plans (7)

## Model Mix

- haiku: 65% (↑5% from last week)
- opus: 35% (↓5%)

## Summary

[Narrative: week summary, milestones completed, blockers, patterns]
```

## Data Sources

| Source | Frequency | Format |
|--------|-----------|--------|
| git log (all repos) | Real-time | Commits + messages |
| Session wrap JSON | Per session | Commits, skills, tokens, model |
| ijfw_metrics | Per session | Tokens, cost, model routing |
| Retro JSON | Per session | Tests, blockers, summary |

## Implementation Phases

### Phase 0: Verification (Pre-Implementation)
- Verify PowerShell + `git log --since` works across all repos under C:\dev (encoding, path separators)
- Test `git log --since "24 hours ago"` on 3+ repos
- Verify schedule tool timezone mapping (6 AM in user's local TZ, not UTC)
- Document results before Phase 1

### Phase 1: Enhance Existing Skills (Parallel)
- Modify session-wrap to export JSON (schema v1.0 as defined)
- Modify retro to export JSON
- Commit enhancements to git

### Phase 2: Create Daily Agent
- Scaffold cloud agent via `/schedule` skill
- Implement data aggregation logic
- Test with 1-day backfill
- Deploy

### Phase 3: Create Weekly Agent
- Scaffold cloud agent via `/schedule` skill
- Implement rollup + trend logic
- Test with 1-week backfill
- Deploy

### Phase 4: Backfill + Verify
- Run both agents with historical data (3-day lookback)
- Verify artifacts + commits are clean
- Verify no data loss or duplication

## Technical Constraints

- Cloud agent runtime: max ~5 min per execution (schedule skill limit)
- Git operations must handle concurrent repos cleanly
- Artifact publishing requires valid markdown
- All repos must be discoverable from `C:\dev` root

## Success Criteria

- ✓ Daily report published and committed every 24h
- ✓ Weekly report published and committed every Sunday
- ✓ Zero missing data points (git commits, tokens, skills)
- ✓ Reports readable/navigable as artifacts
- ✓ Historical record in git (can `git log docs/reports/`)
- ✓ Setup requires zero manual data entry from user

## Resolved Issues (from caveman review)

- ✓ JSON schema for session-wrap defined (schema v1.0, required fields specified, nullability rules)
- ✓ "Since yesterday midnight" changed to "last 24h from agent start" (handles clock skew)
- ✓ Artifact retention policy locked: keep 90 days, auto-delete older; git history kept forever
- ✓ Weekly fallback defined: skip missing daily JSONs, continue (no abort)
- ✓ Report path format specified: ISO 8601 weeks (YYYY-W##)
- ✓ PowerShell + git verification added as Phase 0 (pre-implementation)
- ✓ TZ mapping verification added to Phase 0

## Open Questions / Deferred

- Whether to include cross-repo skips/errors in reports (e.g., repo with no commits that day)

## Rollout Plan

1. Write spec ← you are here
2. User reviews + approves (caveman review findings incorporated)
3. Invoke writing-plans for implementation plan
4. Execute Phase 0 (verification: PowerShell + git, TZ mapping)
5. Dispatch Phase 1 (skill enhancements) in parallel with Phase 2/3
6. Test backfill with 3-day history
7. Go live with first daily report

---

**Next:** User review, then writing-plans for implementation plan.
