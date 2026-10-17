{
  "id": "act-kbsync-ingestion-lock-sweeper-windows-guard",
  "action_id": "ACT-20261016-kbsync-ingestion-lock-sweeper-windows-guard",
  "source": "gemini-spark",
  "skill": "operational-ideas-harvest",
  "topic": "action-triage",
  "title": "Implement Automated Stale Ingestion Lock Sweeper and Windows Drive Guard in KB-Sync",
  "created": "2026-10-16T23:30:03Z",
  "folder_id": "1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g",
  "status": "drop",
  "priority": "HIGH",
  "target": "kb-sync",
  "target_notebook_name": "kb-sync",
  "category": "EVALUATE",
  "direction": "REFACTOR_OPTIMIZATION",
  "action_type": "antigravity_triage",
  "intent": "kbsync_ingestion_lock_sweeper_windows_guard",
  "timeline": "Sprint 35 (< 14 Days)",
  "owner": "Core Systems Lead",
  "verdict": "PENDING_TRIAGE",
  "summary": "Implement automated stale lock reaping for _cache/nlm_ingest.lock (>15m) and cross-platform Windows drive path normalization in KB-Sync to prevent pipeline hangs and test failures.",
  "context": {
    "body": "# [ACT-20261016-kbsync-ingestion-lock-sweeper-windows-guard] [EVALUATE] Implement Automated Stale Ingestion Lock Sweeper and Windows Drive Guard in KB-Sync\n\n## Context\nIn kb-sync commits today (8889694f: fix(notebooklm): support status 5 preparing, guard windows drive paths, and exclude backups and 86d4f702: test: repair verification coverage and ingestion lock cleanup (#41)), core transport repairs addressed two critical Windows execution anomalies:\n1. Windows drive paths (e.g. C:\\dev\\... with unescaped backslashes or UNC formats) occasionally failed regex normalization in bash verification test suites (#42).\n2. Aborted or timed-out Chrome/CDP sessions left orphaned lockfiles (_cache/nlm_ingest.lock), which caused subsequent scheduled pipeline runs to exit prematurely with \"ingestion in progress\" errors.\n\nWhile PR #41 and #42 repaired test coverage and manual lock cleanup, the production master pipeline reconciler lacks an automated, proactive stale lock sweeper. If a local worker process is killed abruptly by an OS restart or timeout, future scheduled sweeps remain locked until manual operator intervention.\n\n## Pre-Flight Verification\n* Confirmed via commit report 2026-10-16.md in folder 105ngq3rfUod1WUQvsmTUBJvkAIkDsWyr (commits 8889694f, 86d4f702, and d47add28).\n* Review of kb-sync/scripts/reconciler/ shows master sync scripts execute lock checks, but lack automated expiration thresholds.\n* Zero completion receipts in TRM-Research/mobile-outbox match automated stale lock reaping.\n\n## Payload\n### Directive & Objective\nImplement an automated stale lock sweeper and Windows drive path normalizer in kb-sync (scripts/reconciler/stale-lock-sweeper.mjs):\n1. Check lockfile mtime in _cache/nlm_ingest.lock; if older than 15 minutes and the PID recorded in the lockfile is inactive, automatically reap the lock and log an unquarantine event.\n2. Provide a universal cross-platform path normalizer utility (normalizeWindowsPath()) that standardizes Windows drive letters (C:/dev/...) and escapes backslashes before executing bash subshells.\n3. Wire this sweeper into the pre-flight routine of scripts/trm-ingest-drive.mjs.\n\n### Direction & Triage Rationale\n* Direction: REFACTOR_OPTIMIZATION. Directly prevents scheduled automation pipeline hangs and Windows path syntax test errors.\n* Triage Score: Impact 4/5 (eliminates pipeline stalls across all scheduled NLM sync runs on Windows), Effort 1/5 (simple mtime check + fs.unlinkSync and path regex replacement), Confidence 5/5 (addresses root causes confirmed in PR #41, #42, and #44). Composite ROI: 9.5/10.\n\n### Technical Scope & Architecture\n* scripts/reconciler/stale-lock-sweeper.mjs:\n```javascript\nconst LOCK_MAX_AGE_MS = 15 * 60 * 1000;\n\nfunction reapStaleLock(lockPath) {\n  if (!fs.existsSync(lockPath)) return;\n  const stats = fs.statSync(lockPath);\n  if (Date.now() - stats.mtimeMs > LOCK_MAX_AGE_MS) {\n    console.warn(`[WARN] Reaping orphaned lockfile: ${lockPath}`);\n    fs.unlinkSync(lockPath);\n  }\n}\n```\n* Windows Path Guard:\n  * Ensure all path arguments passed to spawnSync or bash.exe are normalized with forward slashes (path.resolve().replace(/\\\\/g, '/')).\n\n### Stack Alignment & Operational Integration\n1. kb-sync: Master repository sync and flattener daemon.\n2. trm: Consumes NLM runner output without lock collisions.\n\n### Deliverables & Acceptance Criteria\n* Implementation script stale-lock-sweeper.mjs.\n* Test suite verifying that an expired lockfile (>15m) is automatically unlinked and reported without throwing unhandled exceptions.\n\n## Next\nTriage into the active git backlog via node scripts/trm-ingest-drive.mjs in C:\\dev\\kb-sync.",
    "raw_input": "Implement Automated Stale Ingestion Lock Sweeper and Windows Drive Guard in KB-Sync",
    "provider": "deterministic_fallback"
  },
  "domain": "research",
  "execution_plan": [
    {
      "step": 1,
      "handler": "antigravity",
      "action": "create_issue_and_stage"
    }
  ],
  "issue_url": null,
  "archived_path": "G:\\My Drive\\TRM-Research\\04_archive\\mobile-inbox\\2026-10-16T233003Z__action__kb-sync__act-kbsync-ingestion-lock-sweeper-windows-guard.md"
}