# Governance

Durable rules, policies, and gates that govern how work gets done across phases — not a single deliverable's spec. See `docs/meta/docs-structure-policy-design.md` for the placement rule.

- `global-operating-rules-cic-rewrite-labs.md` — core governance framework (tiers, principles, conformance gate)
- `global-rules-amendment-v1.4.md` — amendment to global rules
- `governance-rule-audit-first-scope-lock.md` — audit-first scope lock rule
- `governance-update-data-contracts.md` — data contract governance update
- `toolforge-marketplace-spec-v1.0.md` — Toolforge Marketplace spec (Tier 1 approved)
- `data-contract-spec.md` — data contract specification
- `ijfw-spec-phase-data-contract-gate.md` — IJFW spec-phase data contract gate
- `ijfw-spec-phase-audit-gate-integration.md` — spec-phase audit gate integration
- `ijfw-spec-phase-phase0-integration.md` — spec-phase Phase 0 integration
- `pre-charter-audit-checklist.md` — pre-charter audit checklist
- `phase-0-pattern-research-gate-template.md` — Phase 0 pattern research gate template
- `adr-template.md` — architecture decision record template; gates promotion into the Ecosystem Architecture Guide
- `documentation-policy.md` — this repo's docs/meta naming + placement policy
- `wiki-style-and-structure.md` - curated GitHub/in-repo wiki style, brand matrix, Home/_Sidebar/_Footer, W/R CLI rules
- `wiki-sync-registry.md` - per-product canonical wiki side (clone vs in-repo) for sync; pairs with wiki-style §10
- `scripts-governance.md` — all scripts (.ps1, .sh, .bat, etc.) belong in C:\dev\scripts\

## Referenced by

External surfaces that treat files in this directory as binding authority (update this list
when you find or add another):

- `CIC-GOVERNANCE/MANIFEST/CIC-GOV-MANIFEST-001.md` — cites
  `global-operating-rules-cic-rewrite-labs.md` as an authority the manifest is subordinate to.
- `GOVERNANCE.md` (repo root) — cites `wiki-style-and-structure.md` for wiki-lifecycle rules.
- `CIC-GOVERNANCE/README.md:23` — cites `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md`.
- `CIC-GOVERNANCE/README/CIC-README.md:13` — cites `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md`.
- `CIC-GOVERNANCE/MANIFEST/PHASE-09-ONBOARDING.md:221-222` — table entries cite
  `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md` and
  `docs/meta/governance/toolforge-marketplace-spec-v1.0.md`.
- `AGENTS.md:232` — cites `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md` and
  `docs/meta/governance/documentation-policy.md`; `AGENTS.md:369` also cites
  `docs/meta/governance/toolforge-marketplace-spec-v1.0.md`.
- `scripts/preflight.ps1:21` — references `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md`
  (with `docs/meta/global-operating-rules-cic-rewrite-labs.md` as an alternate path).
- `setup-git-hooks.ps1:128` — prints `docs/meta/governance/documentation-policy.md` as the
  governance reference during hook setup.
- `scripts/handoff-bootstrap.ps1:3` — cites
  `docs/meta/governance/multi-agent-handoff-protocol.md §13.1`.
