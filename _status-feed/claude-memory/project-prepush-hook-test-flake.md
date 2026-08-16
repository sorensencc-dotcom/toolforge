---
name: project-prepush-hook-test-flake
description: trm repo pre-push flake in analyzeFrames.test.ts / ingestDir.test.ts — root-caused and fixed 2026-08-14 (commit cf2cddf)
metadata: 
  node_type: memory
  type: project
  originSessionId: ad7dd25b-eab9-4815-b098-9b74ce197d61
  modified: 2026-08-14T04:40:48.834Z
---

FIXED 2026-08-14 (c:\dev\trm, commit cf2cddf). Root cause: 3 spots (2 in analyzeFrames.test.ts, 1 more spread across 2 in ingestDir.test.ts) snapshotted async state after one fixed real `setTimeout` (40ms/100ms) instead of polling for the condition. Full-suite pre-push runs 79+ parallel Jest suites (2 spawn real CLI subprocesses, 70s+ each); under that CPU contention the fixed window wasn't reliably enough wall-clock time for the awaited async work to progress, so the snapshot caught pre-condition state and asserts failed nondeterministically. Reproduced 1/3 full-suite runs failing pre-fix, 0/4 post-fix.

**Why kept:** if similar "sleep N ms then snapshot once" patterns turn up flaky elsewhere in this repo (or others), same fix applies — replace with a poll loop against the actual condition (deadline + short interval), per superpowers:systematic-debugging's condition-based-waiting technique.

**How to apply:** no longer active — closed. Only relevant now as a pattern reference for future timing-flake reports in trm or sibling repos.
