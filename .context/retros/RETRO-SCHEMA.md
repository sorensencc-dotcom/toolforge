# Retro JSON Schema (Canonical v1.0)

**Effective:** 2026-07-19 onwards  
**Authority:** Tier 1 (standardization decision)  
**Prior:** Drift across 2026-07-12 → 2026-07-17 (3 incompatible versions)

## Rationale

Weekly retro JSON schema drifted across three incompatible versions (metrics nested/flattened/differently-nested; field names changed; test metrics dropped; commit types as percentages vs counts). Trend analysis became impossible. Canonical v1.0 unifies useful fields across all three versions, prioritizes consistency, and locks the structure for durability.

## Schema (JSON)

```json
{
  "date": "YYYY-MM-DD",
  "window": "7d",
  "since": "YYYY-MM-DDTHH:MM:SS",
  "until": "YYYY-MM-DDTHH:MM:SS",
  "base_branch": "main",
  "prior_retro_baseline": ".context/retros/YYYY-MM-DD-N.json",
  
  "metrics": {
    "commits": <int>,
    "commits_no_merge": <int>,
    "contributors": <int>,
    "automation_commits": <int>,
    
    "insertions_raw": <int>,
    "deletions_raw": <int>,
    "net_loc_raw": <int>,
    "insertions_filtered": <int>,
    "deletions_filtered": <int>,
    "net_loc_filtered": <int>,
    "filter_note": "<string explaining exclusions (lockfiles, auto-gen, etc)>",
    
    "test_loc_insertions": <int>,
    "test_ratio_pct": <float>,
    
    "feat_pct": <float>,
    "fix_pct": <float>,
    "docs_pct": <float>,
    "chore_pct": <float>,
    "test_pct": <float>,
    
    "active_days": <int>,
    "sessions": <int>,
    "deep_sessions": <int>,
    "peak_hour": <int>,
    "late_night_commits_22_to_04": <int>,
    
    "team_streak_days": <int>,
    "personal_streak_days": <int>,
    "backlog_open_todos": <int>,
    "backlog_closed_this_period": <int>,
    
    "version_range": ["v1.0.0", "v1.2.3"],
    "release_commits": <int>,
    "focus_area": "<string>"
  },
  
  "authors": {
    "<name>": {
      "commits": <int>,
      "role": "human|automation",
      "insertions": <int (optional)>,
      "deletions": <int (optional)>,
      "test_ratio": <float (optional)>,
      "top_area": "<string (optional)>"
    }
  },
  
  "note": "<string for caveats, metadata, schema exceptions>",
  
  "session_focus": {
    "summary": "<string: 1-3 sentences of what was shipped/fixed>",
    "commits_this_session_range": "<string: git log range if applicable>",
    "incidents": [
      "<string: brief description of notable incident>"
    ],
    "process_learnings": [
      "<string: actionable learning from this session>"
    ]
  },
  
  "external_repos_note": "<string (optional): activity in linked repos>"
}
```

## Field Definitions

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `date` | string | yes | Retro date, YYYY-MM-DD |
| `window` | string | yes | Lookback window, typically "7d" |
| `since` / `until` | ISO8601 | yes | Exact time range boundaries |
| `base_branch` | string | yes | Primary branch, typically "main" |
| `prior_retro_baseline` | path | yes | Pointer to previous baseline for trend calculation |
| `commits` | int | yes | Total commits (include merge commits) |
| `commits_no_merge` | int | yes | Commits excluding merges |
| `contributors` | int | yes | Unique contributors |
| `automation_commits` | int | yes | Commits by bots/automation (typically release-bot, cowork-daemon) |
| `insertions_raw` / `deletions_raw` | int | yes | Raw stats including lockfiles |
| `net_loc_raw` | int | yes | insertions - deletions (raw) |
| `insertions_filtered` / `deletions_filtered` | int | yes | Stats excluding package-lock.json, yarn.lock, auto-gen reports |
| `net_loc_filtered` | int | yes | insertions - deletions (filtered) |
| `filter_note` | string | yes | Document what was excluded and why |
| `test_loc_insertions` | int | yes | Lines of test code added |
| `test_ratio_pct` | float | yes | Test ratio as percentage (test_loc / net_loc_filtered * 100) |
| `feat_pct` / `fix_pct` / `docs_pct` / `chore_pct` / `test_pct` | float | yes | Commit-type percentages (total = ~100%) |
| `active_days` | int | yes | Days with commits |
| `sessions` | int | yes | Total claude-code sessions |
| `deep_sessions` | int | yes | Sessions lasting > 30 min |
| `peak_hour` | int | yes | Hour of day with most commits (0–23) |
| `late_night_commits_22_to_04` | int | yes | Commits between 22:00–04:59 |
| `team_streak_days` | int | yes | Consecutive days with team commits |
| `personal_streak_days` | int | yes | Consecutive days with human commits |
| `backlog_open_todos` | int | yes | Open todos in TODOS.md |
| `backlog_closed_this_period` | int | yes | Todos closed this window |
| `version_range` | array | yes | [min_version, max_version] released in window |
| `release_commits` | int | yes | Automated release commits |
| `focus_area` | string | yes | Primary dir/system worked on (e.g., "skills/", "docs/") |
| `authors` | object | yes | Per-author breakdown |
| `note` | string | yes | Caveats, schema exceptions, concurrent-session flags |
| `session_focus` | object | yes | Context: what was delivered, incidents, learnings |
| `external_repos_note` | string | no | Activity in sibling repos (charlie-deep-research, etc.) |

## Migration Notes (2026-07-19)

Files to update to canonical v1.0:
- **2026-07-12-1.json**: Migrate `metrics{}` fields (already structured, minimal changes)
- **2026-07-12-2.json**: Same as above
- **2026-07-14-1.json**: Merge `metrics{}` nesting
- **2026-07-15-1.json**: Re-nest top-level fields into `metrics{}`, rename `loc_*` back to `insertions|deletions`, restore test_ratio_pct calculation
- **2026-07-15-2.json**: Same as above
- **2026-07-16-*.json**: Add missing LOC/test_ratio fields for trend continuity
- **2026-07-17-1.json** through **2026-07-17-7.json**: Restore LOC metrics, test_ratio, add missing commit-type percentages

## Validation

Before accepting a retro JSON:
1. ✓ All required fields present (no null/undefined except optional fields)
2. ✓ Field types match schema (int, float, string, array, object)
3. ✓ Numeric ranges sensible (commits > 0, percentages sum ~100%, active_days ≤ window_days)
4. ✓ Timestamps valid ISO8601
5. ✓ prior_retro_baseline points to a real, earlier file
6. ✓ Authors list matches contributors count
7. ✓ Incidents/learnings documented if session_focus present

## Change Log

### v1.0 (2026-07-19)
- Initial canonical version
- Unified 3 incompatible drift schemas
- Locked structure for durability
- Prioritized: consistency over field count, trend-ability over per-retro context
