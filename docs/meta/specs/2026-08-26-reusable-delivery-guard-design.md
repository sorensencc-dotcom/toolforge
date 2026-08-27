# Reusable delivery guard design

Date: 2026-08-26
Status: Draft for implementation planning

## Goal

Provide one reusable, repository-agnostic guard for commit and provider-delivery workflows. The guard keeps generated artifacts out of authored commits, requires regression coverage for automation changes, validates installed hook artifacts, enforces paid-provider budgets before dispatch, and records post-push repository state.

## Scope

The first implementation targets `CIC-GOVERNANCE`, then adds thin adapters for `kb-sync`, `trm`, and `cic-ingestion`. Repository-specific behavior stays in configuration: generated-path patterns, automation-path patterns, test commands, hook installation command, and provider price sources.

## Components

1. `delivery-guard` shared core: diff classification, policy evaluation, receipt schema, and budget reservation interfaces.
2. Repository adapter: resolves repository root, changed paths, configured tests, and installed hook location.
3. Hook/CI runners: invoke identical checks; CI remains authoritative.
4. Provider budget adapter: estimates cost, atomically reserves budget, releases unused reservation, and rejects `budget_exhausted` before paid dispatch.
5. Push receipt wrapper: runs the requested push, then records `git status --short --branch` for every involved repository.

## Policy

- Generated-only changes require explicit intent.
- Mixed authored/generated changes warn with exact paths and recommend separation; CI may block them per repository policy.
- Automation changes require a regression test in the same commit, unless an explicit, recorded exemption applies.
- Hook tests install the generated artifact into a temporary repository and execute that installed artifact.
- Paid providers require an estimate and successful budget reservation before network dispatch.
- Local or zero-cost providers use the same interface but do not consume paid budget.
- Receipts record repository, branch, push result, status output, policy decisions, provider, estimate, actual cost, and remaining budget. Never record secrets or prompts.

## Testing

- Unit tests cover path classification, mixed-change policy, budget boundaries, reservation release, and receipt serialization.
- Integration tests create a temporary repository, install the hook, execute it, and assert required checks are active.
- Automation-change fixtures prove a production automation edit without a regression test fails, while a paired test passes.
- Provider tests prove no paid request occurs after budget rejection.
- Push-wrapper tests use a fake Git executable or temporary remote and assert post-push status is captured.
- Each repository adapter runs its focused tests in CI; full-suite, live-provider, and production evidence remain separate claims.

## Rollout

1. Implement and test the shared core in `CIC-GOVERNANCE`.
2. Pilot CI enforcement and advisory local hooks in `CIC-GOVERNANCE`.
3. Add adapters for `kb-sync`, `trm`, and `cic-ingestion`.
4. Promote generated-artifact and automation-test checks from advisory to blocking after one clean cycle per repository.
5. Enable paid-provider budget enforcement before any provider path becomes normal operation.

## Non-goals

- Automatically deleting generated files.
- Automatically rewriting commits or commit messages.
- Automatic live-provider calls.
- Treating local hook success as proof of CI, live, or production readiness.
