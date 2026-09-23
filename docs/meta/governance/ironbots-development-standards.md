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

### Pillar 6: Centralized Scoring & Zero Magic Constants
- **Config-Driven Weights**: Scoring penalties and health status thresholds must be declared in exported configuration blocks (e.g., `FLEET_SCORING_POLICY`) rather than inline magic numbers.
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

## 3. Standard Bot Implementation Blueprint

Every Ironbot consists of three components:

```
c:\dev\
├── scripts/
│   ├── <name>-bot.mjs                         # Bot execution engine
│   └── schedule-task-wrapper-<Name>.ps1       # Windows Task Scheduler wrapper
├── _status-feed/
│   └── <name>_report.json                     # Emitted telemetry feed
└── tests/
    └── ironbots.test.mjs                      # Paired regression test cases
```

### 3.1 Standard CLI Arguments Contract

All bot engines (`.mjs`) must support these standard CLI flags:

| Flag | Type | Description |
| :--- | :--- | :--- |
| `--dry-run` | Boolean | Runs full scan and computes metrics without mutating files or database state. |
| `--fix` | Boolean | Enables automatic remediation / auto-healing passes if supported by the bot. |
| `--verbose` | Boolean | Outputs detailed diagnostic logging to stdout. |
| `--limit=<n>` | Number | Caps batch processing size (e.g., maximum gaps or targets to triage per run). |

### 3.2 Standard Scheduled Task Wrapper Contract

All task wrappers (`.ps1`) must support the unified action dispatch interface:

```powershell
[CmdletBinding()]
param(
    [ValidateSet('Register', 'Unregister', 'Status', 'Test')]
    [string]$Action = 'Status',
    [switch]$Unattended,
    [switch]$Force
)
```

- **Folder Creation**: `Ensure-TaskFolder` must handle existing folders gracefully and log errors cleanly (never empty `catch {}` blocks).
- **Execution Limits**: Set task `ExecutionTimeLimit` to `PT1H` (1 hour) to prevent runaway hung processes.
- **Log Routing**: Standard out and standard error must be captured into dedicated files under `C:\dev\logs\<bot-name>.stdout.log` and `C:\dev\logs\<bot-name>.stderr.log`.

---

## 4. Operational Fleet Matrix

| ID | Name | Script | Schedule | Telemetry Output |
| :--- | :--- | :--- | :--- | :--- |
| `notebook-ingester` | NotebookLM & Knowledge Ingester | `scripts/notebook-ingester-bot.mjs` | Daily 02:00 AM | `_status-feed/notebook_ingester_report.json` |
| `kb-sentinel` | KB-Sentinel Drift & Autoheal | `scripts/kb-sentinel-bot.mjs` | Daily 03:00 AM | `_status-feed/kb_sentinel_report.json` |
| `trm-bot` | TRM Gap Triage & RFC Drafter | `scripts/trm-bot-runner.mjs` | Daily 04:00 AM | `_status-feed/trm_bot_report.json` |
| `watchlist-miner` | Watchlist & Competitor Drift Miner | `scripts/watchlist-miner-bot.mjs` | Daily 05:00 AM | `_status-feed/watchlist_miner_report.json` |
| `ci-watchdog` | CI-Watchdog Workflow Failure Triage | `scripts/ci-watchdog-bot.mjs` | Daily 06:00 AM | `_status-feed/ci_alerts.json` |
| `daemon-healer` | Daemon-Healer Port 8080 Supervisor | `scripts/daemon-healer-bot.mjs` | Every 15 Min | `_status-feed/daemon_health.json` |
| `ironbots-reporter` | Daily Fleet Activity Aggregator | `scripts/ironbots-daily-reporter.mjs` | Daily 06:30 AM | `_status-feed/ironbots_daily_report.json` |

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
