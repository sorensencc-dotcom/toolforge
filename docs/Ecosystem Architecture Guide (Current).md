# Ecosystem Architecture Guide (Current)

> **Document Status:** Authoritative Architectural Standard  
> **Last Synchronized:** 2026-10-19T14:32:26.324Z  
> **Drive Master:** [Ecosystem Architecture Guide (Current).md](https://docs.google.com/document/d/1zTiYlA6NIhJRDsr0_9s0I_oQKUnW6l8eJX6xqYGRM_M/edit?usp=drivesdk&ouid=108918430137219217175)  
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
|    - Post-War                      |    - Agent Harness Registry                  |
|    - Willys-Overland               |                                              |
|    - Cuban Seizures                |    - Rewrite Labs SSG Platform               |
|    - Miami Estate & Retirement     |    - Open Dev Triage Buffer                  |
|    - Rouge & Moving Assembly Line  +----------------------------------------------+
|    - CIC-KB (Master Historical)    | 3. Personal OS & Operations                  |
|    - Daily Research Buffer         |    - Household, Utilities, Florida Logistics |
+------------------------------------+----------------------------------------------+
```

---

## 2. Active Repository Commit Topology

| Repository | Branch | Latest Commit | Date |
|---|---|---|---|
| **dev** | `parkd821-20260908` | `1f1bdc85` docs(report): add daily report for 2026-10-19 | 2026-10-19 06:00:09 -0400 |
| **kb-sync** | `main` | `e1d1c6cd` fix(sync): designate master pack writer for harness | 2026-10-18 23:59:47 -0400 |
| **sigil-repo** | `main` | `b4e5812` Merge pull request #65 from sorensencc-dotcom/docs/correct-hybrid-migration-decision | 2026-10-17 10:21:43 -0400 |
| **rewrite-mcp** | `fix/mcp-server-package` | `472f501` [human] fix(mcp): stop idea-inbox and helm answering initialize | 2026-10-13 15:10:47 -0400 |
| **icf** | `fix/dashboard-docs-button-8001` | `5fbb18d` feat(dashboard): default trm backlog to open and add completed filter | 2026-10-17 16:07:22 -0400 |

---

## 3. Active MCP Tooling & Server Topology

| MCP Server | Tool Count | Key Tools |
|---|---|---|
| **browseros-neo** | 22 | act, await_human_help, diff, download, ... |
| **chrome-devtools-mcp** | 32 | click, close_page, drag, emulate, ... |
| **gemini-api_gemini-api-docs** | 2 | gemini_get_doc, gemini_search_docs |
| **github-mcp-server** | 47 | add_comment_to_pending_review, add_issue_comment, add_reply_to_pull_request_comment, assign_copilot_to_issue, ... |
| **gmp-code-assist** | 2 | retrieve-google-maps-platform-docs, retrieve-instructions |
| **google-cloud-logging** | 6 | get_bucket, get_view, list_buckets, list_log_entries, ... |
| **google-cloud-resource-manager** | 1 | search_projects |
| **google-developer-knowledge** | 3 | answer_query, get_documents, search_documents |
| **graft** | 6 | graft_check_freshness, graft_file_api, graft_find_all, graft_find_code, ... |
| **ijfw-memory** | 13 | ijfw_brain, ijfw_cross_audit_converge, ijfw_cross_project_search, ijfw_memory_facts, ... |
| **kb-context-cache** | 3 | fetch_topic_note, query_context_cache, vfs_upsert_document |
| **notion-mcp-server** | 24 | API-create-a-comment, API-create-a-data-source, API-delete-a-block, API-get-block-children, ... |

---

## 4. Local Service Ports & Active System Topology

| Service / Subsystem | Local Port(s) | Topology Role & Endpoint Details |
|---|---|---|
| **ICF (Iron Core Fabric)** | `3000` | Local dashboard, orchestrator, and telemetry frontend |
| **IronLedger Workbench** | `5000 / 5050` | Double-entry core accounting API and administration workbench |
| **Sigil Loopback Relay** | `8765` | Cryptographic identity relay and federated protocol broker |
| **Ollama Inference Engine** | `11434` | Local model inference provider and embeddings service |

---

## 5. Target Notebook Cluster Directory

| Category | Notebook ID | Title |
|---|---|---|
| Historical CIC | `679b8bab-2d87-42cb-a726-6dc54c83acc2` | CIC-KB |
| Historical CIC | `1b4861a3-931f-4632-8fc1-343a8dd37df8` | CIC - Daily Research |
| Historical CIC | `ef78168d-b7b9-4952-8e0f-fcb353a21181` | Willow Run Videos |
| Historical CIC | `b8bc161d-495f-42f9-a7d1-ed8692141f6b` | Cast Iron Charlie - Research Logs |
| Historical CIC | `fd0e0e4e-6890-4fb9-89bf-b9e568295e7a` | The Sorensen Photographic Archive: Industrial Giants at Willow Run |
| Historical CIC | `0c8dc979-319f-4e6d-8136-22275932c236` | CastIronCharlie-Facebook |
| Historical CIC | `039e2c13-75b3-4bf2-b58d-9bbce8f73a4d` | CIC-Reddit |
| Historical CIC | `c8360946-dbee-4a2c-b622-7f89b05695b0` | CIC - Cuban Seizures & Retired Assets |
| Historical CIC | `6fd7c40b-df90-444b-9c7a-a64682925856` | CIC - Willow Run & Aviation Engineering |
| Historical CIC | `9c469910-a900-43a4-877c-a43c9f545b5f` | CIC - Post-War |
| Historical CIC | `fd4ebe29-9440-4f4b-97cf-0184ffbe29a0` | CIC - Willys-Overland |
| Historical CIC | `0caf6707-f8f2-4d2a-acd2-020acead55ba` | CIC - Ford Executive Dynamics & Politics |
| Historical CIC | `48322e1d-d601-4f65-89e0-76282343680d` | CIC - Research Deltas & Living Matrix |
| Historical CIC | `64949154-5892-4fa4-9ad0-e48b2bf5cc6c` | CIC - Miami Estate & Florida Retirement |
| Historical CIC | `70be0df3-c58a-4711-b4d3-1e4b8726faf7` | CIC - Rouge, Model T & Moving Assembly Line |
| Core Software Architecture | `76e1932c-054a-4520-9e83-5e882dffc938` | IronLedger Architecture |
| Core Software Architecture | `26eacb85-2c97-443d-9d81-3bd99cc98412` | Sigil Protocol & Federation |
| Core Software Architecture | `359b346c-6af7-4ba3-baef-b985c9e6e1af` | Agent Harnesses & Local Execution (Graft, SAM, Herdr) |
| Core Software Architecture | `140119ae-3496-45c9-bf0c-71c955136afc` | Rewrite Labs SSG/Redesign Platform |
| Core Software Architecture | `cb0498ce-1ea5-4668-9f65-ac368753404e` | Open Dev Issues (CI/CD Triage Buffer) |
| Personal OS | `9724e682-c5ea-4693-8e21-caf8de68611e` | Personal OS (Household, Utilities, Florida Logistics) |
| Operational | `b42534be-a208-437e-828e-dad645631c66` | KB - Governance |
| Operational | `096b5b92-55d0-44b2-b074-3b3fef0a0d12` | KB - Modules |
| Operational | `3ac216cc-3379-4c9f-8393-ab28a248cecc` | KB - Skills |
| Operational | `1ab8f1a2-f066-4246-8489-75f223d5f9d2` | KB - Operations |
| Operational | `30f80cc0-80f7-421a-a79b-c510d98aaf94` | KB - Meta |
| Operational | `0cab9d12-0f0e-4cc0-9009-69ec809fce4a` | KB - Targets |
| Operational | `95867d03-1175-4516-9b38-d95592b1a321` | KB - Superpowers |
| Operational | `52332bef-552c-427a-afb5-8cc48e6f0079` | Grok Bot Automation |
| Operational | `bec5a197-8256-4eba-af78-c4881cc28fdd` | AI News and Tools |
| Operational | `39a71593-eb5b-4605-a4a4-f212ae010da2` | Toolforge Ecosystem |
