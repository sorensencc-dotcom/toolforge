---
name: run-tests-safe
description: Run tests under the AGENTS.md Command & Test Execution Protocol - hard 60s timeout, hang detection, stale-lock cleanup, and the hanging test file named. Use whenever the user says "run tests", "run the suite", "npm test", "tests hung", "tests are stuck", or "why is the test run frozen", and before any bare npm test or node --test call in this repo.
compatibility: |
  - Runtime: Node.js 18+, GNU timeout (Git Bash)
  - Dependencies: git, the repo's test runner
  - Permissions: read:repo, write:file (lock files only)
---

# Run tests safe

A bare `npm test` can hang forever on an unclosed DB handle or socket and stall the whole session. A hard cap plus a fixed recovery path turns a hang into a named file within a minute.

## Trigger

"run tests", "npm test", "tests hung", "tests are stuck".

## Steps

1. **Run under a cap.** Never run a bare `npm test`. Use:
   ```bash
   timeout 60 npm test
   ```
   For one file: `timeout 60 node --test --test-timeout=15000 <file>`. `runWithTimeout` in `src/index.mjs` does the same and also trips when the process prints nothing for 60s.

2. **Classify with `classifyRun`.** `pass` needs exit 0 and visible output. Exit 124, a kill, or 60s of silence is `hung`. Anything else is `fail`. Silence is never a pass.

3. **On hung, name the file.** `findHangingFile(output)` returns the last test file that started without a result line. If it returns null, say the file is unknown instead of guessing.

4. **Recover.** Kill the whole process tree (`killTree`), then clear the locks with `clearLocks`. They are `.staging.lock` (written by `modules/wiki/detect-drift` into the staging root, usually `_kb-sync-staging/`) and `.kb-sync.lock`. Pass the repo root, `kb-sync/`, and `_kb-sync-staging/`. Only those two names are deleted; if a lock holds a live PID, tell the user first.

5. **Rerun the hanging file only** with `--test-timeout=10000`:
   ```bash
   timeout 60 node --test --test-timeout=10000 <hanging-file>
   ```
   For jest add `--detectOpenHandles`; for vitest use `--testTimeout=10000` (it has no `--detectOpenHandles`). `retryArgs(runner)` returns the flags.

6. **Report real output.** Quote the summary lines you saw: counts, the failing test, or the hanging file. Never claim a pass you did not see.

## Input Schema

```typescript
interface RunInput { command: string; repoPath: string; timeoutMs?: number; idleMs?: number }
```

## Output Schema

```typescript
type RunClass = "pass" | "fail" | "hung";
interface RunResult { code: number | null; output: string; timedOut: "idle" | "hard" | null }
```

## Full Reference

For Setup, Requirements, Configuration, Testing, Troubleshooting, and Integration:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**
