---
name: sleep-no-prompt-skill
description: Global shared skill; auto-approve sleep/Start-Sleep commands without permission prompts
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6808a1c8-2869-4006-a21c-7beae1f15e65
---

## sleep-no-prompt Skill

**Location:** `C:\Users\soren\.claude\skills\sleep-no-prompt.md` (global, user-level)

**Status:** Active (permissions added to `~/.claude/settings.json`)

### What It Does

Adds global permission rules to auto-approve sleep commands:
- `Bash(sleep *)` — Bash sleep command
- `PowerShell(Start-Sleep *)` — PowerShell Start-Sleep cmdlet

### Why

Sleep commands are safe:
- Never modify files or state
- Only pause execution
- Used for polling, test waits, CI timing
- Unnecessary permission prompts clutter workflows

### Configuration

**Location:** `~/.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(sleep *)",
      "PowerShell(Start-Sleep *)"
    ]
  }
}
```

### Usage

No special setup needed. Commands execute automatically:

```bash
# Bash
sleep 5

# PowerShell
Start-Sleep -Seconds 5
Start-Sleep -Milliseconds 500
```

### Scope

- **Global:** All projects inherit this rule
- **Persistent:** Persists across sessions
- **Shareable:** Skill file at ~/.claude/skills/ can be referenced by team

### Related Skills

- [[fewer-permission-prompts]] — Broader permission allowlist (8 rules)
- [[permission-audit]] — Audit tool for permission patterns
- [[permissions-allowlist-2026-06-14]] — Allowlist history

### Decision Rationale

Sleep commands should never require user approval because:
1. **Zero side effects** — no data/file changes
2. **Common pattern** — polling loops, test waits, timing
3. **Low risk** — worst case: unnecessary pause, no data loss
4. **High friction** — each `sleep 2` in a loop = unwanted prompt

This rule reduces permission prompt fatigue for routine operations.
