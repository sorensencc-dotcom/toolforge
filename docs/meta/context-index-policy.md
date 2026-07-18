# Context Index Policy

**Version:** 1.0  
**Status:** Active  
**Owner:** Governance  
**Last Updated:** 2026-07-18

## Purpose

Prevent agent context bloat by maintaining `agent-scan.ignore` — a canonical exclusion list for files kept in git but irrelevant to agent scans.

## Problem

171,000+ files in repo (with node_modules/generated content). Agent discovery-time increases linearly. Lockfiles alone: 184 files, 15.68 MB.

## Solution

Two-file model:

| File | Purpose |
|------|---------|
| `.gitignore` | Exclude from version control (committed) |
| `agent-scan.ignore` | Exclude from agent context load (committed) |

## agent-scan.ignore Structure

Categories:

```
# Generated directories (safe to ignore)
node_modules/, dist/, build/, .next/, coverage/

# Auto-regenerated reports (noisy, always stale)
audit/COWORK-*.md, dashboard.html, skills/SKILLPACK-*.md

# Dependency locks (large, redundant)
package-lock.json, yarn.lock, pnpm-lock.yaml

# Session/temporary data
.context/retros/, *.tmp, *.log
```

Current stats (2026-07-18):
- **Lockfiles excluded:** 184 files, 15.68 MB
- **Discovery-time baseline:** 1,170 .md files in docs/ (pre-filter)
- **Expected post-exclusion:** ~1,050 files (11% reduction from lockfiles alone)

## Refresh Cycle

**Trigger:** Per-phase charter

**Process:**

1. Phase charter opened → Tier 1 adds gate: `[ ] Validate agent-scan.ignore`
2. Executor validates before dispatch:
   ```bash
   # Check for orphaned exclusions (paths no longer exist)
   # Check for new dirs not yet excluded (node_modules nesting)
   ```
3. Update if stale:
   - New generated dirs found → add to agent-scan.ignore
   - Obsolete exclusions → remove (keep git clean)
4. Commit before phase execution

## Enforcement

**Pre-execution validation:**

```powershell
# Pseudocode: validate agent-scan.ignore rules match repo state
foreach ($exclusion in agent-scan.ignore) {
  $paths = Get-ChildItem -Recurse -Path $exclusion
  if ($paths.Count -gt 1000) {
    Flag("$exclusion has $($paths.Count) items — review for split")
  }
}
```

**Caveman review:**

- Flag any new generated dirs not in agent-scan.ignore
- Flag stale exclusions (paths no longer exist)
- Approve refresh before phase ships

## Rules

1. **Do not hardcode paths** — Use glob patterns (e.g., `**/node_modules/` not `/home/user/...`)
2. **Document why** — Every exclusion has a comment (generated, temporary, third-party, noisy)
3. **Measure impact** — Before/after discovery-time baseline
4. **Never delete .gitignore entries** — Move to agent-scan.ignore if needed

## Related

- `agent-scan.ignore` — Actual exclusion list
- `.gitignore` — Git-level exclusions (lockfiles added Wave A)
- `/docs/meta/skill-operator-guide.md` — Context consolidation (companion effort)

## Token Savings (Projected)

| Metric | Baseline | Post-Wave-A | Post-Wave-B |
|--------|----------|------------|-----------|
| Files in scan | 1,170 | 1,050 (~11%) | TBD |
| Lockfiles | 184 files, 15.68 MB | Excluded | — |
| Agent load time | ~12s (est.) | ~10.5s (est.) | TBD (post-duplication) |
| Weekly impact (20 sessions) | — | ~8–15 KB/week | TBD |

