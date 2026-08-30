# wiki-sync-recovery

Diagnose a failed GitHub wiki sync from its log and print the fix runbook.

**Status**: Experimental
**Version**: 0.1.0
**Runtime**: Node.js 18+ (no dependencies)

---

## What it does

- Matches a `sync-github-wiki.mjs` failure log against four known failure modes.
- Prints, per match, the root cause, where the fix lives (`file:line`), and the operator action if it regressed.
- Emits `--json` for automation; exit code signals matched / no-match / bad input.

---

## Quick Start

```bash
# Pipe a live run
node scripts/sync-github-wiki.mjs 2>&1 | node skills/wiki-sync-recovery/src/diagnose.mjs

# Or a saved log
node skills/wiki-sync-recovery/src/diagnose.mjs --log C:\dev\logs\wiki-sync.log

# Machine-readable
node skills/wiki-sync-recovery/src/diagnose.mjs --json --log wiki-sync.log
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation).

This skill requires only Node.js 18+ and read access to the repo. No install step,
no `package.json`.

---

## Inputs & Outputs

See [SKILL.md](./SKILL.md) for the complete schema.

- **Input**: wiki-sync log via stdin or `--log FILE`; optional `--json`.
- **Output**: text runbook entries, or `{ status, matched[], timestamp }` with `--json`.

---

## Troubleshooting & Examples

See [docs/USAGE.md](./docs/USAGE.md) for the full runbook and worked examples.

---

## See Also

- [scripts/sync-github-wiki.mjs](../../scripts/sync-github-wiki.mjs) — the script this skill diagnoses
- [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)
- [../SKILLPACK-VALIDATION.md](../SKILLPACK-VALIDATION.md)
