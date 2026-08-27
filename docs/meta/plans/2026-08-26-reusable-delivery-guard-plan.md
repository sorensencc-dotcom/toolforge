# Reusable delivery guard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build reusable delivery-integrity and provider-economics controls for multiple repositories.

**Architecture:** `CIC-GOVERNANCE` owns a small Node package. Each repository adds a thin adapter and configuration. Phase 1 covers delivery integrity; Phase 2 covers durable paid-provider budgets.

**Tech Stack:** Node.js, existing Git hooks, GitHub Actions, JSONL receipts, atomic filesystem ledger.

**Spec:** `docs/meta/specs/2026-08-26-reusable-delivery-guard-design.md`

## Global constraints

- Keep generated/wiki artifacts out of authored commits.
- Test installed hook artifacts, not only source templates.
- CI is authoritative; local hooks are advisory.
- Paid dispatch must reserve budget before network execution.
- Never record secrets or prompts in receipts.
- Preserve unrelated dirty work.

## Phase 1: Delivery integrity

### Task 1: Define adapter configuration

Files: create the package configuration and adapter contract under `CIC-GOVERNANCE/packages/delivery-guard/`; test valid and invalid repository configurations.

- [ ] Write tests for generated paths, automation paths, test commands, hook installer, and repository identity.
- [ ] Implement explicit configuration validation.
- [ ] Run focused package tests.
- [ ] Commit only package source and tests.

### Task 2: Implement diff classification

Files: create classifier module and tests.

- [ ] Test authored-only, generated-only, mixed, deleted, renamed, and untracked path cases.
- [ ] Implement deterministic classification with exact path output.
- [ ] Test explicit generated intent and missing intent.
- [ ] Run focused tests.

### Task 3: Add CI automation-test policy

Files: create policy evaluator, CI wrapper, and tests in `CIC-GOVERNANCE`.

- [ ] Test automation changes without paired regression tests fail.
- [ ] Test paired production/test changes pass.
- [ ] Test explicit exemption requires a recorded reason.
- [ ] Wire evaluator into CI; keep local hook output advisory.
- [ ] Run focused tests and the CI validator.

### Task 4: Test installed hooks

Files: extend `CIC-GOVERNANCE/scripts/setup-git-hook.mjs` tests and add temporary-repository fixtures.

- [ ] Install the generated hook into a temporary repository.
- [ ] Execute the installed hook with passing and failing fixtures.
- [ ] Assert required checks exist in the installed artifact.
- [ ] Run the hook integration suite.

### Task 5: Add scoped push receipts

Files: create push wrapper, manifest parser, JSONL receipt writer, and tests.

- [ ] Test current-repository default and explicit multi-repository manifest.
- [ ] Test push success, push failure, and status-command failure.
- [ ] Write receipts outside repositories at user-level storage.
- [ ] Assert secrets and prompts never appear.
- [ ] Run focused receipt tests.

## Phase 2: Provider economics

### Task 6: Implement durable budget ledger

Files: create ledger, reservation, and recovery modules plus tests.

- [ ] Test exact-boundary reservation, insufficient budget, release, restart replay, and malformed records.
- [ ] Test concurrent reservations cannot overspend.
- [ ] Implement append-only records with atomic reservation semantics.
- [ ] Run focused ledger tests.

### Task 7: Add provider dispatch guard

Files: adapt `OpenRouterProvider` and its tests.

- [ ] Test budget rejection causes zero network calls.
- [ ] Test estimate, reserve, dispatch, actual-cost record, and unused release.
- [ ] Test provider failure closes or releases reservations correctly.
- [ ] Run provider-focused tests without live credentials.

### Task 8: Add repository adapters

Files: adapters/configuration for `kb-sync`, `trm`, and `cic-ingestion`.

- [ ] Add one contract test per adapter.
- [ ] Verify each adapter points to installed hooks and real CI commands.
- [ ] Run focused tests per repository.
- [ ] Review generated output and stage authored paths only.

## Verification gate

- Run package tests, adapter tests, type checks, and `git diff --check`.
- Inspect `git diff --stat` and classify every changed path as authored or generated.
- Run installed-hook tests.
- Confirm no live provider call occurred.
- After push, run `git status --short --branch` in each manifest repository.
