# Ironbots Development Standards & Engineering Policy

**Document ID**: `GOV-IRONBOTS-STD-v1.0`  
**Status**: Canonical Standard  
**Category**: Autonomous Automation & Fleet Governance  
**Target Category**: `\Ironbots\` Task Scheduler & Toolforge Fleet  

---

## 1. Purpose & Scope

This specification defines the mandatory architectural invariants, authoring conventions, telemetry contracts, and governance gates for all autonomous background robots ("Ironbots") in the repository.

Any background daemon, scheduled worker, or autonomous maintenance script registered under Task Scheduler folder `\Ironbots\` or executed via `npm run bot:*` must conform to these standards without exception.

---

## 2. Core Invariants (The 7 Pillars)

### Pillar 1: Zero-Token Local Execution
- **Deterministic Compute**: High-throughput scans (filesystem traversals, AST parsing, regex validation, SQLite FTS5 querying, socket discovery, remote git ref polling) must execute entirely on local CPU cycles.
- **No Scheduled LLM Calls**: Background cron jobs must never invoke paid LLM completion endpoints. LLM calls are reserved exclusively for on-demand interactive agents.

### Pillar 2: Unattended S4U Execution
- **24/7 Background Availability**: All scheduled tasks must be configured with Service-for-User logon (`-LogonType S4U`) so they run continuously regardless of whether the operator is logged in.
- **Zero Cleartext Credentials**: No user passwords may be stored in Task Scheduler XML configurations.
- **Folder Placement**: All fleet tasks must register strictly under the canonical task folder `\Ironbots\`.

### Pillar 3: Dynamic Context & Portable Path Resolution
- **No Hardcoded Absolute Paths**: Scripts must never hardcode drive paths such as `'C:\dev'` or `'C:\Users\...'`.
- **PowerShell Root Resolution**: Derive repository root dynamically via:
  ```powershell
  $RepoRoot = Split-Path -Parent $PSScriptRoot
  ```
- **Node.js Root Resolution**: Derive repository root dynamically via:
  ```javascript
  import path from 'node:path';
  import { fileURLToPath } from 'node:url';
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(__dirname, '..');
  ```

### Pillar 4: Structured JSON Telemetry Contract
- **Standard Output Destination**: Every bot execution must write a validated JSON telemetry artifact to `_status-feed/<bot_name>_report.json`.
- **Mandatory Schema Fields**:
  ```json
  {
    "timestamp": "2026-09-22T03:00:00.000Z",
    "elapsedMs": 120,
    "status": "HEALTHY | PASS | DEGRADED | FAIL | DRIFT_DETECTED | FAILURES_DETECTED",
    "dryRun": false,
    "scanned": 413,
    "issues": []
  }
  ```
- **Idempotent Writes**: Telemetry writes must use atomic writes or directory pre-creation (`fs.mkdir(..., { recursive: true })`).

### Pillar 5: Dual-Contract Gateway & Process Supervision
- **Multi-Contract Probing**: Supervisors (such as `Daemon-Healer`) must concurrently validate:
  1. **UI Contract**: Asserts HTTP 200 and valid HTML markup (`<html` or `<!DOCTYPE`).
  2. **API Contract**: Asserts HTTP 200 and valid JSON payload (`{ status: "SUCCESS" }`).
- **Comprehensive Socket Sweeping**: Port checks must discover and clear competing socket holders across all interface bindings: IPv4 (`127.0.0.1`, `0.0.0.0`) and IPv6 (`::`, `::1`).
- **Thrash Guard & Cooldown Policy**: If port 8080 flaps $>3$ consecutive heal cycles, `Daemon-Healer` transitions to `ALERT_ONLY_COOLDOWN` (skipping destructive `taskkill` and process restart loops) until the endpoint stabilizes.

### Pillar 6: Centralized Scoring, Host Heartbeat & Zero Magic Constants
- **Config-Driven Weights**: Scoring penalties and health status thresholds must be declared in exported configuration blocks (e.g., `FLEET_SCORING_POLICY`) rather than inline magic numbers.
- **Host Heartbeat & Registry Validation**: Every daily aggregation run verifies host uptime and `\Ironbots\` Task Scheduler registry availability; host dropouts or missing task registrations trigger immediate `DEGRADED` scoring penalties.
- **Standard Thresholds**:
  - `HEALTHY` / `PASS`: Score $\ge 85$
  - `DEGRADED`: $60 \le \text{Score} < 85$
  - `ATTENTION_REQUIRED` / `FAIL`: $\text{Score} < 60$

### Pillar 7: Paired Regression Test Requirement (Gate 2)
- **CI Delivery Guard Compliance**: Every script in `scripts/*-bot.mjs` and wrapper in `scripts/schedule-task-wrapper-*.ps1` must have automated test assertions in `tests/ironbots.test.mjs`.
- **Required Test Scenarios**:
  1. Dry-run execution (`--dry-run`) producing valid telemetry JSON.
  2. Script exit code 0 on healthy runs.
  3. Scheduled task wrapper registration and status commands.

---

## 3. Standing Ownership Contract (Ironbots vs. GrokBots)

| Domain | Ironbot (Deterministic Local Layer) | GrokBot / Cloud Team (Reasoning & Policy) |
| :--- | :--- | :--- |
| **CI** | `CI-Watchdog` — Extracts failed workflow runs and error logs. | `Helix CI Triage` — Root-cause analysis and developer triage briefs. |
| **NLM / Ingestion** | `Notebook-Ingester` — Builds local SQLite FTS5 index only. | `Replace-Gate` & `Ingestion Guard` — Remote upload decisions; FLAG-only dupes. |
| **ICF :8080** | `Daemon-Healer` — Port clearing, socket recovery, and daemon restart. | `ICF Ops Sentinel` — Higher-level application health and SLA monitoring. |
| **Competitor Drift** | `Watchlist-Miner` — Deterministic hash/ETag difference detection. | `Competitor Command Center` — Strategic landscape synthesis and roadmap guidance. |
| **TRM Gaps** | `TRM-Bot` — Drafts structured RFC notes and staging markers (`status: draft`). | `Research Desk / First Mate` — Review, proof grounding, and final wiki promotion. |
| **TRM Ingress** | `TRM-Drive-Sync` — Ingests cards, stages to `.harness/`, creates tracking issues. | `Antigravity Harness / Human Operator` — Claiming, resolving, and closing tickets. |

### 3.1 Standard CLI & Wrapper Parameter Contracts

All Ironbot JavaScript engines (`scripts/*-bot.mjs`, `scripts/trm-ingress-watcher.mjs`) and PowerShell scheduled task wrappers (`scripts/schedule-task-wrapper-*.ps1`) must adhere to standard CLI interfaces:

1. **JavaScript Engine CLI Flags**:
   - `--dry-run`: Runs inspection and schema validation without destructive process termination, deletion, or external mutation; outputs valid telemetry JSON.
   - `--check-only`: (Daemon-Healer only) Evaluates endpoint health and emits telemetry without process restarting or resetting live production cooldown counters.
   - `--once`: (TRM-Ingress only) Performs a single synchronous sweep of active inboxes and terminates, required for sequential execution in `npm run bot:all`.
   - `--status`: Emits formatted CLI health tables to `stdout` and exits cleanly with code 0.

2. **PowerShell Wrapper (`schedule-task-wrapper-*.ps1`) Contracts**:
   - `-Action <Register|Unregister|Status|Test>`: Action verb defaulting to `Status`. `Register` creates or updates the task under `\Ironbots\` with `-LogonType S4U`; `Test` executes a direct test invocation.
   - `-Unattended`: Enforces headless S4U execution (`Run whether user is logged on or not`).
   - `-Continuous`: (TRM-Drive-Sync only) Explicitly launches or registers in persistent `fs.watch` event-listener mode.
   - `-Once`: (TRM-Drive-Sync only) Overrides background registration to single-sweep execution.
   - `-DryRun`: Forwards `--dry-run` flag to underlying Node.js script.

---

## 4. Operational Fleet Matrix

The autonomous fleet comprises **7 autonomous workers + 1 daily aggregator/reporter** (total 8 scheduled tasks registered under `\Ironbots\`):

| Task Name | ID | Script | Schedule | Telemetry Output |
| :--- | :--- | :--- | :--- | :--- |
| `Notebook-Ingester` | `notebook-ingester` | `scripts/notebook-ingester-bot.mjs` | Daily 02:00 AM | `_status-feed/notebook_ingester_report.json` |
| `KB-Sentinel` | `kb-sentinel` | `scripts/kb-sentinel-bot.mjs` | Daily 03:00 AM | `_status-feed/kb_sentinel_report.json` |
| `TRM-Bot` | `trm-bot` | `scripts/trm-bot-runner.mjs` | Daily 04:00 AM | `_status-feed/trm_bot_report.json` |
| `Watchlist-Miner` | `watchlist-miner` | `scripts/watchlist-miner-bot.mjs` | Daily 05:00 AM | `_status-feed/watchlist_miner_report.json` |
| `CI-Watchdog` | `ci-watchdog` | `scripts/ci-watchdog-bot.mjs` | Daily 06:00 AM | `_status-feed/ci_alerts.json` |
| `Daemon-Healer` | `daemon-healer` | `scripts/daemon-healer-bot.mjs` | Every 15 Min | `_status-feed/daemon_health.json` |
| `TRM-Drive-Sync` | `trm-drive-sync` | `scripts/trm-ingress-watcher.mjs` | Continuous / On-Demand | `_status-feed/trm_ingress_status.json` |
| `Ironbots-Reporter` | `ironbots-reporter` | `scripts/ironbots-daily-reporter.mjs` | Daily 06:30 AM | `_status-feed/ironbots_daily_report.json` |

---

## 5. Pre-Merge Quality Checklist for New Ironbots

Before adding or updating an Ironbot, developers and agents must verify:

- [ ] **Zero-Token Check**: No external API keys or LLM calls imported or executed.
- [ ] **Path Independence**: Zero instances of hardcoded `'C:\dev'` or absolute paths.
- [ ] **Wrapper Alignment**: `scripts/schedule-task-wrapper-<Name>.ps1` registers under `\Ironbots\` with `-LogonType S4U`.
- [ ] **Telemetry Conformance**: Valid JSON emitted to `_status-feed/<bot_name>_report.json`.
- [ ] **Reporter Integration**: Added to `BOT_ARTIFACTS` and `activeBots` roster in `scripts/ironbots-daily-reporter.mjs`.
- [ ] **Regression Coverage**: `tests/ironbots.test.mjs` contains passing tests for `--dry-run` and wrapper verification.
- [ ] **Architecture Sync**: Updated `wiki/ironbots-autonomous-architecture.html` and re-rendered `.png`.
