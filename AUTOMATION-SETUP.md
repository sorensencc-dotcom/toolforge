# Toolforge Automation Infrastructure

Unified CI/CD automation for Toolforge Phase-1. Three integrated systems:

## System 1: CI Pipeline (`ci-pipeline.ps1`)

**Purpose:** Deterministic, gated validation chain

**Stages:**
1. **Validator** (blocking) — skill validation, manifests, registry
2. **Metadata Generator** — skillpack schemas, dependencies
3. **Dependency Graph** — cycle detection, orphan analysis
4. **Runtime Health Checks** (blocking) — skill availability, execution
5. **Cowork Auto-Sync** (optional) — registry synchronization

**Exit Codes:**
- `0` = all stages passed
- `1` = blocking failure (validator/runtime)
- `2` = warnings only (metadata/graph/cowork)

**Usage:**
```powershell
# Full pipeline
.\ci-pipeline.ps1

# Single stage
.\ci-pipeline.ps1 -Stage validator

# Skip cowork (default)
.\ci-pipeline.ps1 -SkipCowork
```

**Logs:** `C:\dev\toolforge\logs\ci\ci-pipeline-TIMESTAMP.log`

---

## System 2: Git Hook Pipeline (`setup-git-hooks.ps1`)

**Purpose:** Pre-commit/post-merge gating

**Hooks:**
- **Pre-commit** (fast) — validator only, blocks commit on failure
- **Post-merge** (integration) — full pipeline (minus cowork), warns on issues

**Exit Behavior:**
- Pre-commit: exit 1 = block commit
- Post-merge: exit 0 = allow merge (warnings logged, not blocking)

**Installation:**
```powershell
# Install hooks
.\setup-git-hooks.ps1 -Action Install -Repo "C:\dev\cic"

# Check status
.\setup-git-hooks.ps1 -Action Status -Repo "C:\dev\cic"

# Test hooks
.\setup-git-hooks.ps1 -Action Test -Repo "C:\dev\cic"

# Remove hooks
.\setup-git-hooks.ps1 -Action Uninstall -Repo "C:\dev\cic"
```

**Logs:** `C:\dev\toolforge\logs\hooks\hooks.log`

---

## System 3: Multi-Repo Orchestrator (`multi-repo-orchestrator.ps1`)

**Purpose:** Coordinate CI validation across all 7 registered repos

**Registry:** `C:\dev\repo-registry.json`

**Repos Orchestrated:**
1. cic (governance pipeline)
2. cic-ingestion (autonomy API)
3. cic-runtime (runtime engine)
4. cic-ui (dashboard)
5. rewrite-mcp (MCP servers)
6. claude-skills (skill definitions)
7. toolforge (automation infrastructure)

**Features:**
- Sequential or parallel execution
- Configurable stage selection
- Skip specific repos
- Aggregated reporting
- Exit code propagation

**Usage:**
```powershell
# Full orchestration (all repos, all stages)
.\multi-repo-orchestrator.ps1

# Validator stage only (fast)
.\multi-repo-orchestrator.ps1 -Stage validator

# Parallel execution
.\multi-repo-orchestrator.ps1 -Parallel

# Skip specific repos
.\multi-repo-orchestrator.ps1 -SkipRepos "claude-skills,toolforge"

# Generate report from existing logs
.\multi-repo-orchestrator.ps1 -ReportOnly
```

**Exit Codes:**
- `0` = all repos passed
- `1` = blocking failure in any repo
- `2` = warnings in any repo

**Logs:**
- Full log: `C:\dev\toolforge\logs\orchestrator\orchestrator-TIMESTAMP.log`
- Per-repo logs: `C:\dev\toolforge\logs\orchestrator\repo-{name}-TIMESTAMP.log`
- Report: `C:\dev\toolforge\logs\orchestrator\orchestrator-report-TIMESTAMP.json`

---

## Unified Setup (`setup-all-automation.ps1`)

**Purpose:** One-command installation & testing

