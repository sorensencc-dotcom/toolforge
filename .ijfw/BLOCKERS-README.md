# Blocker Detection & Prevention

Three tools to catch environmental issues, git race conditions, and token overruns before they block work.

## 1. Session Startup Checklist

**File**: `.ijfw/startup-checklist.ps1`

Verifies environment before work begins. Catches silent hangs (codex CLI), network issues, git state problems.

### Usage

```powershell
# At session start
.ijfw/startup-checklist.ps1

# Verbose output
.ijfw/startup-checklist.ps1 -Verbose
```

### What It Checks

| Check | Blocker? | Notes |
|-------|----------|-------|
| Node.js available | Yes | Required for `npm` scripts |
| npm available | Yes | Should come with Node.js |
| codex on PATH | Yes | If hanging, run: `taskkill /F /IM codex.exe` |
| codex responsive | Warning | Test with `--version` (short timeout) |
| DNS resolution | Yes | `github.com` must be reachable |
| HTTPS connectivity | Yes | `api.github.com` must be reachable |
| Git available | Yes | Required for all work |
| In git repo | Yes | Current directory must be a repo |
| Repo is clean | Yes | No uncommitted changes allowed |
| No merge conflicts | Yes | Must resolve before proceeding |
| Branches fetched | Warning | Run `git fetch --all` to sync |
| PostgreSQL reachable | Warning | Only checked if `DATABASE_URL` set |

### Exit Codes

- **0** = All checks passed. Safe to start work.
- **1** = Blockers detected. Fix before proceeding.

---

## 2. Phase-Gate Git Guard

**File**: `.ijfw/phase-gate-git-guard.ps1`

Logs git state before & after each phase boundary. Detects concurrent-session race conditions early.

### Usage

```powershell
# Before starting phase A work
.ijfw/phase-gate-git-guard.ps1 -Phase "A" -Before

# After phase A gate passes (before moving to B)
.ijfw/phase-gate-git-guard.ps1 -Phase "A" -After
```

### What It Checks

1. **Fetch all branches** — Syncs remote refs. Detects if another session pushed.
2. **No uncommitted changes** — Blocks if you have staged/unstaged work.
3. **Not detached HEAD** — Ensures you're on a branch.
4. **No merge conflicts** — Would block the phase.
5. **Branch tracking correct** — Checks commits ahead of upstream.
6. **Audit trail** — Logs last 3 commits for traceability.

### Log Files

Logs saved to `.ijfw/phase-gates/PHASE-A.log`, `.ijfw/phase-gates/PHASE-B.log`, etc.

```
[HH:mm:ss] [GATE] === PHASE A PRE-GATE ===
[HH:mm:ss] [CHECK] Fetching all branches...
[HH:mm:ss] [AUDIT] Last 3 commits:
[HH:mm:ss] [AUDIT]   abc1234 fix: token budget gate
[HH:mm:ss] [PASS] === GATE PASS ===
```

### Exit Codes

- **0** = Gate passed. Phase work is safe.
- **1** = Critical state detected (conflicts, detached HEAD, etc.).

### Recommended Workflow

```
Start Work Session
  ↓
.ijfw/startup-checklist.ps1
  ↓ (if pass)
git fetch --all && git status
  ↓
PHASE A: Design/Planning
  ↓
.ijfw/phase-gate-git-guard.ps1 -Phase "A" -Before
  ↓
[Claude Code work on Phase A]
  ↓
.ijfw/phase-gate-git-guard.ps1 -Phase "A" -After
  ↓
PHASE B: Implementation
  ↓
[repeat for each phase]
```

---

## 3. Token Budget Gate

**File**: `.claude/hooks/token-budget-gate.js`

Blocks Edit/Bash until `/plan mode` if session scale is high (lots of LOC or commits).

Prevents token overruns by forcing planning before large code changes.

### How It Works

**Thresholds** (configurable via environment variables):
- `LOC_THRESHOLD=50000` — Cumulative line edits this session
- `COMMIT_THRESHOLD=200` — Commits in working branch

**Logic**:
```
If (LOC > 50k OR commits > 200) AND (no plan locked):
  → BLOCK Edit/Bash tools
  → Message: "Enter /plan mode to lock phase strategy"
Else:
  → PASS (proceed normally)
```

### Overriding

To bypass for this session:

```powershell
$env:LOC_THRESHOLD = 999999
$env:COMMIT_THRESHOLD = 999999
```

This disables the gate for the current PowerShell session only.

### Auto-Lock on `/plan`

When you enter `/plan mode` and exit with a locked plan, the gate creates:

```
.ijfw/plan-locked.json
```

This file signals: "Strategy is planned, proceed with confidence."

Deleted automatically at session end.

### Why This Matters

Large sessions (50k+ LOC edits or 200+ commits) without planning tend to:
1. Waste tokens on mid-stream strategy changes
2. Create hard-to-review PRs
3. Miss architectural decisions until late

Forcing `/plan` first:
- Locks design decisions early
- Creates checkpoint if session needs to resume
- Compresses token usage (plan → execute, not execute → replan)

---

## Integration

All three are automatically active:

| Tool | Trigger | When |
|------|---------|------|
| **startup-checklist.ps1** | Manual | Run at session start: `.ijfw/startup-checklist.ps1` |
| **phase-gate-git-guard.ps1** | Manual | Run before/after each phase: `.ijfw/phase-gate-git-guard.ps1 -Phase "A" -Before` |
| **token-budget-gate.js** | Automatic (hook) | Runs before every Edit/Bash tool if LOC+commits high |

---

## Logs & Diagnostics

### Where to Find Logs

- **Startup checks**: Output to console only (no persistent log)
- **Phase gates**: `.ijfw/phase-gates/PHASE-*.log` (one per phase)
- **Token budget**: Logged to stderr when hook blocks

### Reading Phase Gate Logs

```powershell
# View logs for Phase A
Get-Content .ijfw/phase-gates/PHASE-A.log

# Follow latest phase (PowerShell 7+)
Get-Content .ijfw/phase-gates/PHASE-A.log -Wait
```

### Debugging

If startup-checklist reports "codex responsive ~ (warning)":

```powershell
# Check if codex hangs
codex --version

# If it hangs (no output for 10+ sec), kill it
taskkill /F /IM codex.exe

# Check if codex is on PATH
Get-Command codex

# If not found, add to PATH
$env:PATH += ';~/.codex/.sandbox-bin/'
codex --version
```

---

## FAQ

**Q: What if phase-gate reports "Uncommitted changes"?**  
A: Stash them before the gate: `git stash`. Then re-run the gate.

**Q: Do I have to use these?**  
A: Startup checklist is optional but recommended. Phase gates are optional. Token budget gate is automatic but can be bypassed with env vars.

**Q: Can I configure thresholds?**  
A: Yes:
- Token budget: `$env:LOC_THRESHOLD = 100000` (then gate checks at 100k)
- Phase gates: Hard-coded (change script if needed)
- Startup: All checks are hard-coded

**Q: Will this slow me down?**  
A: No. Startup checklist is ~3 seconds. Phase gates are ~1 second each. Token gate is <100ms per tool use. All save time by preventing 30-minute debugging sessions from silent hangs or git race conditions.
