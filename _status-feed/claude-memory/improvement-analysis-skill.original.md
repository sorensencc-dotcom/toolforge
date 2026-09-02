---
name: improvement-analysis-skill
description: Continuous improvement analysis skill — monthly/on-demand session & phase audits
metadata: 
  node_type: memory
  type: reference
  originSessionId: b2773de7-f30a-4d70-832d-49850901fced
---

# Improvement Analysis Skill

Comprehensive monthly or on-demand audit of Claude Code sessions, phases, and processes.

## Location

- Skill definition: `C:\Users\soren\.claude\skills\improvement-analysis.md`
- Implementation: `C:\Users\soren\.claude\skills\improvement-analysis.js`

## What It Analyzes

- **Usage patterns** — session frequency, duration, peak hours
- **Token efficiency** — estimated cache hits, cost per session, model distribution
- **Permission hotspots** — most-blocked tools, candidates for allowlist
- **Bottlenecks** — repeated queries, context resets, permission denials
- **Skill gaps** — manual tasks appearing 3+ times → skill creation candidates
- **Phase velocity** — time between commits per phase, blockers, critical path
- **Git history** — phase progression, commit frequency, blocker detection

## Usage

Run immediately:
```bash
node ~/.claude/skills/improvement-analysis.js days:14
node ~/.claude/skills/improvement-analysis.js days:7 detailed:true
```

## Output

Generates structured report with:
- Usage snapshots (session count, avg duration, peak hours)
- Permission hotspots (ranked by frequency and cost)
- Phase velocity (time/phase, blockers)
- Skill gaps (candidates for automation)
- Prioritized recommendations (ranked by impact: time saved, tokens, unblock size)

## Scheduling

To run monthly on 1st of month:
```bash
/schedule improvement-analysis monthly "0 9 1 * *" node ~/.claude/skills/improvement-analysis.js days:30
```

Or via cron hook in settings.json:
```json
{
  "hooks": {
    "monthly-improvement-audit": {
      "trigger": "cron:0 9 1 * *",
      "command": "node ~/.claude/skills/improvement-analysis.js days:30 > ~/improvement-reports/$(date +%Y-%m-%d).txt"
    }
  }
}
```

## Related

- [[skills-policy-agent-requirement]] — skill governance
- [[permission-audit-skill]] — permission allowlist management
