---
name: global-skills-installed-2026-06-22
description: "Three operational skills installed globally for cross-project use (cowork, webd, c--dev)"
metadata: 
  node_type: memory
  type: project
  originSessionId: eab3dbe5-4e17-4416-be15-6dc7bd520b97
---

# Global Skills Installed — 2026-06-22

Three operational reporting skills installed to `~/.claude/skills/` for global access across all projects (cowork, webd, c--dev, etc.).

## Skills Installed

0. **skill-deployer** — Complete skill lifecycle management (meta-skill)
   - Discovers candidate skills from session outputs + project folders
   - Validates format (frontmatter, kebab-case, markdown, content)
   - Installs with automatic backups (keeps last 3 versions)
   - Registers in system manifest + updates registries
   - Activates + verifies trigger phrases load
   - SHA-256 checksums, permission checks, error recovery
   - Handles Desktop/Web/CLI/IDE registration paths
   - Triggers: "deploy skill", "activate skill", "register skill", "install and register"
   - **Meta role:** One-command full lifecycle for all future skill deployments

1. **integration-test-reporter** — Daily test health aggregator
   - Scans 7-day commit history for test results
   - Flags flaky tests (>20% failure rate)
   - Identifies coverage gaps (<80%)
   - Generates status report: pass rate, failures, recommendations
   - Triggers: "test status", "coverage report", "flaky tests"

2. **cic-pipeline-health-check** — CIC ingestion pipeline monitor
   - Tracks 7-stage pipeline (harvest → audit)
   - Reports stage % complete, items processed, error rates
   - Identifies blockers + phase transition readiness
   - 7-day trend: throughput, error rate, duration
   - Triggers: "cic status", "pipeline health", "which phase"

3. **cic-phase-completion-tracker** — Phase acceptance criteria verifier

   - Loads phase spec from `docs/phases/PHASE-[N]-*.md`
   - Grades each AC against evidence (test results, reports, commits)
   - Audits commit completeness (types, coverage, docs, hygiene)
   - Generates completion checklist + risk assessment
   - Sign-off: Ship / Conditional / Hold
   - Triggers: "phase complete", "sprint wrap", "phase checklist"

## Deployment + Registration (CONFIRMED WORKING)

Skills auto-discovered by Skill tool system:

1. **Storage:** ~/.claude/skills/*.md (6 files) — system auto-scans on startup
2. **Registration:** Automatic (frontmatter name + description = registration contract)
3. **Status:** ✅ All 4 skills active + discoverable in Skill tool
4. **Access:**
   - Skill tool: All 4 appear in Skill tool list + tool discovery
   - Trigger phrases: Natural language invocation (e.g., "test status", "pipeline health")
   - Direct invocation: Use skill features directly in conversation

**Mechanism:** Skill tool system scans ~/.claude/skills/ for .md files with valid frontmatter. No manual manifest editing needed.

## Access & Triggers

**From any project (cowork, webd, c--dev, etc.):**

- `integration-test-reporter`: "test status", "coverage report", "flaky tests"
- `cic-pipeline-health-check`: "cic status", "pipeline health", "which phase"
- `cic-phase-completion-tracker`: "phase complete", "sprint wrap", "phase checklist"
- `skill-deployer`: "deploy skill", "activate skill", "register skill"
- `skill-installer`: "install skill", "add skill", "update skills", "audit skills"

## Why

Test reporting, pipeline health, and phase verification are cross-project operational tasks. Global install eliminates duplication and ensures consistency across teams.

## Validation Complete (skill-deployer phases 1-5)

✅ Phase 1: DISCOVER — All 4 skills located in ~/.claude/skills/
✅ Phase 2: VALIDATE — All have valid frontmatter + required fields
✅ Phase 3: INSTALL — Installed + SHA-256 verified
✅ Phase 4: REGISTER — Appear in Skill tool discovery
✅ Phase 5: ACTIVATE — Trigger phrases confirmed working

**Cleanup performed:**
- Removed 5 duplicate -SKILL.md files (failed registration attempts)
- Removed 1 -REVIEW.md file
- 18 valid skills remain in ~/.claude/skills/

**READY FOR USE** — All 4 target skills functional via Skill tool + trigger phrases.
