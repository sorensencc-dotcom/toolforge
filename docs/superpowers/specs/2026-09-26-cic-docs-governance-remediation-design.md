---
title: "CIC Docs / Governance Remediation — Design"
status: approved
date: 2026-09-26
---

# CIC Docs / Governance Remediation — Design

## Problem

The 2026-09-26 documentation audit (Codex-reviewed, Rev. 3) found:

1. `CIC_DOCS_INDEX.md` references 11 files that don't exist.
2. `docs/meta/governance/` is referenced by `CIC-GOVERNANCE/` and `GOVERNANCE.md` but has no
   reverse index — a reader there can't tell who depends on it.
3. `CIC-GOVERNANCE/README.md` says `NOT OPERATIONAL`; `runtime-status.json` and
   `gate-registry.json` say operational/active. Same system, contradicting claims.
4. `gate-implementation-status.md` is hand-synced against 3 JSON registries and has already
   drifted once (documented in its own text).
5. `CIC-GOVERNANCE/` (the actual ratified-state source) is absent from the published MkDocs
   site.
6. No durable Codex-validation-report artifact class exists.
7. `docs/archive/projects/castironforge/` (34,453 files) is 100% untracked by git — ownership
   and recoverability unconfirmed, must not be deleted blind.

## Approach

- Items 1-2: fix directly (additive documentation, no governance-authority change).
- Items 3, 5, 6: draft as **proposal documents** in `CIC-GOVERNANCE/proposals/` for Tier 1
  ratification. Do not change canonical status files.
- Item 4: build the generator script as a **candidate** (`--dry-run` by default, writes to a
  `.candidate.md` file) — do not wire it to overwrite the hand-maintained file until Tier 1
  approves cutover.
- Item 7: investigation checklist only, output is a findings doc, not a deletion.

## Out of scope

- Merging `docs/` and `rewrite-mcp/docs/` into one MkDocs instance (audit Section 6 workflow
  proposal #3) — separate, larger effort, not part of this remediation pass.
- Nav-completeness CI check — separate tooling effort.