**Actions:**
```powershell
# Setup everything
.\setup-all-automation.ps1

# Skip git hooks
.\setup-all-automation.ps1 -SkipGitHooks

# Skip Task Scheduler
.\setup-all-automation.ps1 -SkipScheduler

# Test after setup
.\setup-all-automation.ps1 -Action Test

# Check status
.\setup-all-automation.ps1 -Action Status

# Cleanup all
.\setup-all-automation.ps1 -Action Cleanup
```

---

## Task Scheduler Integration (`setup-ci-scheduler.ps1`)

**Purpose:** Automated nightly + startup runs

**Tasks Registered:**
- `Toolforge-CI-Pipeline` — on startup (requires elevation)
- `Toolforge-CI-Nightly` — daily 21:00

**Actions:**
```powershell
# Register tasks
.\setup-ci-scheduler.ps1 -Action Register

# List tasks
.\setup-ci-scheduler.ps1 -Action List

# Test task
.\setup-ci-scheduler.ps1 -Action Test

# Unregister
.\setup-ci-scheduler.ps1 -Action Unregister
```

---

## Architecture Diagram

```
Commit Hook (pre-commit)
    ↓
Validator [FAST GATE]
    ↓
Commit succeeds / blocked

Post-Merge Hook
    ↓
Full Pipeline (validator → metadata → graph → health)
    ↓
Warnings logged, merge allowed

Task Scheduler (nightly 21:00)
    ↓
Multi-Repo Orchestrator
    ↓
All 7 repos validated
    ↓
Aggregated report
    ↓
Exit code for downstream (CI/alerts)
```

---

## Log Locations

| Component | Log Path | Contents |
|-----------|----------|----------|
| CI Pipeline | `logs/ci/*.log` | Stage-by-stage execution |
| Git Hooks | `logs/hooks/hooks.log` | Hook install/test/execution |
| Orchestrator | `logs/orchestrator/*.log` | Multi-repo coordination |
| Orchestrator Report | `logs/orchestrator/orchestrator-report-*.json` | Structured results |

---

## Environment Assumptions

- PowerShell 7+ (pwsh)
- Windows 11 Pro (Task Scheduler)
- Git (for hook installation)
- All 7 repos must have valid package.json (Node.js projects)
- `C:\dev\toolforge\utilities\` contains validators/generators/checkers

---

## Exit Code Reference

Used by downstream CI gates, notifications, rollback logic:

| Code | Meaning | Action |
|------|---------|--------|
| 0 | All passed | Continue pipeline |
| 1 | Blocking failure | Stop, alert ops/ML |
| 2 | Warnings | Continue, log telemetry |
| -1 | Infrastructure error | Retry or manual review |

---

## Troubleshooting

**Git hooks not triggering:**
- Verify `.git/hooks/pre-commit` and `post-merge` exist
- Check hook files are executable (chmod +x)
- Ensure CI script path in hook is absolute

**Orchestrator stuck:**
- Check `logs/orchestrator/` for per-repo logs
- Verify all 7 repos in registry.json have valid paths
- Run single-repo test: `.\ci-pipeline.ps1 -Stage validator`

**Task Scheduler failures:**
- Startup task requires elevation; normal behavior
- Check Windows Task Scheduler UI for error details
- Review logs: `logs/ci/ci-pipeline-*.log`

**Exit code confusion:**
- Exit 2 is non-blocking; used for warnings/deprecations
- Exit 1 must be resolved before proceeding
- Exit -1 indicates infrastructure/scripting error

---

## Next: Deploy to Production

1. Verify all three systems pass tests: `.\setup-all-automation.ps1 -Action Test`
2. Install Task Scheduler: `.\setup-ci-scheduler.ps1 -Action Register`
3. Install git hooks per-repo: `.\setup-git-hooks.ps1 -Action Install -Repo "C:\dev\{repo}"`
4. Monitor logs for 1 week
5. Configure alerts on exit code 1 in orchestrator reports
