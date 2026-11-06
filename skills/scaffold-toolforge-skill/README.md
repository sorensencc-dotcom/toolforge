# Scaffold Toolforge skill

Create a compliant skill and register it in one pass.

## Quick start

Say "scaffold a skill called my-skill". Claude creates the directory, adds the manifest entry, bumps the pinned count, and runs the validators.

## What it does

- Validates the id and refuses to overwrite an existing skill.
- Keeps README under 100 lines and SKILL.md under 150.
- Edits `manifest.json` in place so the diff holds only the new entry.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
