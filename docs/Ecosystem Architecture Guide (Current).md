# Ecosystem Architecture Guide (Current)

> **Document Status:** Authoritative Architectural Standard  
> **Last Synchronized:** 2026-09-13T21:30:00Z  
> **Target Alignment:** CIC Historical, Core Software Architecture, Personal OS & Organization Repositories

---

## 1. Core Repositories & Engine Status (Knowledge Plane Partitioning)

The knowledge plane is strictly partitioned into three independent domains to eliminate cross-domain concept pollution (e.g., preventing software architecture topics from spilling into historical research packs or daily buffer notebooks):

```
+-----------------------------------------------------------------------------------+
|                              PARTITIONED KNOWLEDGE PLANE                           |
+------------------------------------+----------------------------------------------+
| 1. Historical Workstreams (CIC)    | 2. Core Software Architecture & Dev          |
|    - Willow Run & Aviation         |    - IronLedger Architecture                 |
|    - Ford Executive Dynamics       |    - Sigil Protocol & Federation             |
|    - Post-War & Willys-Overland    |    - Agent Harness Registry                  |
|    - Cuban Seizures                |    - Rewrite Labs SSG Platform               |
|    - Miami Estate & Retirement     |    - Open Dev Triage Buffer                  |
|    - Rouge & Moving Assembly Line  +----------------------------------------------+
|    - CIC-KB (Master Historical)    | 3. Personal OS & Operations                  |
|    - Daily Research Buffer         |    - Household, Utilities, Florida Logistics |
+------------------------------------+----------------------------------------------+
```

### Knowledge Plane Target Directory

| Category Key | Target Notebook UUID / ID | Canonical Domain & Purpose |
|---|---|---|
| `willow-run` | `6fd7c40b-df90-444b-9c7a-a64682925856` | CIC — Willow Run B-24 production, aviation tooling, and plant logistics. |
| `ford-politics` | `0caf6707-f8f2-4d2a-acd2-020acead55ba` | CIC — Ford executive dynamics, Bennett Service Dept, and corporate politics. |
| `post-war` | `9c469910-a900-43a4-877c-a43c9f545b5f` | CIC — Post-War operations, Willys-Overland transition, and utility vehicles. |
| `cuba-claims` | `c8360946-dbee-4a2c-b622-7f89b05695b0` | CIC — Cuban asset seizures, FCSC claims, Moa Bay, and certified losses. |
| `miami-estate` | `64949154-5892-4fa4-9ad0-e48b2bf5cc6c` | CIC — Miami estate management, 4525 Adams Ave, and Florida retirement. |
| `assembly-line` | `70be0df3-c58a-4711-b4d3-1e4b8726faf7` | CIC — Rouge complex, Model T engineering, and moving assembly line origins. |
| `master-kb` | `679b8bab-2d87-42cb-a726-6dc54c83acc2` | CIC-KB — Master Historical Pack Only (contains verified documentary evidence). |
| `daily` | `1b4861a3-931f-4632-8fc1-343a8dd37df8` | CIC — Daily research mining buffer and raw intake triage. |
| `ironledger` | `76e1932c-054a-4520-9e83-5e882dffc938` | **IronLedger Architecture** — Double-entry engine, KMS envelope encryption, Prometheus metrics, and migrations 0012–0015 (repurposed from "Financial Statement and Docs"). |
| `sigil` | `26eacb85-2c97-443d-9d81-3bd99cc98412` | **Sigil Protocol** — FIX session layer, stream sequence persistence, key lifecycle, and federation directory specs. |
| `agent-harness` | `359b346c-6af7-4ba3-baef-b985c9e6e1af` | **Agent Harness Registry** — Graft context graph, SAM mesh topology, and Herdr terminal multiplexing. |
| `rewrite-labs` | `140119ae-3496-45c9-bf0c-71c955136afc` | **Rewrite Labs** — SSG / redesign platform and public documentation engine. |
| `dev-triage` | `cb0498ce-1ea5-4668-9f65-ac368753404e` | **Open Dev Issues** — CI/CD defect queue and operational telemetry buffer. |
| `personal-os` | `9724e682-c5ea-4693-8e21-caf8de68611e` | **Personal OS** — Household operations, utility accounts, and Florida logistics. |

---

## 2. Tool Routing Matrix

```
+-----------------------------------+-----------------------------------------+
| Research / Artifact Topic         | Target Domain & Ingestion Destination   |
+-----------------------------------+-----------------------------------------+
| Accounting, KMS DEKs, Migrations  | IronLedger Architecture (76e1932c...)   |
| FIX Sessions, WebSockets, Signatures | Sigil Protocol (<NEW_SIGIL...>)       |
| Graft AST, SAM Mesh, Herdr PTY    | Agent Harness Registry (<NEW_AGENT...>) |
| B-24 Liberator, Tooling, Turrets  | Willow Run (6fd7c40b...)                |
| FCSC Claims, Moa Bay Seizures     | Cuban Seizures (c8360946...)            |
| Utilities, Municipal, Auto Leases | Personal OS (9724e682...)               |
+-----------------------------------+-----------------------------------------+
```

