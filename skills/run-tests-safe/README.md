# Run tests safe

Run test suites with a 60s cap so a hang costs one minute, not the session.

## Quick start

Say "run tests" or "tests hung". Claude runs the suite under `timeout 60`, and on a hang kills the process tree, clears stale locks, and names the hanging file.

## What it does

- Refuses bare `npm test`; every run is capped.
- Reports `pass`, `fail`, or `hung` from real output only.
- Deletes only `.staging.lock` and `.kb-sync.lock`, never anything else.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
