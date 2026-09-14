---
name: project-weekly-retro-automation-2026-09-13
description: "toolforge (C:\\dev) has an elevated Windows scheduled task running /retro weekly, unattended — don't dupe with a new cron/daily job."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1772694d-777c-4023-bb09-059fd7300bb4
  modified: 2026-09-13T15:04:08.794Z
---

Weekly `/retro` automation set up 2026-09-13 for `C:\dev` (toolforge repo).

- Wrapper: `C:\dev\scripts\run-weekly-retro.ps1` — runs `claude -p "/retro" --permission-mode bypassPermissions`, logs to `C:\dev\logs\retro\retro-<timestamp>.log`.
- Windows Task Scheduler task `ToolforgeWeeklyRetro`: Sundays 08:00 local, `/RL HIGHEST`, `/RU` the user's account, "run whether logged on or not" (password stored on the task via `/RP`).
- Confirmed registered by user 2026-09-13.

**Why:** User wanted hands-free weekly engineering retros without remembering to run `/retro` manually, and wanted it survive being logged off (elevated Task Scheduler, not [[CronCreate]]-based — that tool is session-only, expires after 7 days, dies on logoff, so it couldn't satisfy "runs whether I'm logged on or not").

**Prior state checked (still true unless changed):** `.github/workflows/governance.yml` (retro-schema job) and `.github/workflows/retro-full-audit.yml` (daily cron) only *validate/audit* existing `.context/retros/*.json` files — neither one generates new retros. This new scheduled task is the only thing that actually produces a fresh retro on a cadence.

**How to apply:** Before proposing any other retro-generation automation (daily, CI-triggered, another cron) for this repo, check this task exists and is the single source — don't duplicate. If the user asks to change cadence, edit `run-weekly-retro.ps1` and reschedule via `schtasks /Change /TN "ToolforgeWeeklyRetro" ...` rather than creating a second task.
