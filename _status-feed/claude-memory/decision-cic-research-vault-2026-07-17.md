---
name: decision-cic-research-vault-2026-07-17
description: "research source material (PDFs, ingest output) moved out of cic-ingestion git repo to C:/dev/cic-research-vault/, meant for Google Drive sync"
metadata: 
  node_type: memory
  type: project
  originSessionId: 43186584-9fe7-4ccc-86ff-7210873adc78
---

Research/ingest source material (source PDFs, extracted JSON) should not live in the git repo. Moved `pdf/incoming/` + `pdf/processed/` out of `C:/dev/cic-ingestion/` to `C:/dev/cic-research-vault/pdf/`. Repo's `.gitignore` now excludes `pdf/`.

**Why:** user wants research material easily shareable/usable for websites/social media via Google Drive, not buried in git history. Also avoids repeat GitHub large-file warnings (one PDF was already 57.74MB, over the 50MB soft limit) — [[project-cic-ingestion-scaffold-handoff-2026-07-17]] pipeline work pushed it once before this was caught.

**Decision:** stop-tracking-going-forward, not history purge — repo is private, user chose to leave the one already-pushed PDF in history at commit `ba19ea16` rather than force-push/rewrite.

**How to apply:** any future CIC ingestion source material (PDFs, raw scans, extracted docs) goes in `C:/dev/cic-research-vault/`, never in `C:/dev/cic-ingestion/`. Pipeline tools were confirmed to have zero references to `pdf/` paths, so this required no code changes — only the fixture files moved.

**Outstanding:** actual Google Drive sync requires the Drive desktop client (or rclone) pointed at `C:/dev/cic-research-vault/` — that's an OS-level install/config step outside tool-call scope, user needs to do it manually.
