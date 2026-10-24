# Wrap session

Close a session in a fixed order: retro gate, STATUS.md update, push.

## Quick start

Say "wrap session" or "wrap and push". Claude runs the gate, writes the STATUS.md section, and pushes only when you asked.

## What it does

- Skips `/retro` when `scripts/check-retro-needed.ps1` exits 1.
- Writes one dated `Session wrap` section and replaces it on a same-day rerun.
- Pushes the current branch without force, never to `main`, and verifies the result.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
