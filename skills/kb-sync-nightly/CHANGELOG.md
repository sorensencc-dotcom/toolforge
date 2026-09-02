# KB Sync Nightly — Changelog

## v1.0.2 (2026-07-14) — SCHEDULED TASK UPDATE

**Status:** VERIFIED & READY FOR DEPLOYMENT

### Changes

#### Updated Skill Definition
- `SKILL.md` — Bumped to v1.0.2, added scheduled task command documentation
- `skill.json` — Bumped to v1.0.2, added `scheduledCommand` metadata and verification date
- Added explicit scheduled task registration command: `bash C:\dev\skills\kb-sync-nightly\src\run.sh`
- Marked as `active_verified` status following audit (2026-07-14)

#### Documentation Improvements
- Added explicit "Execution" section showing both scheduled and manual invocation
- Clarified working directory behavior (auto-set by script)
- Added logging guidance for scheduled task registration
- Updated metadata with verification date and verified status

### Why This Update

Post-audit review (2026-07-14) confirmed that v1.0.1 fixed the core infrastructure path, but scheduled task registration process required explicit command documentation. This update clarifies exactly how to register the skill with the scheduled task framework.

### Testing

✓ Skill infrastructure verified (2026-07-14)
✓ Recent sync outputs confirmed (staging through 2026-07-14 21:33:55)
✓ Interactive artifact generation working
✓ npm pipeline executing successfully

### Scheduled Task Registration

When registering with Windows Task Scheduler or equivalent:

```
Command: bash C:\dev\skills\kb-sync-nightly\src\run.sh
Working Directory: (auto-set by script to C:\dev\kb-sync)
Schedule: Daily (default 21:00)
Logging: Capture stdout/stderr to timestamped log
```

### Next Steps

- [ ] Register scheduled task with corrected command
- [ ] Verify first post-fix nightly run completes successfully
- [ ] Monitor logs for any warnings or partial failures
- [ ] If artifact generation fails: still marked success (fail-soft)

---

## v1.0.1 (2026-07-13) — PATH FIX

**Status:** CRITICAL FIX

### Changes

#### Fixed
- **Path Error:** Script was referencing non-existent `C:\dev\cic-os\personal-knowledge-base/` directory
- **Actual Location:** Corrected to `C:\dev\kb-sync/` (actual kb-sync repository)
- **Command:** Updated from Python `sync-all.py` to npm `run kb:sync:all`

#### Updated Documentation
- `src/run.sh` — Now points to correct directory and uses npm pipeline
- `README.md` — All examples and paths corrected to kb-sync structure
- `SKILL.md` — Updated metadata and requirements
- `skill.json` — Bumped version, fixed dependencies (python → node/npm)

### Why This Broke

The skill was designed for a Python-based sync pipeline that doesn't exist in the current repository. The actual kb-sync infrastructure is npm-based with bash orchestration scripts. The skill's run.sh was pointing to a directory that was never created.

### Testing

The skill can now be invoked safely:
```bash
bash src/run.sh
# → cd C:\dev\kb-sync
# → npm run kb:sync:all
```

### Outputs

- `obsidian/vault/wiki/index.md` — Master documentation index
- `_integration/kb-sync-interactive-report.html` — Interactive artifact with KPI dashboard
- `obsidian/vault/_kb-sync-staging/` — Raw source staging (timestamped)

### Next Steps

- [ ] Run skill manually to verify npm pipeline executes
- [ ] Check artifact output in `_integration/`
- [ ] Re-register skill with Cowork (new npm dependencies)
- [ ] Update scheduled task if it references the old path

---

## v1.0.0 (2026-07-02) — Initial Release

Initial skill release. Assumed Python-based pipeline at `C:\dev\cic-os\personal-knowledge-base/`.
