---
name: session-wrap-2026-09-28-toolforge-pr64-delivery-guard-fixed-merged
description: "toolforge PR #64 review findings fixed + recurring delivery-guard CI failure root-caused and fixed, merged"
metadata:
  node_type: memory
  type: project
  originSessionId: 5153bde9-dfd1-46f1-b10b-834cffbffc16
  modified: 2026-09-28T23:36:57.106Z
---

toolforge repo, PR #64 (`fix/governance-gate-and-wiki-alignments`) — reviewed, fixed, merged `18dac374` 2026-09-28.

**Review findings fixed (3 real, 1 false-positive):**
- `scripts/git-push-and-wait.ps1` `Test-CheckCompleted`: treated legacy `EXPECTED` status-context state as "completed" — let the merge gate fire before a required check ran. Removed `EXPECTED` from the accepted-state list.
- `.github/workflows/retro-full-audit.yml`: two `Sort-Object Name | Select-Object -Last 1` steps mis-ordered retro JSON filenames once a same-day counter hit two digits (`-10` sorts before `-2`). Fixed with a proper date+int sort key (both occurrences).
- `memory/MEMORY.md`: PR had accidentally rewritten the whole file CRLF→LF, turning a 3-bullet add into a ~125-line diff. Reconstructed from main's original bytes, kept diff to the real 7 lines added.
- False positive: claimed busy-loop at `git-push-and-wait.ps1:142` — verified `Start-Sleep` already present before `continue`. Not a bug, did not touch it.

**Recurring "Delivery guard automation policy" CI failure — root cause:**
`CIC-GOVERNANCE/packages/delivery-guard` evaluates the policy **per commit** across the whole base..head range, not on the aggregate PR diff. Any single commit touching an automation path (`.github/workflows/**`, `scripts/**`, etc.) without touching a regression-test path in that *same* commit fails the gate — adding the test in a later commit doesn't satisfy it. Both the PR author's original commit and my own fix commit independently violated this. Fix: squashed the automation-path-touching commits + their paired test commit into one, re-merged `origin/main`, force-pushed. Verified locally first with `evaluate-automation-policy.mjs --base origin/main --head HEAD` (exit 0) before pushing.

**Worktree `C:\toolforge-pr64` removed** (2026-09-28, this session) — no longer needed, PR merged.

Nothing open from this thread. See [[session-wrap-2026-09-27-repo-sprawl-audit-done]] for the actual open repo-sprawl work (steps 7/8 of that plan) — unrelated, still pending, not touched this session.
