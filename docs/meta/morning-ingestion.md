# Morning ingestion automation (Tier 3)

Moved from `AGENTS.md` on 2026-11-01.

**Scheduled Task:** Daily 06:00 AM ET via `morning-ingestion-dashboard` skill

**Scope:** Calendar ingestion (7-day window) + email classification (last 24h, unread) + AI newsletter detection + Gmail cleanup + drift detection

**Outputs:** 
1. Cowork artifact (`morning-ingestion-YYYYMMDD`) — persisted dashboard with calendar, email summary, priority surface
2. Slack post to `#morning-ingestion` (C0BCNS1597U) — formatted briefing with action items, red/yellow/blue classification
3. Notion page in 📰 Morning Briefings database (data_source_id: `13943a85-930f-418e-a112-98ee24600032`) — structured record with run metadata, classification scores, drift signals

**Properties tracked in Notion:**
- Name, Date (YYYYMMDD), Run ID, Status (COMPLETE/DEGRADED/PARTIAL)
- 🔴 Red Items, 🟡 Yellow Items, 🤖 AI Newsletters, Total Unread, Classification Score
- Dashboard Link (Cowork artifact), Slack Link (message permalink), Drift Events, Key Action Items, Notes

**Drift Detection:** Compares current run to prior baseline (prior artifacts + Notion database). Flags new GitHub CI failures, unresolved issues, abnormal email spikes

**Policy:**
- No Gmail deletions (label + archive only)
- GitHub CI failures tagged for investigation
- No email fallback (channel retired; Slack + Notion only)
- Graceful degradation if Notion/Slack unavailable (artifact persists, status marked DEGRADED)