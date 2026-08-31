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
  
  "external_repos_note": "<string (optional): activity in linked repos>",

  "test_health": {
    "total_test_files": <int>,
    "tests_added_this_period": <int>,
    "test_files_changed": <int>,
    "regression_test_commits": <int (optional)>
  },

  "backlog": {
    "total_open": <int>,
    "p0_p1": <int>,
    "p2": <int>,
    "completed_this_period": <int>
  },

  "tweetable": "<string: one-line shareable summary>"
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
| `test_health` | object | no | Repo-wide test-file stats, distinct from `test_loc_insertions`/`test_ratio_pct` (which are commit-diff LOC metrics). Omit entire object if no test files found. |
| `test_health.total_test_files` | int | no | **Repo-wide** count of files matching `*.test.*`/`*.spec.*`/`*_test.*`/`*_spec.*` (excl. node_modules), NOT scoped to the retro window — generator cmd 10. A large jump vs a prior retro's `test_loc_insertions` is not inflation; they measure different things. |
| `test_health.tests_added_this_period` | int | no | New test files added within the window (`git log --diff-filter=A` on test-file paths) |
| `test_health.test_files_changed` | int | no | Distinct test files touched (added or modified) within the window — generator cmd 12 |
| `test_health.regression_test_commits` | int | no | Commits matching `test(qa):`/`test(design):`/`test: coverage` grep — generator cmd 11 |
| `backlog` | object | no | Snapshot of TODOS.md backlog state; omit if TODOS.md absent. Distinct object from top-level `backlog_open_todos`/`backlog_closed_this_period` scalars — both may appear for the same period, kept for back-compat with pre-test_health retros |
| `backlog.total_open` / `p0_p1` / `p2` / `completed_this_period` | int | no | Open-by-priority breakdown + closed-this-window count |
| `tweetable` | string | no | One-line shareable summary, e.g. "Week of Aug 1: 89 commits (2 contributors), 6.8k LOC, 17.7% tests, 24 releases, peak: 10pm" |

## Test LOC Calculation Rules & Methodology Policy

To prevent multi-pass retro variance (e.g. 82% discrepancy between retro runs covering identical windows):

1. **Canonical Test File Pattern**:
   - `**/*.test.{js,ts,mjs,jsx,tsx,ps1}`
   - `**/*.spec.{js,ts,mjs,jsx,tsx,ps1}`
   - `**/tests/**/*`
   - `**/test/**/*`
   - Exclude build outputs (`dist/`, `build/`), mock data fixtures, and external vaults.

2. **Commit Window Boundaries**:
   - `since` timestamp must strictly match the start of the retro window (e.g., `YYYY-MM-DDT00:00:00-04:00`).
   - `version_range` start tag must consistently match the first release tag issued within the specified timestamp window.

3. **Methodology Variance Policy**:
   - Large metric swings (>10%) between retro passes covering the same window are invalid and indicate ad-hoc regex or commit window drift.
   - Repeated retro passes within the same session must re-use identical test glob filters and commit range boundaries.


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

### v1.1 (2026-08-11)
- Documented `test_health`, `backlog` (object), and `tweetable` fields — present in generator output since gstack-retro SKILL.md added them (2026-08-08 retro, `.context/retros/2026-08-08-1.json:58-68`) but never added to this schema doc. Undocumented `total_test_files` (repo-wide, not window-scoped) caused a false-alarm "13x inflation" flag when compared against window-scoped `test_loc_insertions`.

### v1.0 (2026-07-19)
- Initial canonical version
- Unified 3 incompatible drift schemas
- Locked structure for durability
- Prioritized: consistency over field count, trend-ability over per-retro context
