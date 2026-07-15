# KB Sync Nightly Skill

Automated knowledge base synchronization and artifact generation. Runs Stage 1 (sync) automatically on schedule; Stage 2 (artifact generation) integrates with the `kb-sync-artifact-generator` skill for interactive report creation.

## Two-Stage Pipeline

### Stage 1: Synchronization (Automatic)
- **When:** Nightly schedule (configurable)
- **What:** Syncs CIC and project docs into the wiki via `npm run kb:sync:all`
  - NotebookLM target: flattens repo, creates knowledge pack, backs up source
  - Obsidian target: optional (skipped if vault not configured)
- **Output:** Knowledge pack files in `.nlm_pack/`
- **Status:** ✅ Fully operational

### Stage 2: Artifact Generation (Skill-Integrated)
- **Trigger:** Manual via `kb-sync-artifact-generator` skill
- **What:** Analyzes synced content, generates interactive HTML report with:
  - Broken link detection & impact scoring
  - Actionable recommendations
  - Category-based filtering & dashboard
  - WCAG AA accessibility compliance
- **Output:** `_integration/kb-sync-interactive-report.html`
- **Status:** ✅ Skill phase 2 complete, ready for Cowork integration

## Usage

### Automated (Stage 1 only)
```bash
# Runs on configured schedule via Cowork automation
# Default: Daily at configured time
```

### Manual (Stage 2)
```bash
# Invoke the artifact generator skill from Cowork or Claude Code
kb-sync-artifact-generator
# or
/kb-sync-artifact-generator
```

## Files

- **src/run.sh** — Bash orchestrator (Stage 1)
- **SKILL.md** — Skill definition for Cowork
- **README.md** — This file

## Configuration

Scheduling is configured in Cowork automation settings. Artifact generation is configured in the `kb-sync-artifact-generator` skill.

## Integration Notes

**Cowork Integration Path:**
1. Install `kb-sync-artifact-generator` skill
2. Create Cowork artifact bound to `_integration/kb-sync-interactive-report.html`
3. Artifact auto-updates after each Stage 2 run

**Future Enhancement:**
- Combine into single automated workflow (Stage 1 → Stage 2) once Cowork MCP integration is finalized

## Phase History

- **Phase 1** (2026-07-10): KB Sync nightly shell script + scheduling
- **Phase 2** (2026-07-12): Artifact generator skill (impact scoring, dashboards)
- **Phase 3** (2026-07-13): Directory cleanup fix, two-stage pipeline documentation

## Status

✅ **Operational** — Stage 1 fully automated; Stage 2 ready for skill invocation
