---
name: feedback_push_discipline_hook
description: "Stop hook auto-checks c:\\dev, cic-ingestion, CIC submodule for unpushed commits every session end"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: de2ca311-9be7-4aba-9bcb-4e4a5a671e02
---

Global Stop hook `C:\Users\soren\.claude\hooks\check-push-discipline.js`, wired in `~/.claude/settings.json` hooks.Stop, checks three repos (c:\dev, c:\dev\cic-ingestion, c:\dev\cic) for commits ahead of `@{u}` on every Claude Code stop event (turn end, clear, resume, compact). Prints a systemMessage listing unpushed repo/branch/count if any found; silent when clean.

**Why:** repeated retro finding — sessions ended with commits sitting locally across concurrent repos, causing rebase-and-retry churn when other automation (release-bot, submodule bumps) landed mid-gap. See [[session-wrap-2026-07-15-reconciliation-retro]].

**How to apply:** don't manually re-derive "check git status across repos" busywork at session end — the hook already does it and will speak up. If the hook goes silent unexpectedly (new repo added, path moved), update the REPOS list or `CHECK_PUSH_DISCIPLINE_REPOS` env override in the script.
