---
name: drift-2026-07-11-005-skill-governance-incomplete
description: Wrote skill governance without understanding toolforge architecture. Defined auto-install rule but no mechanism exists. Skill not registered.
metadata: 
  node_type: memory
  type: project
  severity: critical
  incident_date: 2026-07-11
  status: open
  originSessionId: 9837535e-c768-4223-a214-59099185e3e1
---

## Drift Incident: DRIFT-2026-07-11-005

**Severity**: 🔴 Critical  
**Status**: ✅ CLOSED (fixed 2026-07-12)  
**Date**: 2026-07-11 19:15 UTC  
**Fix**: See [[drift-2026-07-11-005-fix]]

---

## What Happened

Created skill governance rules without understanding toolforge architecture:

1. **Governance Rule Created**: "Skills auto-install to toolforge library on merge to main"
   - File: `kb-sync/docs/governance/skill-approval-rules.md`
   - Commit: 2013bd9

2. **Reality**: Toolforge skills use different format
   - TypeScript/JavaScript implementation
   - Require skill.json + src/ + tests/ + docs/
   - Manual registration in manifest.json

3. **Gap**: kb-sync bash scripts (like obsidian:ingest-wiki) not registered
   - Script exists: `modules/obsidian/ingest-wiki.sh`
   - Not in: `toolforge/skills/obsidian-ingest-wiki/` (doesn't exist)
   - Not in: `toolforge/manifest.json` (no entry)

4. **Breaking Governance**: Claimed auto-install doesn't happen

---

## Root Cause

Wrote governance before:
- Understanding toolforge skill structure (TypeScript, not bash)
- Checking how kb-sync bash skills register in toolforge
- Verifying registration mechanism exists

Assumptions made:
- "Auto-install" meant commit → toolforge
- Didn't check if bash skills need wrapping
- Didn't check if separate registries exist

---

## Impact

1. Skill governance incomplete/misleading
2. Skill not discoverable in toolforge library
3. Future skills may follow wrong process
4. Governance credibility damaged

---

## Required Fixes

1. **Clarify Architecture**:
   - Do kb-sync bash skills need TypeScript wrappers for toolforge?
   - Do they register separately or via manual process?
   - What's the actual mechanism?

2. **Update Governance**:
   - Rewrite `docs/governance/skill-approval-rules.md` with correct process
   - Document kb-sync vs toolforge skill registration paths
   - Remove/correct "auto-install" claim until mechanism exists

3. **Register Skill**:
   - Either wrap obsidian:ingest-wiki as toolforge skill (TypeScript)
   - Or manually register in toolforge manifest
   - Or update governance to clarify it's kb-sync-only

4. **Audit Other Governance**:
   - Check if other rules in CLAUDE.md + governance doc have gaps
   - Verify before publishing to memory/production

---

## Next Steps

1. User clarifies: kb-sync bash skills → how do they reach toolforge?
2. Update governance docs with correct process
3. Register obsidian:ingest-wiki (wrapper or manual)
4. Close incident with corrected docs

---

## Files Involved

- `kb-sync/docs/governance/skill-approval-rules.md` (WRONG governance)
- `kb-sync/CLAUDE.md` (references wrong governance)
- `kb-sync/modules/obsidian/ingest-wiki.sh` (unregistered skill)
- `toolforge/manifest.json` (missing skill entry)

---

## Lesson

Don't write governance before understanding system architecture. Verify mechanism exists before claiming it.
