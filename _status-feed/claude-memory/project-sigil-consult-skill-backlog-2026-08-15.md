---
name: project-sigil-consult-skill-backlog-2026-08-15
description: "Backlog idea from user — turn \"send current context to a Sigil peer for feedback\" into a proper skill"
metadata: 
  node_type: memory
  type: project
  originSessionId: f2b61664-db06-4322-a0b2-7f2788dcbb07
  modified: 2026-08-16T04:44:35.581Z
---

User idea (2026-08-15, during sigil `inbox --wait` design): what we did manually this session — asking Codex's opinion on a design by sending it context over Sigil and reading the reply back — should become a skill (e.g. `/sigil-consult`) rather than hand-typed `sigil send`/inbox checks each time.

**Why:** proved useful in-session (got a real second opinion on the `inbox --wait` design from Codex, converged fast) but required manual message composition and manual inbox polling both directions.

**Status: shipped 2026-08-16.** `sigil inbox --wait` landed (commits 5699106, 40525a5 in sigil-repo) and was proven live (round-trip, zero manual relay, both directions). Skill built at `C:\dev\.claude\skills\sigil-consult\SKILL.md` — codifies send + backgrounded `inbox --wait` + report-on-notification. Depended on [[project-sigil-npm-packaging-decision-2026-08-15]]'s auto-trigger work, which is why it was deferred until tonight.
