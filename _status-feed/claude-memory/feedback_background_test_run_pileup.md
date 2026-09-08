---
name: feedback-background-test-run-pileup
description: Never leave overlapping background npm test runs alive against sigil-repo; they deadlock on the shared Postgres and the long pre-push hook
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 595e1447-fa33-4403-8df8-b268e493acb2
  modified: 2026-09-03T00:53:39.121Z
---

In `C:\dev\sigil-repo`, the pre-push hook runs the full `node --test` suite,
which takes more than 10 minutes — longer than a single Bash/PowerShell tool
timeout. Across one session I started ~4 background `npm test` runs plus a
background `git push` (whose hook runs the suite again). They all contended for
the shared local Postgres (`localhost:55432`) and fixed ports, leaked 130+
`node.exe` processes, and deadlocked. Output files stayed 0 bytes; the push
wedged with no progress for 35+ minutes. The user watched "2 hours" of "still
waiting" with nothing to show.

**Why:** the suite is not parallel-safe across concurrent whole-suite runs
against one database, and the tool harness tears down foreground runs at the
timeout, leaving orphaned worker pools that never release their DB/port locks.

**How to apply:**
- Run at most one whole-suite `npm test` at a time. Never start a second while
  one is in flight or wedged.
- To confirm a push, background the `git push` alone (its hook is the suite) and
  do not also run `npm test` separately.
- Before retrying after a wedge: `TaskStop` every stale test/push task, then
  `Get-Process node | Stop-Process -Force`, verify the count drops, then retry.
- For fast local confidence, run only the touched suites
  (`node --test sigil/relay/v1/accept-envelope*.test.mjs`) and let the pre-push
  hook be the full gate.

Related: [[feedback_checkpoint_long_autonomous_chains]],
[[session-wrap-2026-09-02-sigil-i1-slice-shipped]].
