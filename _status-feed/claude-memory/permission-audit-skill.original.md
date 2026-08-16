---
name: permission-audit-skill
description: Global shared skill for scanning transcripts and updating ~/.claude/settings.json allowlist — invoke with /permission-audit
metadata: 
  node_type: memory
  type: reference
  originSessionId: 70c2ba25-27a8-4049-880c-0fbb3c107492
---

Global skill file at `C:\Users\soren\.claude\skills\permission-audit.md`.

Invoke with `/permission-audit` in any Claude Code session across any project.

**What it does:** Scans the 20 most recent transcript JSONL files, extracts PowerShell/Bash command patterns, filters out auto-allowed and dangerous ones, adds safe high-frequency patterns (≥3 hits) to `~/.claude/settings.json` permissions.allow.

**Why:** After long sessions with repeated permission prompts, this consolidates the patterns into permanent rules so future sessions don't prompt for the same commands.

**Key rules for the skill:**
- Never allowlist interpreter wildcards (python *, node *, bash *, etc.)
- Never allowlist task-runner wildcards (npm run *, bun run *, etc.)
- CIC scripts get explicit path-based rules: `PowerShell(& 'C:\CIC_MEDIA_LIBRARY\CIC\scripts\*.ps1' *)`
- Settings file: `C:\Users\soren\.claude\settings.json`
- Transcripts: `C:\Users\soren\.claude\projects\**\*.jsonl`

**Related:** [[approval-infrastructure-location]] [[skills-policy-agent-requirement]]