### Routing Invariants & Pack Isolation

1. **Software vs. Historical Isolation**: Software knowledge packs (`pack_ironledger.txt`, `pack_sigil.txt`, `pack_agent_harness.txt`) must **never** be bundled into `pack_master_kb.txt` or `pack_willow_run.txt`.
2. **Frontmatter Domain Categories**: Mined files under `wiki/research/*.md` must declare explicit domain categories:
   ```yaml
   ---
   source_title: "IronLedger KMS Envelope Encryption & Migration 0012"
   category: "ironledger"
   topic: "ironledger-kms-encryption"
   status: "active"
   last_updated: "2026-09-13T20:00:00Z"
   ---
   ```
3. **Pre-Upload Deduplication Invariant**: Before uploading any newly generated `.nlm_pack/*.txt` file, TRM closed-loop orchestrator must execute `nlm source list "<targetNotebookId>" --json`, filter existing source titles matching the pack basename, and delete stale generation instances before pushing the new pack. This ensures strictly one active pack generation per notebook.

---

## 3. DAG Dependency Integration & Headroom Telemetry

- **DAG Dependency Graph**: Scans all partitioned domains (`wiki/research/`, `docs/`, `KB_SYNC_STATUS.md`) and resolves partition domain references (`domain:ironledger`, `domain:sigil`, `domain:willow-run`) as valid domain nodes without generating missing/dangling errors.
- **ICF Headroom Optimizer**: Continuously monitors context limits and token counts across all active partitions (IronLedger, Sigil, CIC - Miami, CIC - Rouge, Personal OS), flagging partitions approaching context thresholds before ingestion saturation occurs.

---

## 4. Repositories for sorensencc-dotcom Organization

