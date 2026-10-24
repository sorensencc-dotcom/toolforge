# Start-session preflight

Verify the repo you are about to touch, then print a six-line brief from STATUS.md.

## Quick start

```bash
node skills/start-session-preflight/src/index.mjs C:\dev\<repo>
```

## What it does

- Runs `C:\dev\scripts\verify-repo-context.ps1` and stops on failure.
- Reads the latest Active goal, Completed work, Decisions, Tests, Blockers, and Next action from STATUS.md.
- Prints `PREFLIGHT: PASS` or `PREFLIGHT: FAIL` plus the brief.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
