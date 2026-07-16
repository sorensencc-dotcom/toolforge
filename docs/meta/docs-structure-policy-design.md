# docs/meta Restructure + Documentation Policy — Design

**Status:** Approved design, pending implementation plan.
**Date:** 2026-07-16

## Problem

`docs/meta/` holds 60+ files flat: governance rules, phase charters, specs, implementation
plans, review docs, and 2 stray `.docx` drafts. Naming is inconsistent (kebab-case,
SCREAMING_SNAKE, numbered prefixes like `1-`, `4-`). Duplicate-topic files exist
(`parallelism-matrix-template.md` at root vs `1-parallelism-matrix-template.md`). No root
index — only the `audit/` subdir has a `README.md`. `DOCS_INDEX.md` at `docs/` root only
indexes toolforge tool docs, not meta/governance content.

`docs/archive/` is a separate, unrelated problem: it holds full nested project checkouts
(`.git`, `node_modules`, build output) for CIC and castironforge, not archived documentation.
Out of scope here — flagged as a follow-up needing its own explicit confirmation (destructive
risk, much bigger blast radius).

`docs/{toolforge,wave-d,gateway,daemons,sync-tools,utilities}` are already purpose-built,
small, consistently named — not touched by this change.

## Cross-Repo Impact

34 files across the repo reference `docs/meta/...` paths, including:
- `CLAUDE.md`
- `.github/workflows/toolforge-release.yml`
- `api/telemetry/server.js`
- `assets/dashboard-v2.js`, `assets/cic-dashboard.css`
- `CIC-GOVERNANCE/**` docs
- `.ijfw/memory/plan.md`
- other `docs/meta/*.md` files referencing each other internally

Every file move must be paired with a grep-and-fix pass over all referrers, verified by a
final `grep -r "docs/meta/<old-path>"` returning zero hits before that file's move is
considered done. This is the highest-risk part of the change — treat each move as an atomic
unit (move + fix refs + verify), not a bulk rename.

## Target Structure

```
docs/meta/
  README.md                          # index, links to each subfolder
  governance/
    README.md
    global-operating-rules-cic-rewrite-labs.md
    global-rules-amendment-v1.4.md
    governance-rule-audit-first-scope-lock.md
    GOVERNANCE_UPDATE_DATA_CONTRACTS.md  -> governance-update-data-contracts.md
    TOOLFORGE-MARKETPLACE-SPEC-v1.0.md   -> toolforge-marketplace-spec-v1.0.md
    DATA_CONTRACT_SPEC.md                -> data-contract-spec.md
    IJFW_SPEC_PHASE_DATA_CONTRACT_GATE.md -> ijfw-spec-phase-data-contract-gate.md
    ijfw-spec-phase-audit-gate-integration.md
    ijfw-spec-phase-phase0-integration.md
    pre-charter-audit-checklist.md
    phase-0-pattern-research-gate-template.md
    documentation-policy.md            # this policy, extracted for discoverability
  phases/
    README.md
    phase-2b-scope-charter.md
    phase-2b1-audit-charter.md
    phase-3-cowork-gateway-charter.md
    phase-4-governance-charter.md
    phase-4-observability-contract.md
    phase-4-completion-report.md
    phase-5-multicanary-charter.md
    phase-5-exit-wave-completion.md
    phase-6-rollback-charter.md
    phase-7-*.md (charter, etcd/unleash integration specs, health-check gate)
    phase-8-gate-sign-off.md
    phase-8-toolforge-marketplace/        # existing subdir, kept as-is
    PHASE27_WAVE_E_DATA_CONTRACT.md -> phase-27-wave-e-data-contract.md
    phase-27-wave-e-retroactive-validation.md
    phase-abc-audit-phases-addition.md
    cic-ashfall-state.md
    skill-regression-backfill-charter.md
    cic-tool-surface-phase1-design.md   # phase-numbered, lives here not specs/
  plans/
    README.md
    1-parallelism-matrix-template.md -> parallelism-matrix-template.md
    2-ijfw-plan-integration-spec.md -> ijfw-plan-integration-spec.md
    3-ijfw-verify-parallelism-checks.md -> ijfw-verify-parallelism-checks.md
    4-ijfw-plan-phase-4-governance.md -> ijfw-plan-phase-4-governance.md
    4-parallelism-matrix-governance-rule.md -> parallelism-matrix-governance-rule.md
    5-ijfw-plan-observability-contract.md -> ijfw-plan-observability-contract.md
    5-ijfw-plan-phase-5-multicanary.md -> ijfw-plan-phase-5-multicanary.md
    toolforge-phase-2b-implementation-plan.md
    cic-tool-surface-phase1-plan.md
    PARALLELISM_MATRIX_DELIVERY_INDEX.md -> parallelism-matrix-delivery-index.md
    PARALLELISM_MATRIX_SYSTEM.md -> parallelism-matrix-system.md
    parallelism-matrix-retrofit-example-phase3.md
    OBSERVABILITY_PHASE_D_SUMMARY.md -> observability-phase-d-summary.md
    governance-amendment-observability-phase-d.md
  specs/
    README.md
    toolforge-phase-2b-step1-design.md
    toolforge-phase-2b-step2-design.md
    toolforge-phase-2b-charter.md
    ijfw-agent-integration-guide-v1.5.md
    audit-first-scope-lock-formalization-summary.md
  reviews/
    README.md
    toolforge-phase-2b-step2-REVIEW.md -> toolforge-phase-2b-step2-review.md
    phase-7-rollback-config-featureflag-charter-REVIEW.md -> phase-7-rollback-config-featureflag-charter-review.md
  audit/                                # existing subdir, kept as-is (already has README)
  archive/
    README.md
    CIC-GOV-MANIFEST-001_DRAFT.docx      # superseded by RECONCILED version — confirm before move
    CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx
```

