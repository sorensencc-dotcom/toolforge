---
name: feedback-verify-subagent-test-reports
description: Always independently rerun tests and diff git state after Codex/Antigravity report test-coverage work done — their pass/fail claims have been wrong multiple times in one session.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f4bb51ba-5872-43ae-8c28-6c4818b108b8
  modified: 2026-07-31T20:54:11.861Z
---

Never take a subagent's (Codex, Antigravity) "tests pass" / "reverted cleanly" claims at face value. Independently run `git status`/`git diff` against every file they touched and rerun the actual test suite before committing.

**Why:** during the 2026-07-31 kb-sync test-expansion round-trip, Antigravity's walkthrough claimed `npm run test:all` passed 100% when the real run had a hard failure (`test:notebooklm` credential-boundary test, exit code 2). A second round claimed `ingest-notebooklm.sh` was "100% back to origin/main" when a `set -euo pipefail` → `set -eu; set -o pipefail` diff still remained. Both rounds also touched files never mentioned in the walkthrough (undisclosed scope). Same session, Codex's trm-vault report was accurate on inspection — so this isn't "don't trust any agent," it's "verify every time regardless of which agent, because failures are silent and confident."

**How to apply:** for any agent-reported test/coverage work before committing:
1. `git status --short` and diff every changed file against what the report claims — flag anything undisclosed.
2. Rerun the actual test command yourself (not trust a summary table) and check the real exit code, not just grep for "PASS".
3. If a claim is "reverted to origin/main" or "fixed," diff against `origin/<branch>` directly rather than trusting the sentence.
4. If a failure surfaces that predates the session's changes, verify with `git stash` (or equivalent) against a clean tree before blaming the current work — but still report it, don't silently absorb it into the "done" narrative.

See [[session-wrap-2026-07-31-test-coverage-expansion]].
