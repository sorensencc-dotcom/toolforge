---
title: "Cluster sync failures came from a locked NotebookLM login profile, and the sync runs on its own gate, not the root one"
author: Chris
date: 2026-11-07
branch: fix/mcp-playwright-package
cost: { minutes: 29, tokens: 96176 }
id: l-e497ffdc
scope: repo
status: active
replaces: l-f9810f49
src: agent
---

## Decided
The 4 failing notebooks (master-kb, willow-run, ford-politics, daily) failed because the nlm login profile directory had lost the user's own access (ACL listed only CodexSandboxUsers read, SYSTEM, Administrators). Fix was takeown plus icacls grant on the profile directory, then nlm login again. After that master-kb synced cleanly (21 promoted, 23 purged, all ACTIVE, no status 3). Quarantines were cleared with clearQuarantine from the runner module.

In the code: the cluster sync is kb-sync/scripts/pipeline/cluster-sync-runner.mjs, which imports kb-sync/scripts/nlm-pack-replace-gate.mjs. That is a different file from scripts/nlm-pack-replace-gate.mjs at the repo root, which only the closed-loop research scripts use. Run: node scripts/pipeline/cluster-sync-runner.mjs --mode=research --notebook=<key> --skip-consolidate. Quarantine state lives in kb-sync/.nlm-quarantine.json.

## Tried and ruled out
Porting the root gate to the official Google notebook API: it was the wrong file for this sync, and the API cannot delete sources (HTTP 501), so purges still need nlm. Commit 5b35f6ee on feat/nlm-gate-official-api holds that port, unpushed. Delegating to codex exec: its Windows shell failed at startup with CryptUnprotectData, and its sandbox is the suspected cause of the ACL loss.

## Watch out
Do not run Codex's sandbox against the .notebooklm-mcp-cli directory; the lockout may recur. The runner exits 0 even when notebooks fail, so read the failed count.
