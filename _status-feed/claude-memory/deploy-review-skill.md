---
name: deploy-review-skill
description: "Automated deployment verification skill. 5-phase verification (preflight, startup, tests, E2E, risk gate). Bash + PowerShell variants. Reports JSON. Blocks on critical failures."
metadata: 
  node_type: memory
  type: project
  created: 2026-06-21
  originSessionId: 2595e5c1-e91c-4649-bb40-64c2c2b1249e
---

## Deploy-Review Skill v1.0.0

Transformed manual DEPLOYMENT_FIXES_COMPLETED.md checklist into **automated, repeatable skill**. Verifies full docker-compose stack (15 services) before staging/production deployment.

## Files Created

- **scripts/deploy-review.sh** — Main POSIX implementation (240 lines)
- **scripts/deploy-review.ps1** — PowerShell variant (250 lines)
- **scripts/skills/deploy-review.skill.json** — Skill definition for Claude Code CLI
- **scripts/skills/DEPLOY_REVIEW_SKILL.md** — Full documentation

## 5-Phase Verification

| Phase | Check | Blocks? | Time |
|-------|-------|---------|------|
| 1. Pre-Flight | Config syntax, schema mounts, Dockerfiles | ✓ No | 2–3s |
| 2. Startup | 15 services health (parallel), logs on failure | ✓ Yes | 30–45s |
| 3. Tests | cic-runtime + cic-governance npm test | ✓ Yes | 15–25s |
| 4. E2E | Agent deploy, governance proposal, policy validation | ✗ Advisory | 5–10s |
| 5. Risk Gate | Classify failures, generate report, block on critical | ✓ Yes | < 1s |

## Key Improvements Over Manual

| Manual | Automated |
|--------|-----------|
| Copy-paste curl commands | Automated health polling (3s intervals, 30s timeout) |
| Sequential service checks | Parallel health checks (faster feedback) |
| Manual test command | Runs in container via docker-compose exec |
| Interpret logs manually | Auto-captures last 30 lines on failure |
| One-off verification | Repeatable, trackable via JSON report |
| No gate decision | Policy-based: blocks if CRITICAL failures exist |
| No rollback path | On failure: `docker-compose down` (documented) |

## Usage

```bash
# Local full verification
./scripts/deploy-review.sh --env local

# Staging dry-run (no startup)
./scripts/deploy-review.sh --env staging --dry-run

# Production fast-track (skip tests)
./scripts/deploy-review.sh --env prod --skip-tests
```

Exit code: 0 = PASS (deployment approved), 1 = FAIL (blocked)

## Report Output

**deploy-review-report.json**
```json
{
  "timestamp": "2026-06-21T14:30:00Z",
  "environment": "local",
  "result": "PASS",
  "duration_seconds": 92,
  "critical_failures": [],
  "services_verified": 15
}
```

## Integration Points

- **CI/CD:** Add to GitHub Actions workflow (blocks merge on failure)
- **Pre-commit:** Validate config when docker-compose.yml changes
- **Pre-deployment:** Manual gate before staging/production push
- **Monitoring:** Track performance baselines (startup time, test duration)

## Next Steps

1. **Register skill** in Claude Code CLI: copy to ~/.claude/skills/
2. **Enable auto-triggers** in skill.json (post-build, pre-merge, pre-deployment)
3. **Add to CI** workflow (.github/workflows/deploy.yml)
4. **Monitor baselines** (startup 30–45s, tests 15–25s, total ~90s)

## Why Skill Matters

Transforms deployment from **manual → repeatable process**. Ensures:
- ✓ All 15 services start
- ✓ All integration tests pass
- ✓ E2E flows work cross-service
- ✓ Risk assessed before human decision
- ✓ Consistent output (JSON report for audit trail)

**Gate:** Blocks staging/production push if any critical service fails. Prevents silent failures.

## Performance Profile

| Environment | Total Time | Startup | Tests | E2E |
|-------------|-----------|---------|-------|-----|
| Local | ~90s | 45s | 20s | 10s |
| Staging | ~90s | 45s | 20s | 10s |
| Prod | ~45s | 45s | 0s (--skip-tests) | 0s |

Dry-run (config only): < 5s
