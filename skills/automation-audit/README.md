# automation-audit

Read-only repo scan for automation opportunities: oversized logs, backup dirs
needing retention policy, scripts with manual-step markers. Migrated from
`~/.claude/skills/automation-audit.md` (global, hardcoded to `C:\CIC_MEDIA_LIBRARY`,
PowerShell-only) on 2026-07-17 — generalized to any `repoRoot`, pure Node/TS.
See `SKILL.md` for full spec.

```
npm test
```