Files not explicitly listed above (there are ~60 total) get placed by the same rule during
implementation: governance rule/policy → `governance/`, phase-numbered charter/report/state →
`phases/`, implementation plan → `plans/`, design/integration spec not tied to a phase number
→ `specs/`, `*-REVIEW.md` → `reviews/`, superseded/duplicate → `archive/`.

## Naming Convention

- kebab-case, all lowercase, `.md` extension
- no numbered prefixes (`1-`, `4-`) — folder groups by type, not by artificial global order
- no SCREAMING_SNAKE_CASE
- version suffixes (`-v1.0`, `-v1.5`) kept where they disambiguate an actual revision history

## Duplicate Resolution

`parallelism-matrix-template.md` (root) vs `1-parallelism-matrix-template.md`: diff the two
before archiving one — do not assume which is canonical without checking content.

## Index Files

Each new subfolder gets a `README.md` matching the existing `docs/meta/audit/README.md`
pattern: one-line purpose + list of contents. `docs/meta/README.md` links to all subfolders.

## Policy Going Forward

New file: `docs/meta/governance/documentation-policy.md` — states:
- new meta docs go in the matching subfolder by type
- kebab-case naming, no numbered prefixes
- superseded/dead docs move to `archive/`, never deleted
- any new subfolder needs a `README.md`

`CLAUDE.md` gets a one-line pointer to this policy file (not the full policy inline).

## Explicitly Out of Scope

- `docs/archive/` nested project checkouts (`.git`, `node_modules`) — separate task, needs its
  own explicit user confirmation given the destructive/large blast radius.
- `docs/{toolforge,wave-d,gateway,daemons,sync-tools,utilities}` — already fine.

## Risks

- Broken cross-references if a move's referrer-fix pass is incomplete. Mitigated by doing
  moves as atomic move+fix+verify units and a final full-repo grep for any remaining
  `docs/meta/` path that doesn't resolve.
- `.docx` files may not actually be superseded — verify content before archiving, don't
  delete.
