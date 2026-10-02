---
name: session-wrap-2026-09-30-meridian-icf-dashboard-restructure
description: "Meridian→ICF dashboard integration shipped and pushed; both investigations resolved; only open item is the unidentified auto-commit process"
metadata:
  node_type: memory
  type: project
  originSessionId: 0a725368-bc5f-4339-a310-f665c6c37e9c
  modified: 2026-10-01T11:50:00.009Z
---

Meridian (local focus tracker, `~/.meridian/meridian.db`, SQLite, read-only) wired into ICF dashboard on 2026-09-30. Pushed: C:\dev `parkd821-20260908` through `e27c7f84`+, icf `fix/dashboard-docs-button-8001` through `0bf8894`.

Resolved 2026-09-30:
- "Missing report" was the Weekly Retro panel hidden inside the Weekly view (Reporting defaults to Daily). Fixed in icf `0bf8894`: the panel now renders under both views.
- Meridian history depth: Meridian was installed 2026-08-22, so no earlier data exists. `app_sessions` is not pruned. `capture_frames` keeps about 30 days. 09-09..12 have sessions but the ETL never ran, so no summaries exist (they could be regenerated). 09-16..18 are empty because Meridian was not running. The 6.9 GB `meridian.db.encrypted-backup-20260929114959` is the pre-encryption-migration backup, not an archive.
- Isolation check passed after the 21:00 run (user-confirmed).
- User decision: idle (`idle_personal`) time does NOT count toward tracked totals. This is already implemented via `IDLE_CATEGORY` in `modules/telemetry/meridian-telemetry.mjs`.

**Why:** user wants per-day review + weekly summary of their work; no 9-5 employer work on this machine (confirmed), so Meridian data is personal-only.

Auto-committer (investigated 2026-10-01): the Antigravity IDE agent commits and pushes on its own. This is confirmed from its conversation DBs (`~/.gemini/antigravity/conversations/*.db`, which embed `"CommandLine":...` JSON). It made `646a736a` (`git add -u` swept in 36 unrelated files), the 09-29 icf/dev commits, and the kb-sync `fix(trm)` commits (pushed, with `-c core.hooksPath=""` on checkout/clean). `21b5662`, `d4d7dec`, and `b1ea095b` are still unattributed: Antigravity is likely but unproven, and every other agent store, hook, scheduled task, and daemon was ruled out (details in STATUS.md item 5). Recommended fix: restrict Antigravity's git commit/push/clean/checkout allowlist.

**How to apply:** If unexplained commits appear, first run a scan for `"CommandLine"` across the Antigravity conversation DBs. Still open: confirm whether the commits stop after the Antigravity allowlist is restricted. The retro endpoint data was last dated 2026-09-26 (stale). Screen-derived columns (narrative, day_tasks.summary, plan evidence, window_titles) must never be selected. See [[project-meridian-claude-isolation]].
