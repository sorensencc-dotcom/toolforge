---
name: governance_retro_schema_validation_gate
description: Pre-commit hook validates retro JSON schema; blocks silently corrupt retro data from reaching repo
metadata: 
  node_type: memory
  type: project
  originSessionId: 65afdf33-c6db-4928-8454-5657614a1afc
  modified: 2026-07-22T00:31:59.561Z
---

**Incident:** 2026-07-17-7.json LOC validation failed silently. Retro files committed without schema enforcement, corrupting future session context loads.

**Gate:** Pre-commit hook now validates `.context/retros/*.json` files before commit.

**What it checks:**
- Valid JSON (ConvertFrom-Json)
- Required core fields: date, window, since, user, metrics
- Date format: YYYY-MM-DD
- Window enum: 1d, 3d, 7d, 30d
- Non-empty metrics object
- Optional: commit_breakdown, key_achievements (present in new retros but not enforced retroactively)

**Scope:**
- Only validates files written in past 7 days (recent retros)
- Skips historical retros (before 7d cutoff) to avoid retroactive breakage
- Hook scoped to `.context/retros/*.json` only, no false positives

**Backfill:** Added `"user": "Chris Sorensen"` to 15 historical retro files (2026-07-12 through 2026-07-21).

**Implementation:**
- `C:\dev\.context\retros\retro.schema.json` — Schema definition
- `C:\dev\.context\retros\validate.ps1` — Validator script (-Strict flag blocks on fail)
- `C:\dev\.context\retros\backfill-user.ps1` — One-time migration script (completed)
- `C:\dev\setup-git-hooks.ps1` — Hook generator (Gate 1 in pre-commit)

**Future tightening:** As recent retros accumulate more fields, validator can enforce them on future files (e.g., require commit_breakdown in Q3+).

**Related:** [[feedback_test_while_shipping_discipline]] (catches schema issues in tests before commit).
