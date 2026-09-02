---
name: feedback_trm_vault_commit_per_run
description: "Commit trm-vault after every real ingest/dedup run, not batched at session end"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 20010702-fe7c-41dc-87b3-d5296da4fbb2
  modified: 2026-07-30T19:07:08.612Z
---

Commit `C:\Users\soren\trm-vault` right after every real ingest or dedup run — even a bare `chore(sync):` commit with no message detail closes the exposure window. Don't batch multiple runs into one end-of-session commit.

**Why:** 2026-07-30 found 227 uncommitted files in trm-vault with zero git safety net while dedup fix + full MFM ingest work were about to start. [[feedback_batch_pushes_per_session]] governs push cadence for toolforge-release-bot CI racing — that's about `push`, not `commit`, and does not apply here. trm-vault has no CI trigger to protect against, so committing after every run is pure upside.

**How to apply:** After any script/agent run that writes/deletes files under trm-vault (ingest, dedup, curator pass, sync-treatment, etc.), immediately `git add -A && git commit` there before moving to the next task. Use `chore(sync):` prefix per [[feedback_commit_chore_sync_tag]] unless the commit is itself the primary authored work.
