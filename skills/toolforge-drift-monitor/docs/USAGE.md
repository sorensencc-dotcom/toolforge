# Toolforge Drift Monitor Usage Guide

Detects synchronization drift between canonical and distributed Toolforge instances.

## When to Use

- **Weekly preventive scan** — Catch drift early, prevent 21+ item failures
- **Post-resync validation** — Confirm sync completed successfully
- **Before deployment** — Ensure distributed instance is operational
- **On-demand** — Manual check anytime

## How to Invoke

### Option A: Schedule (Recommended)

```powershell
# Daily at 09:00 UTC via Windows Task Scheduler
# Registered during toolforge setup-task-scheduler
```

### Option B: Manual

```powershell
cd C:\dev\toolforge
& ".\sync-tools\multiRepoRoadmapSync\multiRepoRoadmapSync.cjs"
```

### Option C: Via Skill

```bash
npx toolforge drift-monitor --check all
```

## Output

### Pass (OK)

```text
✅ NO DRIFT DETECTED
- Canonical: 42 files (v1.1.0)
- Distributed: 41 files (v1.1.0)
- Status: SYNCED
```

### Warning (WARNING)

```text
⚠️ MINOR DRIFT
- Missing: 2 files in distributed
- Recommend: Manual resync
```

### Critical (CRITICAL)

```text
❌ CRITICAL DRIFT
- Missing: 21+ items
- Action: STOP. Resync required. See drift/DRIFT-REPORT.md
```

## Report Format

Generates `C:\dev\toolforge\drift\DRIFT-REPORT.md` showing:

- File count parity
- Version alignment  
- Tool implementation completeness
- Documentation presence
- Overall sync status (OK | WARNING | CRITICAL)

## Troubleshooting

### "Command not found"

Ensure Node.js 20+ installed: `node --version`

### "Path not found"

Canonical Toolforge must exist at `C:\dev\toolforge\`

### Report shows CRITICAL

Stop. Run manual resync. See docs/meta/global-operating-rules-cic-rewrite-labs.md for resync procedures.

## Implementation Details

**Wraps:** `C:\dev\toolforge\sync-tools\multiRepoRoadmapSync\multiRepoRoadmapSync.cjs`

**Runs:** Node.js 20+ CommonJS module

- Compares canonical vs distributed
- Generates DRIFT-REPORT.md
- Returns exit code 0 (OK), 1 (WARNING), 2 (CRITICAL)

## Historical Evidence

- Canonical v1.1.0 (2026-06-28)
- Distributed synced (26 files)
- Task Scheduler operational (daily 09:00 UTC sync)

## See Also

- `docs/meta/global-operating-rules-cic-rewrite-labs.md` — Tool lifecycle rules
- `sync-tools/multiRepoRoadmapSync/` — Implementation
- `drift/DRIFT-REPORT.md` — Latest scan results
