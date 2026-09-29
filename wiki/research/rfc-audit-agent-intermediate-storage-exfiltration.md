---
title: "RFC: Audit Agent Intermediate Storage & Exfiltration Prevention"
category: "research"
topic: "rfc-audit-agent-intermediate-storage-exfiltration"
gap_id: "act-01-audit-agent-intermediate-storage-exfiltration"
status: "draft"
created_at: "2026-09-28T14:25:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "claude-3-5-sonnet-20241022"
router_confidence: 0.50
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: "https://github.com/sorensencc-dotcom/toolforge/issues/60"
citations:
  - "wiki/research/trm-drive-transport-adapter-spec.md"
  - "scripts/storage-pruner.mjs"
  - "scripts/secret-scan.mjs"
---

# RFC: Audit Agent Intermediate Storage & Exfiltration Prevention

## 1. Problem statement & threat model
Autonomous AI coding agents generate extensive intermediate artifacts across their lifecycle:
1. **Transient scratchpads & conversation logs**: Logs stored in `.gemini/brain/*/logs/`, `.claude/worktrees/*/logs/`, and `.system_generated/logs/transcript.jsonl`.
2. **Intermediate file spills & tool dumps**: Large tool outputs dumped into `.kb_cache/spills/` or local `scratch/` directories.
3. **Sensitive credential exposure**: API tokens, private keys, authorization cookies, and customer data present in environment variables or output buffers.

Without deterministic scanning and enforcement, these intermediate files risk accidental commit to Git repositories, sync to cloud backup shares, or exfiltration through uncontrolled egress channels.

---

## 2. Technical architecture & audit pipeline

### 2.1 Deterministic secret & entropy scanner
All session teardown, worktree completion, and pre-push hooks must execute a fail-closed scan across intermediate directories:
- **Regex token patterns**: High-entropy API keys (`ghp_*`, `sk-ant-*`, `sk-*`, `AIza*`).
- **Shannon entropy detection**: Flag string sequences exceeding threshold entropy ($H \ge 4.5$) in non-binary scratchpad files.
- **Path boundaries**: Strict inclusion of `.kb_cache/spills/`, `trm-drive/inbox/`, `.harness/tasks/`, and `_status-feed/`.

### 2.2 Tombstone stubbing & sanitization
When large tool outputs or sensitive payloads are evicted by the compactor:
1. Replace in-memory transcript references with sanitized tombstones: `[output omitted (N chars); spilled to disk]`.
2. Encrypt disk spills with local hardware-backed keys or isolate them within ephemeral ramdisks.
3. Enforce a 72-hour TTL with automated deletion via `scripts/storage-pruner.mjs`.

---

## 3. Protocol decisions & verification gates

1. **Pre-commit storage verification**:
   - `scripts/secret-scan.mjs` runs on every staged commit.
   - Any uncommitted intermediate file under `scratch/` or `.kb_cache/` matching exfiltration heuristics triggers an immediate exit 1.
2. **Quarantine protocol**:
   - Non-conforming or unparseable ingress files are moved directly to `trm-drive/inbox/quarantine/` without executing downstream parsers.
3. **Air-gapped telemetry**:
   - Status telemetry in `_status-feed/daily_status.json` must scrub all path strings to relative repo basenames before aggregation.

---

## 4. References & linked topics
- [[Index]]
- [[trm-research-gaps]]
- [[Log]]
