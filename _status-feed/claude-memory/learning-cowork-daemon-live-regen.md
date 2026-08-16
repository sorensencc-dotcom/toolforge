---
name: learning-cowork-daemon-live-regen
description: "A background daemon (cowork-auto-sync or similar) regenerates tracked report files live in c:\\dev, which can make git stash look broken when it isn't."
metadata: 
  node_type: memory
  type: project
  originSessionId: f331c20b-5904-416f-970d-20cf06301818
---

Files `audit/COWORK-AUTO-SYNC-REPORT.md`, `audit/COWORK-REGISTERED-SKILLS.md`, `dashboard.html`, `skills/SKILLPACK-*.{md,json}` get rewritten by a live background process during a session, independent of any git operation.

**Why:** Hit mid-rebase during [[session-wrap-2026-07-17-hook-scoping]] — `git stash push -u` succeeded, but the same tracked files showed as modified again seconds later. Looked like stash corruption or data loss.

**How to apply:** If a stash pop/push shows unexpected re-modified tracked files in this repo, don't assume corruption — diff the stash against the current working copy first (`git diff stash@{N} -- <file>`). If empty, the daemon already wrote equivalent content and the stash entry is redundant, safe to drop.
