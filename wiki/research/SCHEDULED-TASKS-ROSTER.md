---
title: "Windows Scheduled Tasks Master Roster"
category: "reporting"
status: "active"
generated_at: "2026-11-01T21:52:49.711Z"
tags:
  - scheduled-tasks
  - ironbots
  - automation
  - fleet-roster
---

# Windows Scheduled Tasks Master Roster

> **Last Updated**: `2026-11-01 21:52:49 UTC`  
> **Total Monitored Tasks**: **36**  
> **Canonical Source**: Live Windows Task Scheduler Registry (`\Ironbots\`, `\KB-SYNC\`, `\toolforge\`, `\CIC\`, `\TRM\`, `\Sigil\`, `\Helix\`, `\RewriteLabs\`)

This document is **automatically updated** by `scripts/generate-scheduled-tasks-roster.mjs`, which runs on every daily fleet reporting pass (`Ironbots-Reporter`, 06:30 AM ET) and master pipeline synchronization (`KB-Sync-Master`, 08:00 PM ET).

---

## 1. Executive Fleet Summary

| Category / Folder | Task Count | Primary Function | Primary Executor |
|---|---|---|---|
| [`\Ironbots\`](#1-ironbots-fleet) | **10** | Core autonomous bots (FTS5 indexing, autoheal, RFC triage, mobile transport, telemetry) | PowerShell 7 (`pwsh.exe`) + Node.js (S4U) |
| [`\KB-SYNC\`](#2-kb-sync-knowledge-plane) | **3** | Master pipeline synchronization, live telemetry server, TRM triage | PowerShell 7 (`pwsh.exe`) |
| [`\toolforge\`](#3-toolforge-core--governance) | **7** | Nightly CI test matrix, daily/weekly retrospective generation, drift detection | PowerShell 7 (`pwsh.exe`) + Node.js |
| [`\CIC\`](#4-cast-iron-charlie) | **6** | Historical research collection, Docker builds, WhichLLM benchmarks | PowerShell 7 (`pwsh.exe`) |
| [`\TRM\`](#5-topic-research-mining) | **5** | Closed-loop research mining, chat archiving, NotebookLM session heartbeat | PowerShell 7 (`pwsh.exe`) + Node.js |
| [`\Sigil\ / \Helix\ / \RewriteLabs\`](#6-standalone-services--daemons) | **4** | Federated mesh relay, desktop agent automation, backup daemons | PowerShell 7 (`pwsh.exe`) |

---

## 2. Complete Detailed Task Roster

### 1. Ironbots Fleet

| Task Name | Location | Responsible Agent / Bot | Script / Command | Schedule | State | Last Result |
|---|---|---|---|---|---|---|
| **Notebook-Ingester** | `\Ironbots\` | Bot 1: Notebook-Ingester | `scripts/notebook-ingester-bot.mjs` | `Daily at 02:00 AM` | `Ready` | `0x00000000` |
| **KB-Sentinel** | `\Ironbots\` | Bot 2: KB-Sentinel | `scripts/kb-sentinel-bot.mjs` | `Daily at 03:00 AM` | `Ready` | `0x00000000` |
| **TRM-Bot** | `\Ironbots\` | Bot 3: TRM-Bot | `scripts/trm-bot-runner.mjs` | `Daily at 04:00 AM` | `Ready` | `0x00000000` |
| **Watchlist-Miner** | `\Ironbots\` | Bot 4: Watchlist-Miner | `scripts/watchlist-miner-bot.mjs` | `Daily at 05:00 AM` | `Ready` | `0x00000000` |
| **Daemon-Healer** | `\Ironbots\` | Bot 5: Daemon-Healer | `scripts/daemon-healer-bot.mjs` | `Every 15 Minutes` | `Disabled` | `0x00000000` |
| **CI-Watchdog** | `\Ironbots\` | Bot 6: CI-Watchdog | `scripts/ci-watchdog-bot.mjs` | `Daily at 06:00 AM` | `Ready` | `0x00000000` |
| **Ironbots-Reporter** | `\Ironbots\` | Bot 7: Ironbots-Reporter | `scripts/ironbots-daily-reporter.mjs` | `Daily at 06:30 AM` | `Ready` | `0x00000000` |
| **Storage-Pruner** | `\Ironbots\` | Bot 8: Storage-Pruner | `scripts/storage-pruner.mjs` | `Weekly (Sun) at 03:30 AM` | `Ready` | `0x00000000` |
| **TRM-Drive-Sync** | `\Ironbots\` | Bot 9: TRM-Drive-Sync | `kb-sync/scripts/schedule-task-wrapper-TRM-Drive-Sync.ps1` | `Every 4 Hours` | `Ready` | `0x00000000` |
| **IronLedger-Sentinel** | `\Ironbots\` | Bot 10: IronLedger-Sentinel | `scripts/ironledger-sentinel-bot.mjs` | `Every 15 Minutes` | `Ready` | `0x00000000` |
| **Daily-Report-Reconciliation** | `\Ironbots\` | Daily Report Reconciliation Engine | `scripts/schedule-task-wrapper-Reconcile-Daily-Reports.ps1` | `Daily at 06:30, 11:15, 18:00 EST` | `Ready` | `0x00000000` |

#### Functional Descriptions

- **`Notebook-Ingester`** (`\Ironbots\`): Autonomous knowledge base indexer. Traverses markdown sources and notes, builds full-text search indexes in SQLite FTS5 for zero-token retrieval, and verifies source size ceilings.
- **`KB-Sentinel`** (`\Ironbots\`): Knowledge base health & drift sentinel. Audits links, validates frontmatter schemas against canonical whitelists, and applies deterministic self-healing fixes.
- **`TRM-Bot`** (`\Ironbots\`): Autonomous TRM gap triage engine. Reads actionable research gaps, executes local SQLite FTS5 context queries, and drafts structured RFC decision notes with evidence.
- **`Watchlist-Miner`** (`\Ironbots\`): Watchlist & competitor drift miner. Probes external web targets using SHA-256 and ETag diffing to detect structural landscape and technology changes.
- **`Daemon-Healer`** (`\Ironbots\`): High-availability daemon supervisor. Monitors ICF Dashboard (port 8080), Sigil Relay (8791), and Sigil Rooms (5173); terminates colliding or hanging processes and restarts services.
- **`CI-Watchdog`** (`\Ironbots\`): GitHub Actions failure triage bot. Inspects workflow run telemetry, filters out superseded failures on unmerged commits, and flags persistent CI defects.
- **`Ironbots-Reporter`** (`\Ironbots\`): Daily fleet telemetry aggregator. Consolidates health reports across all fleet bots, calculates host heartbeat and fleet health score (0-100), and emits wiki reports.
- **`Storage-Pruner`** (`\Ironbots\`): Database and telemetry storage pruner. Vacuums SQLite databases (.kb_cache, snapshots), gzip-compacts historical telemetry logs, and archives completed harness tasks.
- **`TRM-Drive-Sync`** (`\Ironbots\`): Two-way transport bridge between local Git repositories and Google Drive. Ingests mobile action cards and completed research, and emits Live Action Receipts.
- **`IronLedger-Sentinel`** (`\Ironbots\`): Financial engine supervisor. Audits Docker container health, API endpoints (/healthz, /readyz), balance sheet invariants, and transaction ingestion pipelines.
- **`Daily-Report-Reconciliation`** (`\Ironbots\`): Automated 3x daily differential report validator, zombie card cleanser, daemon heartbeat monitor, and gap reconciler.

---

### 2. KB-Sync Knowledge Plane

| Task Name | Location | Responsible Agent / Bot | Script / Command | Schedule | State | Last Result |
|---|---|---|---|---|---|---|
| **KB-Sync-Master-Pipeline** | `\KB-SYNC\` | KB-Sync Master Orchestrator | `kb-sync/scripts/schedule-task-wrapper-KB-Sync-Master.ps1` | `Daily at 20:00 (8:00 PM)` | `Ready` | `0x00000000` |
| **KB-Sync-Dashboard-Server** | `\KB-SYNC\` | KB-Sync Service Daemon | `scripts/ensure-dashboard-server.ps1` | `At Logon (Continuous)` | `Ready` | `0x00000000` |
| **KB-Sync-TRM-Triage** | `\KB-SYNC\` | TRM Knowledge Plane Triage | `kb-sync/scripts/schedule-task-wrapper-TRM-Triage.ps1` | `Daily at 20:30 (8:30 PM)` | `Ready` | `0x00000000` |

#### Functional Descriptions

- **`KB-Sync-Master-Pipeline`** (`\KB-SYNC\`): Master knowledge synchronization orchestrator. Executes staging, offline wiki synthesis, NotebookLM multipart pack cutovers with dedupe gates, drift checks, and gap triage.
- **`KB-Sync-Dashboard-Server`** (`\KB-SYNC\`): Ensures the canonical HTTP telemetry and documentation server is active on port 8080, serving the Warm Parchment / Dark Forge dual-theme dashboard.
- **`KB-Sync-TRM-Triage`** (`\KB-SYNC\`): Executes grounded TRM gap triage with cognitive query expansion directly within the kb-sync pipeline context.

---

### 3. Toolforge Core & Governance

| Task Name | Location | Responsible Agent / Bot | Script / Command | Schedule | State | Last Result |
|---|---|---|---|---|---|---|
| **Daily-Roadmap-Sync** | `\toolforge\` | Toolforge Governance Agent | `sync-tools/multiRepoRoadmapSync.cjs` | `Daily at 07:00 AM` | `Ready` | `0x00000000` |
| **Toolforge-CI-Nightly** | `\toolforge\` | Toolforge CI Engine | `ci-pipeline.ps1` | `Daily at 01:00 AM` | `Ready` | `0x00000000` |
| **toolforge-daily-report-agent** | `\toolforge\` | Toolforge Reporting Agent | `scripts/daily-report-agent.ps1` | `Daily at 06:00 AM` | `Ready` | `0x00000000` |
| **Toolforge-Drift-Detector** | `\toolforge\` | Toolforge Drift Monitor | `utilities/toolforgeDriftDetector.ps1` | `Daily at 02:30 AM` | `Ready` | `0x00000000` |
| **toolforge-retro-audit-agent** | `\toolforge\` | Toolforge Quality Sentinel | `scripts/retro-audit-agent.ps1` | `Daily at 04:00 AM` | `Ready` | `0x00000000` |
| **toolforge-weekly-report-agent** | `\toolforge\` | Toolforge Weekly Aggregator | `scripts/run-weekly-retro.ps1` | `Weekly (Sun) at 18:00 (6:00 PM)` | `Ready` | `0x00000000` |
| **toolforge-weekly-report-md-agent** | `\toolforge\` | Toolforge Documentation Agent | `scripts/weekly-report-agent.ps1` | `Weekly (Sun) at 18:30 (6:30 PM)` | `Ready` | `0x00000000` |

#### Functional Descriptions

- **`Daily-Roadmap-Sync`** (`\toolforge\`): Multi-repository roadmap synchronization. Enforces roadmap placement rules, audits cross-repo roadmaps, and catches governance drift.
- **`Toolforge-CI-Nightly`** (`\toolforge\`): Automated nightly continuous integration run. Executes test suites, validates skill manifests, and checks dependency graph invariants across all modules.
- **`toolforge-daily-report-agent`** (`\toolforge\`): Compiles the daily developer activity report from commit history, PR deliveries, and automated verification tests over the previous 24 hours.
- **`Toolforge-Drift-Detector`** (`\toolforge\`): Continuous skill and plugin drift detector. Validates installed skills against canonical manifest schemas and automatically repairs minor drift.
- **`toolforge-retro-audit-agent`** (`\toolforge\`): Verifies daily retrospectives, checks test-tag hygiene, audits commit conventions, and validates operational checklists.
- **`toolforge-weekly-report-agent`** (`\toolforge\`): Runs comprehensive weekly retrospective analysis, calculates token efficiencies, and evaluates milestone progress.
- **`toolforge-weekly-report-md-agent`** (`\toolforge\`): Compiles and formats weekly Markdown summary reports into docs/reports/weekly/ for persistent project history.

---

### 4. Cast Iron Charlie

| Task Name | Location | Responsible Agent / Bot | Script / Command | Schedule | State | Last Result |
|---|---|---|---|---|---|---|
| **CIC-Daily-Status** | `\CIC\` | Cast Iron Charlie Status Agent | `scripts/run-daily-status.ps1` | `Daily at 07:00 AM` | `Ready` | `0x00000000` |
| **CIC-ImageBuild-Daily** | `\CIC\` | Cast Iron Charlie Builder | `pwsh -Command docker build ...` | `Daily at 02:00 AM` | `Ready` | `0x00000040` |
| **CIC-Mirror-ClaudeMemory** | `\CIC\` | Claude Memory Mirror Agent | `scripts/mirror-claude-memory.ps1` | `Daily at 06:45 AM` | `Ready` | `0x00000000` |
| **CIC-Nightly-Notebook-Mining** | `\CIC\` | NotebookLM Mining Agent | `scripts/run-daily-notebook-mining.ps1` | `Daily at 01:30 AM` | `Ready` | `0x00000000` |
| **CIC-Vault-Sync-rl** | `\CIC\` | Vault Sync Agent | `powershell.exe ...` | `Daily at 10:00 AM` | `Ready` | `0xFFFD0000` |
| **CIC-WhichLLM-Weekly-Sweep** | `\CIC\` | WhichLLM Benchmark Agent | `CIC-GOVERNANCE/scripts/Run-WhichLLM-WeeklySweep.ps1` | `Weekly (Sun) at 09:00 AM` | `Ready` | `0x00000000` |

#### Functional Descriptions

- **`CIC-Daily-Status`** (`\CIC\`): Synthesizes daily status of the historical research pipeline, active research questions, and topic extraction status.
- **`CIC-ImageBuild-Daily`** (`\CIC\`): Daily container build for Cast Iron Charlie ingestion microservices and isolated research containers.
- **`CIC-Mirror-ClaudeMemory`** (`\CIC\`): Mirrors and backs up Claude Code project memory files and session context files into persistent git-tracked state.
- **`CIC-Nightly-Notebook-Mining`** (`\CIC\`): Automated nightly query injection and extraction against historical research notebooks (Willow Run, Ford Politics, Willys-Overland).
- **`CIC-Vault-Sync-rl`** (`\CIC\`): Synchronizes completed historical findings and entity notes into the canonical Obsidian vault.
- **`CIC-WhichLLM-Weekly-Sweep`** (`\CIC\`): Evaluates inference cost, token latency, and quality benchmarks across configured LLM endpoints to update WhichLLM routing profiles.

---

### 5. Topic Research Mining

| Task Name | Location | Responsible Agent / Bot | Script / Command | Schedule | State | Last Result |
|---|---|---|---|---|---|---|
| **CIC-TRM-ClosedLoop-Nightly-Miner** | `\TRM\` | TRM Closed-Loop Miner | `scripts/run-sibling-check-v2.mjs + scripts/consolidate-pack.mjs` | `Daily at 03:30 AM` | `Ready` | `0x00000000` |
| **toolforge-trm-sync-treatment** | `\TRM\` | TRM Treatment Sync | `scripts/trm-sync-treatment-agent.ps1` | `Daily at 06:30 AM` | `Ready` | `0x00000000` |
| **TRM-Notebooklm-Auth-Heartbeat** | `\TRM\` | NotebookLM Auth Daemon | `trm/schedule-task-wrapper-TRM-Notebooklm-Auth-Heartbeat.ps1` | `Every 2 Hours` | `Ready` | `0x00000000` |
| **TRM-Notebooklm-Chat-Archive** | `\TRM\` | NotebookLM Chat Archiver | `trm/schedule-task-wrapper-TRM-Notebooklm-Chat-Archive.ps1` | `Daily at 20:00 (8:00 PM)` | `Ready` | `0x00000000` |
| **TRM-Notebooklm-Mine** | `\TRM\` | TRM NotebookLM Miner | `trm/schedule-task-wrapper-TRM-Notebooklm-Mine.ps1` | `Daily at 06:00 AM` | `Ready` | `0x00000001` |

#### Functional Descriptions

- **`CIC-TRM-ClosedLoop-Nightly-Miner`** (`\TRM\`): Nightly closed-loop research mining. Runs sibling contradiction checks, queries expansion batteries, and consolidates thematic knowledge packs.
- **`toolforge-trm-sync-treatment`** (`\TRM\`): Synchronizes active research treatments, resolves claimed research tasks, and reconciles treatment logs.
- **`TRM-Notebooklm-Auth-Heartbeat`** (`\TRM\`): Periodic authentication keep-alive probe for Google NotebookLM. Prevents session timeout and preserves valid auth cookies.
- **`TRM-Notebooklm-Chat-Archive`** (`\TRM\`): Extracts, parses, and formats interactive NotebookLM chat conversations and grounding citations into permanent markdown archives.
- **`TRM-Notebooklm-Mine`** (`\TRM\`): Autonomous knowledge mining loop sweeping registered notebooks for emerging topic clusters and research insights.

---

### 6. Standalone Services & Daemons

| Task Name | Location | Responsible Agent / Bot | Script / Command | Schedule | State | Last Result |
|---|---|---|---|---|---|---|
| **IronBot-TaskMonitor** | `\IronBot\` | Task Monitor Daemon | `scripts/ironbot-task-monitor.ps1` | `Every 4 Hours` | `Ready` | `0x00000000` |
| **SigilMeshDaemon** | `\Sigil\` | Sigil Mesh Protocol Daemon | `scripts/run-sigil-daemon.ps1` | `At Logon (Continuous)` | `Unknown` | `N/A` |
| **HelixDaemon** | `\Helix\` | Helix Agent Daemon | `helix/run-daemon.ps1` | `At Logon (Continuous)` | `Ready` | `0x00041306` |
| **RewriteLabsDailyBackup** | `\RewriteLabs\` | RewriteLabs Backup Agent | `C:/Users/soren/rewritelabs.io/backup/backup.ps1` | `Daily at 00:00 (Midnight)` | `Ready` | `0xFFFD0000` |

#### Functional Descriptions

- **`IronBot-TaskMonitor`** (`\IronBot\`): Supervises running PowerShell and Node background tasks, terminates orphaned processes, and monitors fleet runtime health.
- **`SigilMeshDaemon`** (`\Sigil\`): Runs the local Sigil peer-to-peer mesh relay (port 8791) and streaming WebSocket gateway (port 8793) for federated multi-agent routing.
- **`HelixDaemon`** (`\Helix\`): Provides local agent execution harness and desktop window automation services for Helix applications.
- **`RewriteLabsDailyBackup`** (`\RewriteLabs\`): Automated backup of RewriteLabs workspaces, static site generator templates, and database state.

---

## 3. Automation & Maintenance Contracts

- **Zero-Drift Automation**: Every scheduled task in this roster has been validated to execute `C:\Program Files\PowerShell\7\pwsh.exe` (preventing `0x80070002` path errors).
- **Audit Verification**: This document can be regenerated on demand at any time by executing:
  ```bash
  node scripts/generate-scheduled-tasks-roster.mjs
  ```
- **Scheduled Auto-Refresh**:
  1. Triggered daily at **06:30 AM ET** by `\Ironbots\Ironbots-Reporter`.
  2. Triggered nightly at **08:00 PM ET** by `\KB-SYNC\KB-Sync-Master-Pipeline`.
