---
name: session-wrap-2026-09-06-tdd-task-runner-skill-built
description: Weekly skill audit run; built new personal skill tdd-task-runner at ~/.claude/skills/
metadata: 
  node_type: memory
  type: project
  originSessionId: 3dacb133-4419-4acf-a6ce-ab75739ed79d
  modified: 2026-09-06T17:10:35.409Z
---

Weekly skill audit (week of 2026-08-30..09-06). Audit surfaced 3 friction patterns
worth a skill: skillpack-sync, sdd-task-executor, tdd-task-runner. Operator picked
**tdd-task-runner** to build.

Built: `C:\Users\soren\.claude\skills\tdd-task-runner\SKILL.md` (registered, loads).
Standalone (no superpowers dep). Personal skills dir, not a repo — portable across
IronLedger / sigil-repo / toolforge.

Design decisions locked:
- One task per invocation, hard stop after every task. No auto-merge, no inferred
  approval, no internal loop. Chosen because of repeated fabricated-operator-approval
  incidents (Antigravity Phase 1; IronLedger `cc52a77`/`4d77e5a` revert+reapply).
- Ledger at `.git/tdd-runner/<slug>/progress.md` — inside `.git/`, never stageable,
  so the auto-commit daemon can't sweep it into `add -A`.
- RED accepts impl-missing import/collection errors as valid (greenfield TDD);
  rejects only test-file syntax errors.
- Baseline for a task = prior task's recorded `tests_after` count, not the plan's
  opening number (which goes stale after task 1).
- Commits to current feature branch; refuses on `main`/`master`/detached.
- `attempts` persisted in ledger so the 3-strikes -> `blocked` rule survives
  re-invocation.
- HEAD recorded at task start; commit aborts if HEAD moved underneath (daemon race).

Ran `/caveman:caveman-review` on the design before writing — 12 findings, all folded
into the SKILL.md.

First real exercise: dry-run of Task 1 (migration 0005) of the IronLedger Phase 3
plan (Antigravity-authored, at `.gemini/antigravity/brain/5866062e-.../implementation_plan.md`).
Ran end to end on branch `ironledger/phase-3-impl` off `main` (discarded after):
ledger created under `.git/tdd-runner/`, RED classified (`assert 4==5` + impl-missing
table), GREEN scoped 3/3, full-suite gate fired and **stopped without committing** on
2 new failures — a real plan defect: migration 0005 bumps schema `current_version`
4->5, breaking hard-coded `== 4` asserts in `tests/test_migration_0004.py:51` and
`tests/test_manifests.py:50` that the plan's Task 1 never updates (its Step 4 runs
only the scoped test). Folded as plan finding T6.

Two skill bugs to fix in `~/.claude/skills/tdd-task-runner/SKILL.md`:
- **B1 (real):** §0 clean-tree check uses bare `git status --porcelain`; IronLedger
  always has untracked `.context/` + `.ijfw/` tooling dirs, so the skill refuses to
  run. Fix: hard-stop only on `--untracked-files=no` (tracked changes); warn, not
  stop, on untracked.
- **B2 (minor):** slug hash algo unspecified — pin it (`sha1sum`, first 8 chars).

Audit also found: Phase 2b already shipped in `C:\dev\IronLedger` (memory
`session-wrap-2026-09-03-ironledger-phase-2b-plan-approved` said execution deferred —
it has since landed: `test_cli_*_phase2b.py`, exit evidence, `9fa6c54`).
