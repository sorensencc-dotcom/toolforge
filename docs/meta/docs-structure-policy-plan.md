# docs/meta Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `C:\dev\docs\meta\` from 60+ flat files into type-based subfolders (`governance/`, `phases/`, `plans/`, `specs/`, `reviews/`, `archive/`) with consistent kebab-case naming, fix every cross-repo reference to a moved file, and add a durable naming/placement policy doc.

**Architecture:** Six category tasks, each an atomic move+reference-fix+verify unit (per the design's own risk mitigation). A file is never moved without its referrers being fixed and verified in the same task. Two new files (`governance/documentation-policy.md`, `docs/meta/README.md`) and one `CLAUDE.md` edit close out the plan.

**Tech Stack:** `git mv`, `git grep` (tracked-files-only search, avoids the untracked/foreign-repo clutter under `docs/archive/`), `sed` for in-place reference rewrites.

**Reference doc:** `C:\dev\docs\meta\docs-structure-policy-design.md` — read it before starting; this plan implements it, with two corrections found during planning (see Task 4 and Task 6 notes — evidence included, don't re-litigate).

## Global Constraints

- Every file move: `git mv` (preserves history), never delete+recreate.
- Every reference fix: use `git grep -l "docs/meta/<old-relative-path>" -- . ':!docs/archive'` to find referrers (the `:!docs/archive` pathspec exclusion is required — `docs/archive/` contains nested foreign git checkouts, not our tracked docs, and must never be touched by these commands).
- Every task ends with `git grep -rn "docs/meta/<old-relative-path>" -- . ':!docs/archive'` returning **zero** hits before moving to the next task. This is the task's test — treat a non-zero result as a failing test.
- Naming: kebab-case, lowercase, `.md` extension, no numbered prefixes, no SCREAMING_SNAKE_CASE (per design's Naming Convention section).
- Commit after each task.
- Do not touch `docs/archive/`, `docs/{toolforge,wave-d,gateway,daemons,sync-tools,utilities}` — explicitly out of scope per design.
- Do not touch `docs/meta/audit/` or `docs/meta/phase-8-toolforge-marketplace/` — already correctly structured, stay in place.

---

### Task 1: Governance category

**Files:**
- Move + rename (11 files, `C:\dev\docs\meta\` → `C:\dev\docs\meta\governance\`):
  - `global-operating-rules-cic-rewrite-labs.md` (name unchanged)
  - `global-rules-amendment-v1.4.md` (unchanged)
  - `governance-rule-audit-first-scope-lock.md` (unchanged)
  - `GOVERNANCE_UPDATE_DATA_CONTRACTS.md` → `governance-update-data-contracts.md`
  - `TOOLFORGE-MARKETPLACE-SPEC-v1.0.md` → `toolforge-marketplace-spec-v1.0.md`
  - `DATA_CONTRACT_SPEC.md` → `data-contract-spec.md`
  - `IJFW_SPEC_PHASE_DATA_CONTRACT_GATE.md` → `ijfw-spec-phase-data-contract-gate.md`
  - `ijfw-spec-phase-audit-gate-integration.md` (unchanged)
  - `ijfw-spec-phase-phase0-integration.md` (unchanged)
  - `pre-charter-audit-checklist.md` (unchanged)
  - `phase-0-pattern-research-gate-template.md` (unchanged)
- Create: `C:\dev\docs\meta\governance\README.md`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `docs/meta/governance/` populated — Task 7 (documentation-policy.md) and Task 9 (CLAUDE.md pointer) both add files into this same folder, so it must exist with these 11 files first.

- [ ] **Step 1: Create the folder and move files**

```bash
cd C:\dev
mkdir -p docs/meta/governance
git mv docs/meta/global-operating-rules-cic-rewrite-labs.md docs/meta/governance/global-operating-rules-cic-rewrite-labs.md
git mv docs/meta/global-rules-amendment-v1.4.md docs/meta/governance/global-rules-amendment-v1.4.md
git mv docs/meta/governance-rule-audit-first-scope-lock.md docs/meta/governance/governance-rule-audit-first-scope-lock.md
git mv docs/meta/GOVERNANCE_UPDATE_DATA_CONTRACTS.md docs/meta/governance/governance-update-data-contracts.md
git mv docs/meta/TOOLFORGE-MARKETPLACE-SPEC-v1.0.md docs/meta/governance/toolforge-marketplace-spec-v1.0.md
git mv docs/meta/DATA_CONTRACT_SPEC.md docs/meta/governance/data-contract-spec.md
git mv docs/meta/IJFW_SPEC_PHASE_DATA_CONTRACT_GATE.md docs/meta/governance/ijfw-spec-phase-data-contract-gate.md
git mv docs/meta/ijfw-spec-phase-audit-gate-integration.md docs/meta/governance/ijfw-spec-phase-audit-gate-integration.md
git mv docs/meta/ijfw-spec-phase-phase0-integration.md docs/meta/governance/ijfw-spec-phase-phase0-integration.md
git mv docs/meta/pre-charter-audit-checklist.md docs/meta/governance/pre-charter-audit-checklist.md
git mv docs/meta/phase-0-pattern-research-gate-template.md docs/meta/governance/phase-0-pattern-research-gate-template.md
```

- [ ] **Step 2: Fix every referrer, for every renamed/moved file**

Run once per old path (old path on the left, new path on the right — the sed pattern is the same shape each time, only the strings change):

```bash
for pair in \
  "docs/meta/global-operating-rules-cic-rewrite-labs.md=docs/meta/governance/global-operating-rules-cic-rewrite-labs.md" \
  "docs/meta/global-rules-amendment-v1.4.md=docs/meta/governance/global-rules-amendment-v1.4.md" \
  "docs/meta/governance-rule-audit-first-scope-lock.md=docs/meta/governance/governance-rule-audit-first-scope-lock.md" \
  "docs/meta/GOVERNANCE_UPDATE_DATA_CONTRACTS.md=docs/meta/governance/governance-update-data-contracts.md" \
  "docs/meta/TOOLFORGE-MARKETPLACE-SPEC-v1.0.md=docs/meta/governance/toolforge-marketplace-spec-v1.0.md" \
  "docs/meta/DATA_CONTRACT_SPEC.md=docs/meta/governance/data-contract-spec.md" \
  "docs/meta/IJFW_SPEC_PHASE_DATA_CONTRACT_GATE.md=docs/meta/governance/ijfw-spec-phase-data-contract-gate.md" \
  "docs/meta/ijfw-spec-phase-audit-gate-integration.md=docs/meta/governance/ijfw-spec-phase-audit-gate-integration.md" \
  "docs/meta/ijfw-spec-phase-phase0-integration.md=docs/meta/governance/ijfw-spec-phase-phase0-integration.md" \
  "docs/meta/pre-charter-audit-checklist.md=docs/meta/governance/pre-charter-audit-checklist.md" \
  "docs/meta/phase-0-pattern-research-gate-template.md=docs/meta/governance/phase-0-pattern-research-gate-template.md" \
; do
  old="${pair%%=*}"
  new="${pair##*=}"
  files=$(git grep -l "$old" -- . ':!docs/archive' || true)
  if [ -n "$files" ]; then
    echo "$files" | xargs sed -i "s#$old#$new#g"
  fi
done
```

Note: bare filename links *within* `docs/meta/*.md` (e.g. `[link](governance-rule-audit-first-scope-lock.md)` with no `docs/meta/` prefix, relative to the same directory) will now be broken because the target moved to a different directory. Step 2's sed only fixes references written as full `docs/meta/...` paths. After running Step 2, also run:

```bash
git grep -n "](global-operating-rules-cic-rewrite-labs.md\|](global-rules-amendment-v1.4.md\|](governance-rule-audit-first-scope-lock.md\|](GOVERNANCE_UPDATE_DATA_CONTRACTS.md\|](TOOLFORGE-MARKETPLACE-SPEC-v1.0.md\|](DATA_CONTRACT_SPEC.md\|](IJFW_SPEC_PHASE_DATA_CONTRACT_GATE.md\|](ijfw-spec-phase-audit-gate-integration.md\|](ijfw-spec-phase-phase0-integration.md\|](pre-charter-audit-checklist.md\|](phase-0-pattern-research-gate-template.md" -- docs/meta ':!docs/archive'
```

For any hit inside a file that itself now lives in `docs/meta/governance/`, the relative link still works unchanged (both files moved together). For any hit inside a file that lives elsewhere (e.g. still in flat `docs/meta/` pending its own task, or already moved to a different subfolder), fix the relative path manually to `../governance/<filename>` or the correct relative path, based on where the referring file itself ends up.

- [ ] **Step 3: Verify zero remaining old-path references**

```bash
for old in \
  "docs/meta/global-operating-rules-cic-rewrite-labs.md" \
  "docs/meta/global-rules-amendment-v1.4.md" \
  "docs/meta/governance-rule-audit-first-scope-lock.md" \
  "docs/meta/GOVERNANCE_UPDATE_DATA_CONTRACTS.md" \
  "docs/meta/TOOLFORGE-MARKETPLACE-SPEC-v1.0.md" \
  "docs/meta/DATA_CONTRACT_SPEC.md" \
  "docs/meta/IJFW_SPEC_PHASE_DATA_CONTRACT_GATE.md" \
; do
  git grep -n "$old" -- . ':!docs/archive' && echo "FAIL: $old still referenced" || echo "OK: $old clear"
done
```

Expected: every line prints `OK: ... clear`. (The other 4 files in this batch didn't change name, only directory, so their old full path already contains `docs/meta/` — same check pattern applies; they're covered by the loop in Step 2 already.)

- [ ] **Step 4: Write `docs/meta/governance/README.md`**

```markdown
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
- `documentation-policy.md` — this repo's docs/meta naming + placement policy (added in Task 7)
```

- [ ] **Step 5: Commit**

```bash
git add docs/meta/governance
git commit -m "docs: move governance docs into docs/meta/governance/"
```

---

### Task 2: Phases category

**Files:**
- Move (17 files, `C:\dev\docs\meta\` → `C:\dev\docs\meta\phases\`):
  - `phase-2b-scope-charter.md`
  - `phase-2b1-audit-charter.md`
  - `phase-3-cowork-gateway-charter.md`
  - `phase-4-governance-charter.md`
  - `phase-4-observability-contract.md`
  - `phase-4-completion-report.md`
  - `phase-5-multicanary-charter.md`
  - `phase-5-exit-wave-completion.md`
  - `phase-6-rollback-charter.md`
  - `phase-7-rollback-config-featureflag-charter.md`
  - `phase-7-rollback-health-check-gate.md`
  - `phase-8-gate-sign-off.md`
  - `PHASE27_WAVE_E_DATA_CONTRACT.md` → `phase-27-wave-e-data-contract.md`
  - `phase-27-wave-e-retroactive-validation.md`
  - `phase-abc-audit-phases-addition.md`
  - `toolforge-phase-2b-charter.md`
  - `cic-ashfall-state.md`
  - `skill-regression-backfill-charter.md`
- Do NOT move: `phase-8-toolforge-marketplace/` (already correctly placed as a subdir)
- Create: `C:\dev\docs\meta\phases\README.md`

**Correction to design doc:** the design's Target Structure listed `phase-7-*.md (charter, etcd/unleash integration specs, health-check gate)` as a single glob under `phases/`. That contradicts the design's own precedence rule 5 ("design/integration spec... → specs/"). `phase-7-etcd-integration-spec.md` and `phase-7-unleash-integration-spec.md` are integration specs, not charters — they go to `specs/` in **Task 3**, not here. Only the charter and the health-check gate (a phase completion criterion, not a technical spec) stay in `phases/`.

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `docs/meta/phases/` populated.

- [ ] **Step 1: Create the folder and move files**

```bash
cd C:\dev
mkdir -p docs/meta/phases
git mv docs/meta/phase-2b-scope-charter.md docs/meta/phases/phase-2b-scope-charter.md
git mv docs/meta/phase-2b1-audit-charter.md docs/meta/phases/phase-2b1-audit-charter.md
git mv docs/meta/phase-3-cowork-gateway-charter.md docs/meta/phases/phase-3-cowork-gateway-charter.md
git mv docs/meta/phase-4-governance-charter.md docs/meta/phases/phase-4-governance-charter.md
git mv docs/meta/phase-4-observability-contract.md docs/meta/phases/phase-4-observability-contract.md
git mv docs/meta/phase-4-completion-report.md docs/meta/phases/phase-4-completion-report.md
git mv docs/meta/phase-5-multicanary-charter.md docs/meta/phases/phase-5-multicanary-charter.md
git mv docs/meta/phase-5-exit-wave-completion.md docs/meta/phases/phase-5-exit-wave-completion.md
git mv docs/meta/phase-6-rollback-charter.md docs/meta/phases/phase-6-rollback-charter.md
git mv docs/meta/phase-7-rollback-config-featureflag-charter.md docs/meta/phases/phase-7-rollback-config-featureflag-charter.md
git mv docs/meta/phase-7-rollback-health-check-gate.md docs/meta/phases/phase-7-rollback-health-check-gate.md
git mv docs/meta/phase-8-gate-sign-off.md docs/meta/phases/phase-8-gate-sign-off.md
git mv docs/meta/PHASE27_WAVE_E_DATA_CONTRACT.md docs/meta/phases/phase-27-wave-e-data-contract.md
git mv docs/meta/phase-27-wave-e-retroactive-validation.md docs/meta/phases/phase-27-wave-e-retroactive-validation.md
git mv docs/meta/phase-abc-audit-phases-addition.md docs/meta/phases/phase-abc-audit-phases-addition.md
git mv docs/meta/toolforge-phase-2b-charter.md docs/meta/phases/toolforge-phase-2b-charter.md
git mv docs/meta/cic-ashfall-state.md docs/meta/phases/cic-ashfall-state.md
git mv docs/meta/skill-regression-backfill-charter.md docs/meta/phases/skill-regression-backfill-charter.md
```

- [ ] **Step 2: Fix every referrer**

```bash
for pair in \
  "docs/meta/phase-2b-scope-charter.md=docs/meta/phases/phase-2b-scope-charter.md" \
  "docs/meta/phase-2b1-audit-charter.md=docs/meta/phases/phase-2b1-audit-charter.md" \
  "docs/meta/phase-3-cowork-gateway-charter.md=docs/meta/phases/phase-3-cowork-gateway-charter.md" \
  "docs/meta/phase-4-governance-charter.md=docs/meta/phases/phase-4-governance-charter.md" \
  "docs/meta/phase-4-observability-contract.md=docs/meta/phases/phase-4-observability-contract.md" \
  "docs/meta/phase-4-completion-report.md=docs/meta/phases/phase-4-completion-report.md" \
  "docs/meta/phase-5-multicanary-charter.md=docs/meta/phases/phase-5-multicanary-charter.md" \
  "docs/meta/phase-5-exit-wave-completion.md=docs/meta/phases/phase-5-exit-wave-completion.md" \
  "docs/meta/phase-6-rollback-charter.md=docs/meta/phases/phase-6-rollback-charter.md" \
  "docs/meta/phase-7-rollback-config-featureflag-charter.md=docs/meta/phases/phase-7-rollback-config-featureflag-charter.md" \
  "docs/meta/phase-7-rollback-health-check-gate.md=docs/meta/phases/phase-7-rollback-health-check-gate.md" \
  "docs/meta/phase-8-gate-sign-off.md=docs/meta/phases/phase-8-gate-sign-off.md" \
  "docs/meta/PHASE27_WAVE_E_DATA_CONTRACT.md=docs/meta/phases/phase-27-wave-e-data-contract.md" \
  "docs/meta/phase-27-wave-e-retroactive-validation.md=docs/meta/phases/phase-27-wave-e-retroactive-validation.md" \
  "docs/meta/phase-abc-audit-phases-addition.md=docs/meta/phases/phase-abc-audit-phases-addition.md" \
  "docs/meta/toolforge-phase-2b-charter.md=docs/meta/phases/toolforge-phase-2b-charter.md" \
  "docs/meta/cic-ashfall-state.md=docs/meta/phases/cic-ashfall-state.md" \
  "docs/meta/skill-regression-backfill-charter.md=docs/meta/phases/skill-regression-backfill-charter.md" \
; do
  old="${pair%%=*}"
  new="${pair##*=}"
  files=$(git grep -l "$old" -- . ':!docs/archive' || true)
  if [ -n "$files" ]; then
    echo "$files" | xargs sed -i "s#$old#$new#g"
  fi
done
```

Also check bare relative links the same way as Task 1 Step 2 (e.g. `](phase-4-governance-charter.md`) for any referrer file that stayed outside `docs/meta/phases/` — fix relative paths manually if found.

- [ ] **Step 3: Verify**

```bash
git grep -n "docs/meta/phase-2b-scope-charter.md\|docs/meta/phase-2b1-audit-charter.md\|docs/meta/phase-3-cowork-gateway-charter.md\|docs/meta/phase-4-governance-charter.md\|docs/meta/phase-4-observability-contract.md\|docs/meta/phase-4-completion-report.md\|docs/meta/phase-5-multicanary-charter.md\|docs/meta/phase-5-exit-wave-completion.md\|docs/meta/phase-6-rollback-charter.md\|docs/meta/phase-7-rollback-config-featureflag-charter.md\|docs/meta/phase-7-rollback-health-check-gate.md\|docs/meta/phase-8-gate-sign-off.md\|docs/meta/PHASE27_WAVE_E_DATA_CONTRACT.md\|docs/meta/phase-27-wave-e-retroactive-validation.md\|docs/meta/phase-abc-audit-phases-addition.md\|docs/meta/toolforge-phase-2b-charter.md\|docs/meta/cic-ashfall-state.md\|docs/meta/skill-regression-backfill-charter.md" -- . ':!docs/archive'
```

Expected: no output.

- [ ] **Step 4: Write `docs/meta/phases/README.md`**

```markdown
# Phases

Charters, completion reports, and state docs — "what we're doing and why, scoped/approved" for a specific phase. See `docs/meta/docs-structure-policy-design.md` for the placement rule.

`phase-8-toolforge-marketplace/` is a phase-specific deliverable set (manifest schema, registry service, CLI, validator docs), kept as its own subdir here rather than flattened.

- `phase-2b-scope-charter.md`, `phase-2b1-audit-charter.md` — Phase 2b scope + audit charters
- `phase-3-cowork-gateway-charter.md` — Phase 3 charter
- `phase-4-governance-charter.md`, `phase-4-observability-contract.md`, `phase-4-completion-report.md` — Phase 4 charter/contract/completion
- `phase-5-multicanary-charter.md`, `phase-5-exit-wave-completion.md` — Phase 5 charter/completion
- `phase-6-rollback-charter.md` — Phase 6 charter
- `phase-7-rollback-config-featureflag-charter.md`, `phase-7-rollback-health-check-gate.md` — Phase 7 charter + gate (see `docs/meta/specs/` for Phase 7's etcd/unleash integration specs)
- `phase-8-gate-sign-off.md` — Phase 8 gate sign-off
- `phase-8-toolforge-marketplace/` — Phase 8 Wave D deliverable docs
- `phase-27-wave-e-data-contract.md`, `phase-27-wave-e-retroactive-validation.md` — Phase 27 Wave E
- `phase-abc-audit-phases-addition.md` — Phase A/B/C audit addition
- `toolforge-phase-2b-charter.md` — Toolforge Phase 2b charter
- `cic-ashfall-state.md` — CIC Ashfall state doc
- `skill-regression-backfill-charter.md` — skill regression backfill charter
```

- [ ] **Step 5: Commit**

```bash
git add docs/meta/phases
git commit -m "docs: move phase charters/reports into docs/meta/phases/"
```

---

### Task 3: Specs category

**Files:**
- Move (7 files, `C:\dev\docs\meta\` → `C:\dev\docs\meta\specs\`):
  - `toolforge-phase-2b-step1-design.md`
  - `toolforge-phase-2b-step2-design.md`
  - `cic-tool-surface-phase1-design.md`
  - `ijfw-agent-integration-guide-v1.5.md`
  - `audit-first-scope-lock-formalization-summary.md`
  - `phase-7-etcd-integration-spec.md` (reclassified here from Task 2's original glob — see Task 2 note)
  - `phase-7-unleash-integration-spec.md` (same)
- Create: `C:\dev\docs\meta\specs\README.md`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `docs/meta/specs/` populated.

- [ ] **Step 1: Create the folder and move files**

```bash
cd C:\dev
mkdir -p docs/meta/specs
git mv docs/meta/toolforge-phase-2b-step1-design.md docs/meta/specs/toolforge-phase-2b-step1-design.md
git mv docs/meta/toolforge-phase-2b-step2-design.md docs/meta/specs/toolforge-phase-2b-step2-design.md
git mv docs/meta/cic-tool-surface-phase1-design.md docs/meta/specs/cic-tool-surface-phase1-design.md
git mv docs/meta/ijfw-agent-integration-guide-v1.5.md docs/meta/specs/ijfw-agent-integration-guide-v1.5.md
git mv docs/meta/audit-first-scope-lock-formalization-summary.md docs/meta/specs/audit-first-scope-lock-formalization-summary.md
git mv docs/meta/phase-7-etcd-integration-spec.md docs/meta/specs/phase-7-etcd-integration-spec.md
git mv docs/meta/phase-7-unleash-integration-spec.md docs/meta/specs/phase-7-unleash-integration-spec.md
```

- [ ] **Step 2: Fix every referrer**

```bash
for pair in \
  "docs/meta/toolforge-phase-2b-step1-design.md=docs/meta/specs/toolforge-phase-2b-step1-design.md" \
  "docs/meta/toolforge-phase-2b-step2-design.md=docs/meta/specs/toolforge-phase-2b-step2-design.md" \
  "docs/meta/cic-tool-surface-phase1-design.md=docs/meta/specs/cic-tool-surface-phase1-design.md" \
  "docs/meta/ijfw-agent-integration-guide-v1.5.md=docs/meta/specs/ijfw-agent-integration-guide-v1.5.md" \
  "docs/meta/audit-first-scope-lock-formalization-summary.md=docs/meta/specs/audit-first-scope-lock-formalization-summary.md" \
  "docs/meta/phase-7-etcd-integration-spec.md=docs/meta/specs/phase-7-etcd-integration-spec.md" \
  "docs/meta/phase-7-unleash-integration-spec.md=docs/meta/specs/phase-7-unleash-integration-spec.md" \
; do
  old="${pair%%=*}"
  new="${pair##*=}"
  files=$(git grep -l "$old" -- . ':!docs/archive' || true)
  if [ -n "$files" ]; then
    echo "$files" | xargs sed -i "s#$old#$new#g"
  fi
done
```

`toolforge-phase-2b-step1-design.md` is referenced by non-doc code files (`api/telemetry/server.js`, `assets/dashboard-v2.js`, `assets/cic-dashboard.css` per the design doc's Cross-Repo Impact list) — the loop above covers these too since `git grep` searches all tracked file types, not just markdown. Double check these three specifically:

```bash
git grep -n "docs/meta/toolforge-phase-2b-step1-design.md" -- api/telemetry/server.js assets/dashboard-v2.js assets/cic-dashboard.css
```

Expected: no output (already fixed by the loop). If it still shows old path, the loop's sed didn't run on that extension — fix manually with `sed -i "s#docs/meta/toolforge-phase-2b-step1-design.md#docs/meta/specs/toolforge-phase-2b-step1-design.md#g" api/telemetry/server.js assets/dashboard-v2.js assets/cic-dashboard.css`.

Also check bare relative links (same pattern as prior tasks) for any referrer staying outside `docs/meta/specs/`.

- [ ] **Step 3: Verify**

```bash
git grep -n "docs/meta/toolforge-phase-2b-step1-design.md\|docs/meta/toolforge-phase-2b-step2-design.md\|docs/meta/cic-tool-surface-phase1-design.md\|docs/meta/ijfw-agent-integration-guide-v1.5.md\|docs/meta/audit-first-scope-lock-formalization-summary.md\|docs/meta/phase-7-etcd-integration-spec.md\|docs/meta/phase-7-unleash-integration-spec.md" -- . ':!docs/archive'
```

Expected: no output.

- [ ] **Step 4: Write `docs/meta/specs/README.md`**

```markdown
# Specs

Design and integration specs — "how it's built, technically." Not a charter (see `phases/`), not a task breakdown (see `plans/`). See `docs/meta/docs-structure-policy-design.md` for the placement rule.

- `toolforge-phase-2b-step1-design.md`, `toolforge-phase-2b-step2-design.md` — Toolforge Phase 2b step designs
- `cic-tool-surface-phase1-design.md` — CIC tool surface Phase 1 design
- `ijfw-agent-integration-guide-v1.5.md` — IJFW agent integration guide (versioned spec release)
- `audit-first-scope-lock-formalization-summary.md` — audit-first scope lock formalization
- `phase-7-etcd-integration-spec.md`, `phase-7-unleash-integration-spec.md` — Phase 7 integration specs (charter lives in `docs/meta/phases/`)
```

- [ ] **Step 5: Commit**

```bash
git add docs/meta/specs
git commit -m "docs: move design/integration specs into docs/meta/specs/"
```

---

### Task 4: Plans category

**Files:**
- Move + rename (13 files, `C:\dev\docs\meta\` → `C:\dev\docs\meta\plans\`):
  - `2-ijfw-plan-integration-spec.md` → `ijfw-plan-integration-spec.md`
  - `3-ijfw-verify-parallelism-checks.md` → `ijfw-verify-parallelism-checks.md`
  - `4-ijfw-plan-phase-4-governance.md` → `ijfw-plan-phase-4-governance.md`
  - `4-parallelism-matrix-governance-rule.md` → `parallelism-matrix-governance-rule.md`
  - `5-ijfw-plan-observability-contract.md` → `ijfw-plan-observability-contract.md`
  - `5-ijfw-plan-phase-5-multicanary.md` → `ijfw-plan-phase-5-multicanary.md`
  - `toolforge-phase-2b-implementation-plan.md` (unchanged)
  - `cic-tool-surface-phase1-plan.md` (unchanged)
  - `PARALLELISM_MATRIX_DELIVERY_INDEX.md` → `parallelism-matrix-delivery-index.md`
  - `PARALLELISM_MATRIX_SYSTEM.md` → `parallelism-matrix-system.md`
  - `parallelism-matrix-retrofit-example-phase3.md` (unchanged)
  - `OBSERVABILITY_PHASE_D_SUMMARY.md` → `observability-phase-d-summary.md`
  - `governance-amendment-observability-phase-d.md` (unchanged)
  - `parallelism-matrix-template.md` (unchanged — **see correction below**)
- Create: `C:\dev\docs\meta\plans\README.md`

**Correction to design doc:** the design mapped `1-parallelism-matrix-template.md` → `plans/parallelism-matrix-template.md` and implied the root-level `parallelism-matrix-template.md` was the duplicate to archive. Verified by diff: the two files are **not** near-duplicates — they're divergent drafts (244 lines vs 128 lines, different section structure). Checked every inbound link across `docs/meta/` (`4-parallelism-matrix-governance-rule.md`, `PARALLELISM_MATRIX_DELIVERY_INDEX.md`, `PARALLELISM_MATRIX_SYSTEM.md`, `parallelism-matrix-governance-rule.md`): **all of them link to `parallelism-matrix-template.md` (root, unqualified)**. Zero inbound links to `1-parallelism-matrix-template.md`. So the root file is canonical (live, linked, dated 2026-07-12 "Template version: 1.0"); `1-parallelism-matrix-template.md` is the orphaned duplicate. This task moves the **root** file to `plans/parallelism-matrix-template.md` (name unchanged, directory only). `1-parallelism-matrix-template.md` goes to `archive/` in **Task 6**, not here.

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `docs/meta/plans/` populated.

- [ ] **Step 1: Create the folder and move files**

```bash
cd C:\dev
mkdir -p docs/meta/plans
git mv docs/meta/2-ijfw-plan-integration-spec.md docs/meta/plans/ijfw-plan-integration-spec.md
git mv docs/meta/3-ijfw-verify-parallelism-checks.md docs/meta/plans/ijfw-verify-parallelism-checks.md
git mv docs/meta/4-ijfw-plan-phase-4-governance.md docs/meta/plans/ijfw-plan-phase-4-governance.md
git mv docs/meta/4-parallelism-matrix-governance-rule.md docs/meta/plans/parallelism-matrix-governance-rule.md
git mv docs/meta/5-ijfw-plan-observability-contract.md docs/meta/plans/ijfw-plan-observability-contract.md
git mv docs/meta/5-ijfw-plan-phase-5-multicanary.md docs/meta/plans/ijfw-plan-phase-5-multicanary.md
git mv docs/meta/toolforge-phase-2b-implementation-plan.md docs/meta/plans/toolforge-phase-2b-implementation-plan.md
git mv docs/meta/cic-tool-surface-phase1-plan.md docs/meta/plans/cic-tool-surface-phase1-plan.md
git mv docs/meta/PARALLELISM_MATRIX_DELIVERY_INDEX.md docs/meta/plans/parallelism-matrix-delivery-index.md
git mv docs/meta/PARALLELISM_MATRIX_SYSTEM.md docs/meta/plans/parallelism-matrix-system.md
git mv docs/meta/parallelism-matrix-retrofit-example-phase3.md docs/meta/plans/parallelism-matrix-retrofit-example-phase3.md
git mv docs/meta/OBSERVABILITY_PHASE_D_SUMMARY.md docs/meta/plans/observability-phase-d-summary.md
git mv docs/meta/governance-amendment-observability-phase-d.md docs/meta/plans/governance-amendment-observability-phase-d.md
git mv docs/meta/parallelism-matrix-template.md docs/meta/plans/parallelism-matrix-template.md
```

Note: there are now two files named `1-parallelism-matrix-template.md` (untouched, still at `docs/meta/`) and `docs/meta/plans/parallelism-matrix-template.md` (just moved). This is expected — `1-parallelism-matrix-template.md` is handled in Task 6.

- [ ] **Step 2: Fix every referrer**

```bash
for pair in \
  "docs/meta/2-ijfw-plan-integration-spec.md=docs/meta/plans/ijfw-plan-integration-spec.md" \
  "docs/meta/3-ijfw-verify-parallelism-checks.md=docs/meta/plans/ijfw-verify-parallelism-checks.md" \
  "docs/meta/4-ijfw-plan-phase-4-governance.md=docs/meta/plans/ijfw-plan-phase-4-governance.md" \
  "docs/meta/4-parallelism-matrix-governance-rule.md=docs/meta/plans/parallelism-matrix-governance-rule.md" \
  "docs/meta/5-ijfw-plan-observability-contract.md=docs/meta/plans/ijfw-plan-observability-contract.md" \
  "docs/meta/5-ijfw-plan-phase-5-multicanary.md=docs/meta/plans/ijfw-plan-phase-5-multicanary.md" \
  "docs/meta/toolforge-phase-2b-implementation-plan.md=docs/meta/plans/toolforge-phase-2b-implementation-plan.md" \
  "docs/meta/cic-tool-surface-phase1-plan.md=docs/meta/plans/cic-tool-surface-phase1-plan.md" \
  "docs/meta/PARALLELISM_MATRIX_DELIVERY_INDEX.md=docs/meta/plans/parallelism-matrix-delivery-index.md" \
  "docs/meta/PARALLELISM_MATRIX_SYSTEM.md=docs/meta/plans/parallelism-matrix-system.md" \
  "docs/meta/parallelism-matrix-retrofit-example-phase3.md=docs/meta/plans/parallelism-matrix-retrofit-example-phase3.md" \
  "docs/meta/OBSERVABILITY_PHASE_D_SUMMARY.md=docs/meta/plans/observability-phase-d-summary.md" \
  "docs/meta/governance-amendment-observability-phase-d.md=docs/meta/plans/governance-amendment-observability-phase-d.md" \
  "docs/meta/parallelism-matrix-template.md=docs/meta/plans/parallelism-matrix-template.md" \
; do
  old="${pair%%=*}"
  new="${pair##*=}"
  files=$(git grep -l "$old" -- . ':!docs/archive' || true)
  if [ -n "$files" ]; then
    echo "$files" | xargs sed -i "s#$old#$new#g"
  fi
done
```

`toolforge-phase-2b-implementation-plan.md` is referenced by `.github/workflows/toolforge-release.yml` (per design doc's Cross-Repo Impact list) — the loop above covers this via `git grep` across all tracked files. Double check:

```bash
git grep -n "docs/meta/toolforge-phase-2b-implementation-plan.md" -- .github/workflows/toolforge-release.yml
```

Expected: no output.

Also check bare relative links (`](parallelism-matrix-template.md`, `](PARALLELISM_MATRIX_SYSTEM.md`, etc.) same pattern as prior tasks — this category has the most internal cross-links (the parallelism-matrix family references itself heavily), so this check matters most here.

- [ ] **Step 3: Verify**

```bash
git grep -n "docs/meta/2-ijfw-plan-integration-spec.md\|docs/meta/3-ijfw-verify-parallelism-checks.md\|docs/meta/4-ijfw-plan-phase-4-governance.md\|docs/meta/4-parallelism-matrix-governance-rule.md\|docs/meta/5-ijfw-plan-observability-contract.md\|docs/meta/5-ijfw-plan-phase-5-multicanary.md\|docs/meta/toolforge-phase-2b-implementation-plan.md\|docs/meta/cic-tool-surface-phase1-plan.md\|docs/meta/PARALLELISM_MATRIX_DELIVERY_INDEX.md\|docs/meta/PARALLELISM_MATRIX_SYSTEM.md\|docs/meta/OBSERVABILITY_PHASE_D_SUMMARY.md" -- . ':!docs/archive'
```

Expected: no output. (Note: don't grep bare `docs/meta/parallelism-matrix-template.md` or `docs/meta/parallelism-matrix-retrofit-example-phase3.md` or `docs/meta/governance-amendment-observability-phase-d.md` as "old path gone" checks here — their filename didn't change, only their directory, so the string `docs/meta/parallelism-matrix-template.md` legitimately still won't appear anywhere as a *correct* reference post-move; verify instead that `docs/meta/plans/parallelism-matrix-template.md` **does** appear in referrers that used to point to the old location.)

```bash
git grep -c "docs/meta/plans/parallelism-matrix-template.md" -- docs/meta/plans/parallelism-matrix-governance-rule.md docs/meta/plans/parallelism-matrix-delivery-index.md docs/meta/plans/parallelism-matrix-system.md
```

Expected: each file shows a count ≥ 1.

- [ ] **Step 4: Write `docs/meta/plans/README.md`**

```markdown
# Plans

Ordered task breakdowns — "the ordered task list to build it." Not a charter (see `phases/`), not a technical spec (see `specs/`). See `docs/meta/docs-structure-policy-design.md` for the placement rule.

- `ijfw-plan-integration-spec.md`, `ijfw-verify-parallelism-checks.md`, `ijfw-plan-phase-4-governance.md`, `ijfw-plan-observability-contract.md`, `ijfw-plan-phase-5-multicanary.md` — IJFW plan family (formerly numbered `2-`/`3-`/`4-`/`5-` prefixed)
- `parallelism-matrix-governance-rule.md` — parallelism matrix governance rule
- `toolforge-phase-2b-implementation-plan.md` — Toolforge Phase 2b implementation plan
- `cic-tool-surface-phase1-plan.md` — CIC tool surface Phase 1 implementation plan
- `parallelism-matrix-delivery-index.md`, `parallelism-matrix-system.md`, `parallelism-matrix-template.md`, `parallelism-matrix-retrofit-example-phase3.md` — Parallelism Matrix system docs (template is the canonical, linked-from-everywhere version — see Task 4 correction note in the plan doc for why)
- `observability-phase-d-summary.md`, `governance-amendment-observability-phase-d.md` — Observability Phase D
```

- [ ] **Step 5: Commit**

```bash
git add docs/meta/plans
git commit -m "docs: move implementation plans into docs/meta/plans/"
```

---

### Task 5: Reviews category

**Files:**
- Move + rename (2 files, `C:\dev\docs\meta\` → `C:\dev\docs\meta\reviews\`):
  - `toolforge-phase-2b-step2-REVIEW.md` → `toolforge-phase-2b-step2-review.md`
  - `phase-7-rollback-config-featureflag-charter-REVIEW.md` → `phase-7-rollback-config-featureflag-charter-review.md`
- Create: `C:\dev\docs\meta\reviews\README.md`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `docs/meta/reviews/` populated.

- [ ] **Step 1: Create the folder and move files**

```bash
cd C:\dev
mkdir -p docs/meta/reviews
git mv docs/meta/toolforge-phase-2b-step2-REVIEW.md docs/meta/reviews/toolforge-phase-2b-step2-review.md
git mv docs/meta/phase-7-rollback-config-featureflag-charter-REVIEW.md docs/meta/reviews/phase-7-rollback-config-featureflag-charter-review.md
```

- [ ] **Step 2: Fix every referrer**

```bash
for pair in \
  "docs/meta/toolforge-phase-2b-step2-REVIEW.md=docs/meta/reviews/toolforge-phase-2b-step2-review.md" \
  "docs/meta/phase-7-rollback-config-featureflag-charter-REVIEW.md=docs/meta/reviews/phase-7-rollback-config-featureflag-charter-review.md" \
; do
  old="${pair%%=*}"
  new="${pair##*=}"
  files=$(git grep -l "$old" -- . ':!docs/archive' || true)
  if [ -n "$files" ]; then
    echo "$files" | xargs sed -i "s#$old#$new#g"
  fi
done
```

- [ ] **Step 3: Verify**

```bash
git grep -n "docs/meta/toolforge-phase-2b-step2-REVIEW.md\|docs/meta/phase-7-rollback-config-featureflag-charter-REVIEW.md" -- . ':!docs/archive'
```

Expected: no output.

- [ ] **Step 4: Write `docs/meta/reviews/README.md`**

```markdown
# Reviews

`*-REVIEW.md` (now lowercased) documents — review passes on a specific charter or design doc.

- `toolforge-phase-2b-step2-review.md` — review of Toolforge Phase 2b step 2 design
- `phase-7-rollback-config-featureflag-charter-review.md` — review of Phase 7 rollback/config/feature-flag charter
```

- [ ] **Step 5: Commit**

```bash
git add docs/meta/reviews
git commit -m "docs: move review docs into docs/meta/reviews/"
```

---

### Task 6: Archive category

**Files:**
- Move (3 files, `C:\dev\docs\meta\` → `C:\dev\docs\meta\archive\`):
  - `1-parallelism-matrix-template.md` (unchanged name — orphaned duplicate, see Task 4 correction note)
  - `CIC-GOV-MANIFEST-001_DRAFT.docx` (unchanged name)
  - `CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx` (unchanged name)
- Create: `C:\dev\docs\meta\archive\README.md`

**`.docx` verification note:** these are binary Word docs — `diff` and `git grep` can't inspect their content meaningfully. The filenames themselves state the supersession (`_DRAFT` vs `_v1.1_RECONCILED`), and neither is referenced anywhere in the repo (confirm with Step 2's search before moving — if either turns up referenced, stop and ask the user before archiving it, don't guess). Do not delete either file — archive both, preserving the draft for history.

**Interfaces:**
- Consumes: Task 4's finding that `1-parallelism-matrix-template.md` has zero inbound references (root `parallelism-matrix-template.md` is canonical, already moved to `docs/meta/plans/` in Task 4).
- Produces: `docs/meta/archive/` populated.

- [ ] **Step 1: Confirm zero references before moving (don't skip this — archiving a referenced file silently breaks links)**

```bash
git grep -n "docs/meta/1-parallelism-matrix-template.md\|CIC-GOV-MANIFEST-001_DRAFT.docx\|CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx" -- . ':!docs/archive'
```

Expected: no output (or only self-references from `docs-structure-policy-design.md`/`docs-structure-policy-plan.md`, which describe these files by name and don't need fixing — they're historical/planning narrative, not live links). If a hit turns up anywhere else, stop and confirm with the user before proceeding.

- [ ] **Step 2: Create the folder and move files**

```bash
cd C:\dev
mkdir -p docs/meta/archive
git mv docs/meta/1-parallelism-matrix-template.md docs/meta/archive/1-parallelism-matrix-template.md
git mv docs/meta/CIC-GOV-MANIFEST-001_DRAFT.docx docs/meta/archive/CIC-GOV-MANIFEST-001_DRAFT.docx
git mv docs/meta/CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx docs/meta/archive/CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx
```

- [ ] **Step 3: Write `docs/meta/archive/README.md`**

```markdown
# Archive

Superseded or orphaned docs, kept for history — never deleted.

- `1-parallelism-matrix-template.md` — early draft of the Parallelism Matrix Template. Superseded by `docs/meta/plans/parallelism-matrix-template.md` (canonical: every other doc in the Parallelism Matrix family links to that one, none link to this one — verified 2026-07-16).
- `CIC-GOV-MANIFEST-001_DRAFT.docx` — draft governance manifest, superseded by `CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx`.
- `CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx` — reconciled v1.1 governance manifest. Also archived (not moved to `governance/`) because it's a `.docx`, not the repo's living `.md` governance format — if this content is still needed day-to-day, port it to a `.md` file in `governance/` as a separate follow-up.
```

- [ ] **Step 4: Commit**

```bash
git add docs/meta/archive
git commit -m "docs: archive orphaned parallelism-matrix draft and superseded governance manifest drafts"
```

---

### Task 7: Documentation policy file

**Files:**
- Create: `C:\dev\docs\meta\governance\documentation-policy.md`
- Modify: none (this is a new, standalone file)

**Interfaces:**
- Consumes: `docs/meta/governance/` must already exist (Task 1).
- Produces: the canonical policy doc that Task 9's `CLAUDE.md` pointer links to.

- [ ] **Step 1: Write the policy file**

```markdown
# docs/meta Documentation Policy

Canonical naming and placement rules for `docs/meta/`. If this file and `docs/meta/docs-structure-policy-design.md` ever disagree, this file wins — the design doc is historical context, this is the living rule.

## Naming Convention

- kebab-case, all lowercase, `.md` extension
- no numbered prefixes (`1-`, `4-`) — folder groups by type, not by artificial global order
- no SCREAMING_SNAKE_CASE
- version suffix (`-v1.0`, `-v1.5`) kept only when the doc is itself a formally versioned
  spec/governance artifact (its own title/content declares a version) — not kept just
  because the filename happens to have a number in it

## Placement (first match wins — check top to bottom, don't guess from filename alone)

1. `*-REVIEW.md` → `reviews/`
2. superseded/duplicate content (confirmed by diff, not by filename guess) → `archive/`
3. doc is a charter, completion/status report, or state doc, whether or not phase-numbered →
   `phases/`
4. doc is an implementation plan (task breakdown, step sequence for building something) →
   `plans/`
5. doc is a design/integration spec (architecture, contract, schema — not a build task list,
   not a charter) → `specs/`
6. doc is a durable rule/policy/gate that governs how work gets done, not a single
   deliverable's spec → `governance/`
7. none of the above fits → ask, don't force a guess

Charter vs spec vs plan is the recurring ambiguity: charter = "what we're doing and why,
scoped/approved"; spec = "how it's built, technically"; plan = "the ordered task list to
build it." A single phase can have all three as separate files in three different folders —
that's expected, not a bug.

## Every New Subfolder Needs a README.md

One-line purpose + list of contents, matching the pattern in this folder's own `README.md`.

## Dead Docs Move to archive/, Never Deleted

If a doc is superseded, move it to `docs/meta/archive/` with a one-line note in
`archive/README.md` explaining what superseded it and why. Don't delete history.
```

- [ ] **Step 2: Commit**

```bash
git add docs/meta/governance/documentation-policy.md
git commit -m "docs: add docs/meta documentation policy"
```

---

### Task 8: Root index

**Files:**
- Create: `C:\dev\docs\meta\README.md`

**Interfaces:**
- Consumes: Tasks 1-6 must be complete (links to all six subfolder READMEs plus `audit/` and `phase-8-toolforge-marketplace/`).
- Produces: the entry point for anyone browsing `docs/meta/`.

- [ ] **Step 1: Write the root index**

```markdown
# docs/meta

Governance, phase, spec, plan, and review documentation for this repo. See
[`governance/documentation-policy.md`](governance/documentation-policy.md) for naming and
placement rules before adding a new file here.

- [`governance/`](governance/README.md) — durable rules, policies, gates
- [`phases/`](phases/README.md) — phase charters, completion reports, state docs
- [`specs/`](specs/README.md) — design and integration specs
- [`plans/`](plans/README.md) — implementation plans
- [`reviews/`](reviews/README.md) — review docs
- [`audit/`](audit/README.md) — audit docs (pre-existing, unchanged by this reorg)
- [`archive/`](archive/README.md) — superseded/orphaned docs, kept for history

`docs-structure-policy-design.md` and `docs-structure-policy-plan.md` (this reorg's own design
and implementation plan) stay at the `docs/meta/` root — they document the reorg itself, not a
phase/spec/plan for the product.
```

- [ ] **Step 2: Verify all links resolve**

```bash
for f in governance/README.md phases/README.md specs/README.md plans/README.md reviews/README.md audit/README.md archive/README.md governance/documentation-policy.md; do
  test -f "docs/meta/$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: every line prints `OK: ...`.

- [ ] **Step 3: Commit**

```bash
git add docs/meta/README.md
git commit -m "docs: add docs/meta root index"
```

---

### Task 9: CLAUDE.md pointer + final full-repo verification

**Files:**
- Modify: `C:\dev\CLAUDE.md`

**Interfaces:**
- Consumes: all prior tasks complete.
- Produces: nothing consumed downstream — this is the last task.

- [ ] **Step 1: Fix `CLAUDE.md`'s two direct `docs/meta/` references**

`CLAUDE.md:14` currently reads:
```
**See:** `docs/meta/global-operating-rules-cic-rewrite-labs.md` (v2.0) — comprehensive governance, 3-class output taxonomy, conformance gate, safety boundaries, drift response.
```
Change to:
```
**See:** `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md` (v2.0) — comprehensive governance, 3-class output taxonomy, conformance gate, safety boundaries, drift response. Naming/placement rules for this folder: `docs/meta/governance/documentation-policy.md`.
```

`CLAUDE.md:108` currently reads:
```
TOOLFORGE-MARKETPLACE-SPEC-v1.0 is approved. Scope locked to four deliverables: plugin manifest schema, registry service, CLI (list/install/submit), submission validator. Phase 8 Wave D, target 2026-07-26. Changes require Tier 1 amendment. See `docs/meta/TOOLFORGE-MARKETPLACE-SPEC-v1.0.md`.
```
Change to:
```
TOOLFORGE-MARKETPLACE-SPEC-v1.0 is approved. Scope locked to four deliverables: plugin manifest schema, registry service, CLI (list/install/submit), submission validator. Phase 8 Wave D, target 2026-07-26. Changes require Tier 1 amendment. See `docs/meta/governance/toolforge-marketplace-spec-v1.0.md`.
```

Use the Edit tool for both — exact string match on the two blocks above.

- [ ] **Step 2: Final full-repo verification — every old flat path must be gone**

```bash
cd C:\dev
git grep -n "docs/meta/[A-Za-z0-9_-]*\.md" -- . ':!docs/archive' ':!docs/meta/governance' ':!docs/meta/phases' ':!docs/meta/specs' ':!docs/meta/plans' ':!docs/meta/reviews' ':!docs/meta/archive' ':!docs/meta/audit' ':!docs/meta/docs-structure-policy-design.md' ':!docs/meta/docs-structure-policy-plan.md' ':!docs/meta/README.md'
```

This searches for any `docs/meta/<file>.md` reference that is NOT inside one of the new subfolders and NOT one of the two reorg docs / new root README (which legitimately reference `docs/meta/` as a bare directory name in prose). Expected: no output. Any hit is a missed reference fix from an earlier task — go back and fix it in that task's category, then re-run this check.

- [ ] **Step 3: Confirm the pre-existing broken reference is unrelated to this change (informational, no fix required)**

```bash
git grep -n "docs/meta/ROLLBACK_RUNBOOK.md" -- .ijfw/memory/plan.md
```

This will show a pre-existing broken reference (`.ijfw/memory/plan.md` points to `docs/meta/ROLLBACK_RUNBOOK.md`, but the actual file is `docs/ROLLBACK_RUNBOOK.md` at the `docs/` root — one directory level off). This predates this reorg and isn't touched by it. Leave it — flag it to the user as a separate, pre-existing issue rather than silently fixing something outside this plan's scope.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: point CLAUDE.md governance references at new docs/meta subfolder paths"
```

---

## Post-Plan Follow-Ups (not part of this plan, flag to user)

- `docs/archive/` nested project checkouts (`.git`, `node_modules`) — separate task, needs explicit user confirmation given destructive/large blast radius (see design doc's Explicitly Out of Scope section).
- Pre-existing broken reference: `.ijfw/memory/plan.md` → `docs/meta/ROLLBACK_RUNBOOK.md` should be `docs/ROLLBACK_RUNBOOK.md`.
- `CIC-GOV-MANIFEST-001_v1.1_RECONCILED.docx` is archived as a `.docx`, not ported to living `.md` governance format — worth a follow-up if its content is still actively used.
