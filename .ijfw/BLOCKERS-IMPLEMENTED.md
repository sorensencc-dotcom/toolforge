# Blocker Detection Implementation

Implemented 2026-07-19. Three systems to catch environmental, git, and token issues before they block work.

## Deployed

### 1. Session-Start Checklist (`.ijfw/startup-checklist.ps1`)

Verifies:
- Runtime (Node.js ✓, npm ✓)
- Codex CLI on PATH + responsive
- Network (DNS ✓, HTTPS)
- Git (repo clean, no conflicts, branches fetched)
- Database (if DATABASE_URL set)

**Usage**: `.ijfw/startup-checklist.ps1` at session start

**Test result**: ✓ Runs successfully. Reports blockers and guidance clearly.

---

### 2. Phase-Gate Git Guard (`.ijfw/phase-gate-git-guard.ps1`)

Runs before & after each phase boundary to catch concurrent-session race conditions.

**Usage**:
```powershell
.ijfw/phase-gate-git-guard.ps1 -Phase "A" -Before
# ... do phase A work ...
.ijfw/phase-gate-git-guard.ps1 -Phase "A" -After
```

**Logs**: `.ijfw/phase-gates/PHASE-*.log` (per-phase audit trail)

---

### 3. Token Budget Gate (`.claude/hooks/token-budget-gate.js`)

Auto-blocking hook. Blocks Edit/Bash if session exceeds thresholds without a plan.

**Thresholds**:
- LOC_THRESHOLD = 50,000 (cumulative edits)
- COMMIT_THRESHOLD = 200 (branch commits)

**Logic**: 
- If (LOC > 50k OR commits > 200) AND no plan locked → BLOCK with guidance
- Otherwise → PASS

**Wired**: PreToolUse hook in `.claude/settings.json`

**Bypass**: `$env:LOC_THRESHOLD = 999999` (per-session override)

---

## Integration

| Tool | Trigger | Config |
|------|---------|--------|
| startup-checklist.ps1 | Manual | None (run anytime) |
| phase-gate-git-guard.ps1 | Manual | None (run before/after phases) |
| token-budget-gate.js | Automatic | `.claude/settings.json` PreToolUse |

---

## Documentation

Full guide: `.ijfw/BLOCKERS-README.md`

Covers:
- What each tool checks
- Exit codes & log files
- Recommended workflow
- FAQ & debugging

---

## Why These Three

**Problem**: 
- Codex CLI hangs silently (2x observed) → blocks work indefinitely
- Git race conditions mid-session (concurrent clones, cowork daemon) → mysterious merge failures
- Token budget overruns (72k LOC in one session) → wastes tokens on mid-stream replanning

**Solution**:
1. **Startup checklist** — Fail fast on environmental issues before they hide for 30 minutes
2. **Phase gates** — Catch concurrent-session collisions early (fetch + status between phases)
3. **Token budget** — Force `/plan mode` before large code phases (compress token waste)

All three prevent silent hangs, race conditions, and expensive surprises.

---

## Next Steps

Manual adoption:
1. Add to session start: `.ijfw/startup-checklist.ps1`
2. Before each phase: `.ijfw/phase-gate-git-guard.ps1 -Phase "<letter>" -Before`
3. After each phase gate: `.ijfw/phase-gate-git-guard.ps1 -Phase "<letter>" -After`
4. Token gate auto-blocks on high LOC (transparent)

All three can be skipped, but they've caught the issues you flagged in ~2 sessions.
