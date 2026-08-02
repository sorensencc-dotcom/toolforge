# TRM sync-treatment followups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a factKey false-positive collision bug in `trm`'s sync-treatment matching, add a daily automation wrapper for `trm sync-treatment`, and close out the stale `TODOS.md` backlog entry.

**Architecture:** One pure-function fix in `trm/src/sync/factIdentity.ts` (empty-normalize fallback to raw text), one new PowerShell agent script + one new PowerShell schedule-registration script mirroring the existing `daily-report-agent.ps1` / `setup-daily-report-schedule.ps1` pair, and a documentation edit to `TODOS.md`.

**Tech Stack:** TypeScript (trm, Jest), PowerShell 7 (pwsh), Windows Task Scheduler (registration only, not auto-run).

## Global Constraints

- Genuine dedup behavior (case/punctuation-only differences of otherwise-identical text) MUST keep merging exactly as before — verified against `trm/tests/sync/factIdentity.test.ts`'s existing passing tests.
- Scheduled Task registration (`scripts/setup-trm-sync-treatment-schedule.ps1`) must NOT be run automatically as part of this plan — it modifies Windows Task Scheduler and requires explicit user go-ahead at execution time (per spec "Out of scope").
- `trm` refuses to run against any path inside a git repo with a remote (root-safety guard) — the agent script must invoke `trm` with `--vault-root`/`--narrative-root` pointing at the real vault (`C:\Users\soren\trm-vault`) and narrative repo (`C:\dev\charlie-deep-research`), run from a cwd outside any git repo with a remote, or set `TRM_ALLOW_GIT_ROOT=1` only if that cwd constraint can't be met.
- All new script output follows the existing `daily-report-agent.ps1` logging convention: `Write-Host` progress lines, log file under `C:\dev\logs\`.

---

### Task 1: Fix factKey empty-normalize collision bug

**Files:**
- Modify: `trm/src/sync/factIdentity.ts` (the `factKey` function, currently the last export in the file)
- Test: `trm/tests/sync/factIdentity.test.ts`

**Interfaces:**
- Consumes: existing `normalize(text: string): string` (unchanged) from the same file.
- Produces: `factKey(fact: { source_id: string; text: string }): string` — same signature as before, callers (`trm/src/sync/matching.ts`, `trm/src/cli/commands/syncTreatment.ts`) need no changes.

- [ ] **Step 1: Write the failing tests**

Add to `trm/tests/sync/factIdentity.test.ts`, inside the existing `describe('factKey', ...)` block (append after the last `it(...)`):

```ts
  it('keeps distinct keys for different all-punctuation/non-Latin text from the same source (regression: empty-normalize collision)', () => {
    const a = factKey({ source_id: 'SRC-016', text: '"' });
    const b = factKey({ source_id: 'SRC-016', text: 'реакто' });
    const c = factKey({ source_id: 'SRC-016', text: '%' });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('still merges identical all-punctuation text from the same source', () => {
    const a = factKey({ source_id: 'SRC-016', text: '"' });
    const b = factKey({ source_id: 'SRC-016', text: '"' });
    expect(a).toBe(b);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd trm && npx jest tests/sync/factIdentity.test.ts -t "empty-normalize"`
Expected: FAIL on the first new test — `a`, `b`, and `c` are all equal (all normalize to `""`, so all three currently hash to the same key for `SRC-016`).

- [ ] **Step 3: Implement the fix**

Replace the `factKey` function in `trm/src/sync/factIdentity.ts`:

```ts
export function factKey(fact: { source_id: string; text: string }): string {
  const normalized = normalize(fact.text);
  const keyText = normalized.length > 0 ? normalized : fact.text.trim();
  return crypto.createHash('sha256').update(`${fact.source_id}|${keyText}`).digest('hex');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd trm && npx jest tests/sync/factIdentity.test.ts`
Expected: PASS, all tests in the file including the two new ones and all pre-existing ones (case/punctuation dedup still works because `normalize()` itself is untouched — only the empty-string fallback changed).

- [ ] **Step 5: Run the full trm test suite**

Run: `cd trm && npm test`
Expected: PASS. `matching.ts` and `syncTreatment.ts` consume `factKey` but don't inline its logic, so no other test files should be affected. If any other test fails, read it before assuming it's this change — check whether it was already failing before this task (`git stash` the fix, rerun, compare).

- [ ] **Step 6: Rebuild and verify against the real vault**

```bash
cd trm && npm run build
```

Then from a cwd outside any git repo (e.g. the vault root itself):

```bash
cd /c/Users/soren/trm-vault && node /c/dev/trm/dist/cli/index.js sync-treatment --narrative-root /c/dev/charlie-deep-research --dry-run
```

Expected: the `benson-ford` factKey collision count drops from 10 pairs to only the genuine near-duplicates (case/punctuation-only differences of otherwise-identical text — e.g. `"Sorenson, C. cont."` / `"Sorenson, C. Cont."`, `"Box 68"` / `"BOX 68"`, `"Top"` / `"TOP"`, `"Manager"` / `"Manager."`). Read the generated `TRM_SYNC_REPORT_DRYRUN_*.md` in `C:\dev\charlie-deep-research\treatment\` to confirm no new topics are skipped and no false-positive collisions remain (spot-check the reported pairs' raw `text` fields the same way this was verified during design — pull each colliding id's `text` from `topics/charlie/benson-ford/extracts/extract.json` and confirm they're genuinely near-identical, not just both punctuation/non-Latin garbage).

- [ ] **Step 7: Commit**

```bash
cd trm
git add src/sync/factIdentity.ts tests/sync/factIdentity.test.ts
git commit -m "fix(sync): stop factKey collapsing distinct non-normalizable text to the same key"
git push
```

---

### Task 2: Daily automation agent script

**Files:**
- Create: `scripts/trm-sync-treatment-agent.ps1`
- Reference (read-only, do not modify): `scripts/daily-report-agent.ps1` (logging/structure pattern to follow)

**Interfaces:**
- Consumes: `node C:\dev\trm\dist\cli\index.js sync-treatment [topic] --narrative-root <path> [--dry-run]` (Task 1's fixed binary, already built in Task 1 Step 6). Exit code 0/1/2 per `SyncTreatmentResult['exitCode']` (`trm/src/cli/commands/syncTreatment.ts`).
- Produces: appends a dated section to `C:\dev\TODOS.md` and writes `C:\dev\memory\session-wrap-<date>-trm-sync-treatment-auto.md` — no other task consumes these programmatically, they're for human/session review.

- [ ] **Step 1: Write the script**

Create `scripts/trm-sync-treatment-agent.ps1`:

```powershell
# TRM sync-treatment Daily Agent v1.0
# Runs a dry-run reconciliation across all TRM vault topics; if there's
# anything new (facts, skips, collisions), commits the real run and appends
# a summary to TODOS.md + a memory file.

param(
    [string]$VaultRoot = "C:\Users\soren\trm-vault",
    [string]$NarrativeRoot = "C:\dev\charlie-deep-research",
    [string]$TrmCli = "C:\dev\trm\dist\cli\index.js",
    [string]$TodosPath = "C:\dev\TODOS.md",
    [string]$MemoryDir = "C:\Users\soren\.claude\projects\c--dev\memory",
    [DateTime]$AgentStartTime = (Get-Date)
)

$ErrorActionPreference = "Stop"
$dateStamp = $AgentStartTime.ToString("yyyy-MM-dd")
$logDir = "C:\dev\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logPath = Join-Path $logDir "trm-sync-treatment-$dateStamp.log"

function Write-Log {
    param([string]$Message)
    $line = "[$((Get-Date).ToString('HH:mm:ss'))] $Message"
    Write-Host $line
    Add-Content -Path $logPath -Value $line
}

Write-Log "AGENT_STARTED|trm-sync-treatment-v1.0|$($AgentStartTime.ToString('yyyy-MM-dd HH:mm:ss'))"

if (-not (Test-Path $VaultRoot)) {
    Write-Log "ERROR: vault root not found at $VaultRoot"
    exit 1
}
if (-not (Test-Path $TrmCli)) {
    Write-Log "ERROR: trm CLI not built at $TrmCli (run 'npm run build' in C:\dev\trm)"
    exit 1
}

Push-Location $VaultRoot
try {
    Write-Log "Running dry-run reconciliation..."
    $dryRunOutput = & node $TrmCli sync-treatment --narrative-root $NarrativeRoot --dry-run 2>&1
    $dryRunExit = $LASTEXITCODE
    $dryRunOutput | ForEach-Object { Write-Log "  $_" }

    $hasNewFacts = $dryRunOutput -join "`n" -match "new facts"
    $hasCollisions = ($dryRunOutput | Select-String "factKey collision").Count -gt 0
    $hasSkips = $dryRunOutput -join "`n" -match "skipped"

    if (-not $hasNewFacts -and -not $hasCollisions -and -not $hasSkips) {
        Write-Log "No new facts, collisions, or skips. Nothing to report. Exiting cleanly."
        Pop-Location
        exit 0
    }

    $realExit = $dryRunExit
    if ($hasNewFacts -and -not $hasCollisions) {
        Write-Log "New facts found, no collisions. Running real reconciliation..."
        $realOutput = & node $TrmCli sync-treatment --narrative-root $NarrativeRoot 2>&1
        $realExit = $LASTEXITCODE
        $realOutput | ForEach-Object { Write-Log "  $_" }
    } else {
        Write-Log "Collisions present or no new facts — skipping real run, dry-run report stands."
    }
} finally {
    Pop-Location
}

# Build summary
$summaryLines = @()
$summaryLines += "### Automated TRM sync-treatment run: $dateStamp"
$summaryLines += ""
if ($hasCollisions) {
    $collisionLines = $dryRunOutput | Select-String "factKey collision"
    $summaryLines += "- factKey collisions found (topic skipped, needs manual review):"
    foreach ($c in $collisionLines) { $summaryLines += "  - $($c.Line.Trim())" }
}
if ($hasSkips) {
    $skipLines = $dryRunOutput | Select-String "skipped"
    $summaryLines += "- Skipped topics:"
    foreach ($s in $skipLines) { $summaryLines += "  - $($s.Line.Trim())" }
}
if ($hasNewFacts -and -not $hasCollisions) {
    $summaryLines += "- New facts reconciled into treatment doc (real run committed)."
}
$summaryLines += ""
$summary = $summaryLines -join "`n"

# Append to TODOS.md under a dedicated section (create the section if absent)
$todosContent = Get-Content -Path $TodosPath -Raw
$sectionHeader = "## Automated: TRM sync-treatment"
if ($todosContent -notmatch [regex]::Escape($sectionHeader)) {
    Add-Content -Path $TodosPath -Value "`n$sectionHeader`n"
}
Add-Content -Path $TodosPath -Value $summary
Write-Log "Appended summary to $TodosPath"

# Write memory file
if (-not (Test-Path $MemoryDir)) { New-Item -ItemType Directory -Path $MemoryDir -Force | Out-Null }
$memoryPath = Join-Path $MemoryDir "session-wrap-$dateStamp-trm-sync-treatment-auto.md"
$memoryContent = @"
---
name: session-wrap-$dateStamp-trm-sync-treatment-auto
description: "Automated daily trm sync-treatment run: $dateStamp"
metadata:
  type: project
---

Automated run of ``trm sync-treatment`` against $VaultRoot -> $NarrativeRoot.

$summary
"@
Set-Content -Path $memoryPath -Value $memoryContent -Encoding UTF8
Write-Log "Wrote memory file: $memoryPath"

Write-Log "trm-sync-treatment-agent complete. Exit code: $realExit"
exit $realExit
```

- [ ] **Step 2: Smoke-test the script manually (dry-run path, no real changes)**

Run:

```powershell
pwsh -NoProfile -File C:\dev\scripts\trm-sync-treatment-agent.ps1
```

Expected: script completes without throwing, prints `AGENT_STARTED` and either "Nothing to report" or a summary block, log file appears under `C:\dev\logs\trm-sync-treatment-<date>.log`. Because `benson-ford` will still show its ~4 genuine collisions after Task 1's fix, expect the "collisions present — skipping real run" branch on this first run. Confirm by reading the log file.

- [ ] **Step 3: Verify TODOS.md and memory file were written correctly**

```bash
tail -30 C:\dev\TODOS.md
```

Expected: a `## Automated: TRM sync-treatment` section with today's dated entry listing the benson-ford collisions. Confirm the memory file exists at `C:\Users\soren\.claude\projects\c--dev\memory\session-wrap-<date>-trm-sync-treatment-auto.md` and has valid frontmatter (matches the format used by other files in that directory).

- [ ] **Step 4: Commit**

```bash
git add scripts/trm-sync-treatment-agent.ps1
git commit -m "feat(scripts): add trm sync-treatment daily automation agent"
git push
```

(Do NOT commit the TODOS.md/memory-file output from the manual smoke test in this commit — those are real content, handled in Task 4's TODOS.md commit alongside the manual backlog cleanup, to keep this commit scoped to the script itself. If the smoke test already appended to TODOS.md, that's fine — it'll just be included in Task 4's commit instead.)

---

### Task 3: Schedule registration script (write only, do not run)

**Files:**
- Create: `scripts/setup-trm-sync-treatment-schedule.ps1`
- Reference (read-only, do not modify): `scripts/setup-daily-report-schedule.ps1` (pattern to mirror exactly)

**Interfaces:**
- Consumes: nothing from other tasks at write-time; at run-time (not part of this plan) it would invoke `scripts/trm-sync-treatment-agent.ps1` from Task 2 via a Scheduled Task action.
- Produces: nothing consumed by later tasks — this script is written but explicitly NOT executed as part of this plan.

- [ ] **Step 1: Write the script**

Create `scripts/setup-trm-sync-treatment-schedule.ps1`:

```powershell
#!/usr/bin/env pwsh
<#
.SYNOPSIS
Register Windows scheduled task for daily trm sync-treatment reconciliation.

.DESCRIPTION
Creates a Windows Task Scheduler task that runs trm-sync-treatment-agent.ps1
every day at 6:30 AM (after the 6:00 AM morning-ingestion task).
Requires admin privileges.
#>

param(
  [switch]$Force = $false
)

$taskName = "toolforge-trm-sync-treatment"
$taskPath = "\toolforge\"
$script = "C:\dev\scripts\trm-sync-treatment-agent.ps1"

if (-not (Test-Path $script)) {
  Write-Host "[ERROR] Script not found: $script" -ForegroundColor Red
  exit 1
}

$admin = [Security.Principal.WindowsIdentity]::GetCurrent().Groups -contains `
  "S-1-5-32-544"

if (-not $admin) {
  Write-Host "[ERROR] Admin privileges required. Run as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "TRM sync-treatment Daily Task Registration" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  if (-not $Force) {
    Write-Host "[!] Task already exists. Use -Force to overwrite." -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Removing existing task..." -ForegroundColor Cyan
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false | Out-Null
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory "C:\dev"

$trigger = New-ScheduledTaskTrigger `
  -Daily `
  -At "06:30"

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -MultipleInstancePolicy IgnoreNew

Write-Host "Registering task: $taskName" -ForegroundColor Cyan
Write-Host "  Schedule: Daily at 6:30 AM" -ForegroundColor Gray
Write-Host "  Script: $script" -ForegroundColor Gray
Write-Host "  Timeout: 1 hour" -ForegroundColor Gray

try {
  Register-ScheduledTask `
    -TaskName $taskName `
    -TaskPath $taskPath `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Daily trm sync-treatment reconciliation" `
    -RunLevel Highest `
    -Force | Out-Null

  Write-Host ""
  Write-Host "[OK] Task registered successfully." -ForegroundColor Green
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Green
  Write-Host "  View task: Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Run now:   Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  Write-Host "  Logs:      C:\dev\logs\trm-sync-treatment-*.log" -ForegroundColor Gray
} catch {
  Write-Host "[ERROR] Failed to register task: $_" -ForegroundColor Red
  exit 1
}
```

- [ ] **Step 2: Verify script syntax without running it**

```powershell
pwsh -NoProfile -Command "$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content C:\dev\scripts\setup-trm-sync-treatment-schedule.ps1 -Raw), [ref]$null); Write-Host 'Syntax OK'"
```

Expected: `Syntax OK`, no parse errors. Do NOT run the script itself — registration requires explicit user approval (separate step, outside this plan).

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-trm-sync-treatment-schedule.ps1
git commit -m "feat(scripts): add trm sync-treatment schedule registration script (not yet run)"
git push
```

---

### Task 4: Close out TODOS.md backlog entry

**Files:**
- Modify: `TODOS.md`

**Interfaces:**
- Consumes: nothing programmatic — this is a documentation edit reflecting Tasks 1-3's completion.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Locate and update the backlog line**

In `TODOS.md`, find the line:

```
- [ ] **TRM-scan-to-treatment sync skill** — pull all updated TRM topics (`trm validate`/`extract.json` diffs across `trm-vault/topics/**`) and reconcile new facts into the CIC documentary treatment doc. Currently manual/ad-hoc; should be a repeatable skill, not a one-off session task. See `memory/session-wrap-2026-07-28-benson-ford-close.md`.
```

Replace it with:

```
- [x] **TRM-scan-to-treatment sync skill** (2026-08-02) — `trm sync-treatment` CLI shipped 2026-07-29 (see `memory/session-wrap-2026-07-29-sync-treatment-shipped.md`); this entry was stale. Follow-ups closed out: `michigan-flight-museum` extract gap resolved (extract.json now present, topic syncs clean), `benson-ford` factKey false-collision bug fixed (`trm/src/sync/factIdentity.ts` — empty-normalize text was collapsing distinct non-Latin/punctuation-only fragments to the same key; genuine near-dupes still merge correctly). Daily automation added: `scripts/trm-sync-treatment-agent.ps1` (dry-run + conditional real run + TODOS/memory reporting) and `scripts/setup-trm-sync-treatment-schedule.ps1` (Task Scheduler registration, written but not yet run — needs explicit approval to register). See `docs/superpowers/specs/2026-08-01-trm-sync-treatment-followups-design.md`.
```

- [ ] **Step 2: Verify the edit**

```bash
grep -A1 "TRM-scan-to-treatment sync skill" TODOS.md
```

Expected: shows the `[x]` line with today's date, no leftover `[ ]` duplicate.

- [ ] **Step 3: Commit**

```bash
git add TODOS.md
git commit -m "docs(todos): close stale TRM sync-treatment backlog entry"
git push
```

(If Task 2's smoke test already appended a `## Automated: TRM sync-treatment` section to `TODOS.md` with real content, include that in this same commit rather than discarding it — it's genuine output from the manual verification run.)