A compiled directory of repositories under the [sorensencc-dotcom](https://github.com/sorensencc-dotcom/) organization, grounded in the workspace knowledge base.

| Repository Name | GitHub URL | Role & Primary Function |
|---|---|---|
| **TRM** | https://github.com/sorensencc-dotcom/TRM | Topic Research Mining & DevOps sync pipeline; closed-loop research ingestion. |
| **cic-os** | https://github.com/sorensencc-dotcom/cic-os | Agent mesh orchestration, governance pipeline, and execution platform. |
| **CIC-DAG** | https://github.com/sorensencc-dotcom/CIC-DAG | Directed Acyclic Graph execution engine and DAM automation infrastructure. |
| **charlie-deep-research** | https://github.com/sorensencc-dotcom/charlie-deep-research | Multi-agent deep research and archival inquiry automation. |
| **castironforge** | https://github.com/sorensencc-dotcom/castironforge | Archival document processing, OCR alignment, and research asset cataloging. |
| **cic-ingestion** | https://github.com/sorensencc-dotcom/cic-ingestion | Autonomy API server, memory/retention, and adapter framework. |
| **rewrite-mcp** | https://github.com/sorensencc-dotcom/rewrite-mcp | Unified build system, MCP servers, and multi-tenant architecture. |
| **rewrite-docs** | https://github.com/sorensencc-dotcom/rewrite-docs | Governance and integration platform documentation mega-vault. |
| **sigil** | https://github.com/sorensencc-dotcom/sigil | Federated addressing, identity management, and security protocol relay. |
| **toolforge** | https://github.com/sorensencc-dotcom/toolforge | Cast Iron Charlie & Labs toolbox, developer scripts, and CLI utilities. |
| **claude-skills** | https://github.com/sorensencc-dotcom/claude-skills | Claude skills repository, custom agent prompts, and workflows. |
| **.github** | https://github.com/sorensencc-dotcom/.github | Shared GitHub Actions and reusable CI/CD workflows for the organization. |
| **kb-sync** | https://github.com/sorensencc-dotcom/kb-sync | AST compaction flattener, knowledge base synchronization, and wiki engine. |
| **castironcharlie** | https://github.com/sorensencc-dotcom/castironcharlie | Private documentary website and password-gated research archive portal. |

### Detailed Repository Breakdown

#### Core Automation & Engine Tier
- **kb-sync** (https://github.com/sorensencc-dotcom/kb-sync): Handles AST-aware file flattening, multi-repo wiki synchronization, and knowledge pack compaction.
- **cic-ingestion** (https://github.com/sorensencc-dotcom/cic-ingestion): Houses the Autonomy API server, memory retention layer, and SPA hydration detection adapters.
- **rewrite-mcp** (https://github.com/sorensencc-dotcom/rewrite-mcp): Implements Model Context Protocol (MCP) servers and multi-tenant agent tooling.
- **toolforge** (https://github.com/sorensencc-dotcom/toolforge): Maintains shared PowerShell and Node.js CLI scripts, developer utilities, and workspace hooks.

#### Research & Orchestration Pipelines
- **TRM** (https://github.com/sorensencc-dotcom/TRM): Executes closed-loop Topic Research Mining and ingests CI failure traces into operational buffers.
- **cic-os** (https://github.com/sorensencc-dotcom/cic-os): Serves as the central monorepo for governance pipelines, execution orchestration, and agent API services.
- **CIC-DAG** (https://github.com/sorensencc-dotcom/CIC-DAG): Orchestrates DAG-based asset management and scheduled pipeline executions.
- **charlie-deep-research** (https://github.com/sorensencc-dotcom/charlie-deep-research): Automates multi-agent deep archival research and treatment generation.

#### Asset, Governance & Relay Infrastructure
- **castironforge** (https://github.com/sorensencc-dotcom/castironforge): Processes archival assets, OCR alignments, and dataset curations for research collections.
- **sigil** (https://github.com/sorensencc-dotcom/sigil): Provides cryptographic identity, federated addressing, and local loopback security relays.
- **rewrite-docs** (https://github.com/sorensencc-dotcom/rewrite-docs): Serves as the central documentation repository for ecosystem governance and integration specs.
- **claude-skills** (https://github.com/sorensencc-dotcom/claude-skills): Contains custom agent skill definitions and execution recipes.
- **.github** (https://github.com/sorensencc-dotcom/.github): Stores organization-wide reusable GitHub Actions workflows.
- **castironcharlie** (https://github.com/sorensencc-dotcom/castironcharlie): Maintains the main marketing site and password-gated research portal for documentary assets.

---

## 5. AI-Ideas Redundancy Audit & Operational Pruning Policy

The following tools and repositories have progressed from exploratory concepts into codified, production-grade components within the local workspace. In accordance with knowledge plane partitioning invariants, exploratory bookmarks and speculative media links must be pruned from the `AI-Ideas` notebook (`39a71593-eb5b-4605-a4a4-f212ae010da2`):

| Tool / Repository | Current Status in Architecture | Action in AI-Ideas (`39a71593...`) | Canonical Destination |
|---|---|---|---|
| **Herdr** (`ogulcancelik/herdr`) | Adopted as terminal multiplexer; integrated into Toolforge (`feat/toolforge-herdr-tr...`) and ICF matrix. | **Prune / Remove** speculative video & article links. | ICF / Toolforge production specs & `Agent Harness Registry` (`359b346c-6af7-4ba3-baef-b985c9e6e1af`). |
| **Graft** (`NanoNets/Graft`, `trailhq/Graft`) | Fully adopted into local developer harnesses; CPU usage optimization specs documented in CIC-KB. | **Prune / Remove** from AI-Ideas. | `Agent Harnesses & Local Execution` (`359b346c-6af7-4ba3-baef-b985c9e6e1af`) & `graft/`. |
| **SAM** (`google/sam`) | Adopted for Sovereign Agent Mesh comparisons; referenced in central architecture guide. | **Prune / Remove** general YouTube intros. | `Agent Harnesses & Local Execution` & `docs/contracts/`. |
| **Ecosystem Architecture Guide** | Uploaded as markdown file inside AI-Ideas (`sourceId: afcbc90b...`). | **Remove Source Immediately** (eliminates circular self-reference). | `docs/Ecosystem Architecture Guide (Current).md`. |
| **ECC** (`affaan-m/ECC`) & **Claude Code Hooks** | Codified in local `.claude/` hooks and Advanced Artifact Interfaces. | **Consolidate** into technical harness docs. | `Agent Harnesses & Local Execution` & `.claude/hooks`. |
| **Repomix** (`yamadashy/repomix`) | Integrated into kb-sync and daily packaging workflows. | **Prune / Remove** intake bookmarks. | `kb-sync/` ingestion pipeline & Toolforge utilities. |

### Operational Pruning Rule

```
                               OPERATIONAL PRUNING RULE
+-----------------------------------------------------------------------------------+
|  IF a tool or framework satisfies ANY of the following criteria:                   |
|    1. Has an active Git branch or directory under C:\dev                         |
|    2. Runs as an active service under helix/icf or local background daemons       |
|    3. Is codified in Section 1 of Ecosystem Architecture Guide (Current).md       |
|                                                                                   |
|  THEN:                                                                            |
|    - It is PERMANENTLY RETIRED and PRUNED from the AI-Ideas notebook.            |
|    - AI-Ideas is reserved STRICTLY for unvetted prototypes and conceptual intake. |
+-----------------------------------------------------------------------------------+
```
