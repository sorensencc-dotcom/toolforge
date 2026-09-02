<!-- TOOLFORGE-WRITING-DISCIPLINE-START -->
## Technical Writing Heuristics & Style Discipline

All documentation, architecture specs, pull request descriptions, and agent outputs must strictly follow the deterministic writing heuristics defined in `skills/writing-heuristics/SKILL.md`:
1. **Ban conversational throat-clearing** (`Certainly!`, `Sure thing`, `In this section`).
2. **Eliminate filler adverbs & AI slop** (`essentially`, `basically`, `game-changing`, `delve`, `seamlessly`).
3. **Avoid first-person plural** (`we recommend`, `we will`, `let's`).
4. **Use direct imperative or second-person** (`you`), never third-person (`the developer should`).
5. **Enforce active voice** over passive constructions (`is handled by`).
6. **Ground assertions with metrics**; avoid ungrounded qualitative hype (`vastly superior`, `blazing fast`).
7. **State condition before action** ("To X, run Y").
8. **Enforce Sentence case in headings** (preserve acronyms and code spans).
9. **Use descriptive link anchor text**, never generic labels (`here`, `link`).
10. **Include serial Oxford commas** in lists.
11. **Use sequential numbering** for ordered steps.

Local exemptions must use audit-trail directives: `<!-- heuristics-disable <rule> author="..." reason="..." until="YYYY-MM-DD" -->`.
<!-- TOOLFORGE-WRITING-DISCIPLINE-END -->

# GitHub Copilot instructions












































<!-- github-copilot-toolbox:mcp-skills-awareness-begin -->

### MCP & Skills awareness (GitHub Copilot Toolbox)

_Last synced: 2026-08-19T00:40:25.191Z._

- **Full report:** `.github/copilot-toolbox-mcp-skills-awareness.md` in this workspace (auto-overwritten on each scan). Use it as ground truth for configured servers and skill folders.
- **MCP:** For **live tools**, use **Copilot Chat → Agent** and **trust/start** the right servers in the MCP UI.
- **When the user’s task matches a server** (e.g. “open this Confluence page” and a **Confluence** / **Atlassian** MCP is listed), **prefer that server id** and plan on Agent + MCP for actions—not only file search.
- **Skills:** Folders below contain `SKILL.md`; attach or cite paths in chat when relevant.

#### Workspace MCP

- `c:\dev\.vscode\mcp.json` _(workspace: dev)_ — _file missing_

_No active workspace servers in mcp.json._

#### User MCP

- `C:\Users\soren\AppData\Roaming\Code\User\mcp.json` — _servers defined_

| Server id | Kind | Detail |
|-----------|------|--------|
| microsoft/markitdown | stdio | uvx markitdown-mcp@0.0.1a4 |

#### Project skills

- **ci-triage** — `c:\dev\.claude\skills\ci-triage` — Use when a CI/GitHub-Actions failure is reported (by the user, an email summary, another tool, or a pasted "analysis") before proposing or applying any fix. Verifies the claim against real gh run logs, reproduces the roo

- **db-migrate** — `c:\dev\.claude\skills\db-migrate` — Generate, review, validate, and manage PostgreSQL migrations with confidence.

- **graft** — `c:\dev\.claude\skills\graft` — This repo is indexed by graft/. For ANY task here, whether

- **play-e2e** — `c:\dev\.claude\skills\play-e2e` — Run, debug, and manage Playwright snapshot tests in rewrite-docs.

- **sigil-consult** — `c:\dev\.claude\skills\sigil-consult` — Send the current context/question to a Sigil peer (Codex) for a second opinion, wait for the reply, and report back. Use when the user says "ask Codex", "get a second opinion", "check with Codex over Sigil", or /sigil-co

- **workflow-lint** — `c:\dev\.claude\skills\workflow-lint` — Scan GitHub Actions workflow YAML across one or all local repos for known deprecated-action versions, retired runner images, and PowerShell scripting footguns before they cause a live CI failure. Run before a release wav

#### User skills

- **accidental-data-loss-prevention** — `C:\Users\soren\.copilot\skills\accidental-data-loss-prevention` — |

- **alloydb-omni-access-control** — `C:\Users\soren\.copilot\skills\alloydb-omni-access-control` — Use these skills when you need to manage user roles, inspect permissions,

- **alloydb-omni-container** — `C:\Users\soren\.copilot\skills\alloydb-omni-container` — You're an expert in AlloyDB Omni running in a container. You can help

- **alloydb-omni-data** — `C:\Users\soren\.copilot\skills\alloydb-omni-data` — Use these skills when you need to explore the database structure, identify

- **alloydb-omni-health** — `C:\Users\soren\.copilot\skills\alloydb-omni-health` — Use these skills when you need to audit database health, identify storage

- **alloydb-omni-kubernetes** — `C:\Users\soren\.copilot\skills\alloydb-omni-kubernetes` — You're an expert in AlloyDB Omni Operator running in Kubernetes. You

- **alloydb-omni-monitor** — `C:\Users\soren\.copilot\skills\alloydb-omni-monitor` — Use these skills when you need to troubleshoot production issues by identifying

- **alloydb-omni-optimize** — `C:\Users\soren\.copilot\skills\alloydb-omni-optimize` — Use these skills when you need to fine-tune the database engine settings,

- **alloydb-omni-performance** — `C:\Users\soren\.copilot\skills\alloydb-omni-performance` — Use these skills when you need to analyze query performance, generate

- **alloydb-omni-replication** — `C:\Users\soren\.copilot\skills\alloydb-omni-replication` — Use these skills when you need to monitor the health of database replication,

- **alloydb-postgres-access-management** — `C:\Users\soren\.copilot\skills\alloydb-postgres-access-management` — Use these skills when you need to manage database users, inspect permissions

- **alloydb-postgres-admin** — `C:\Users\soren\.copilot\skills\alloydb-postgres-admin` — Use these skills when you need to provision new AlloyDB clusters and

- **alloydb-postgres-data** — `C:\Users\soren\.copilot\skills\alloydb-postgres-data` — Use these skills when you need to explore the database schema, identify

- **alloydb-postgres-health** — `C:\Users\soren\.copilot\skills\alloydb-postgres-health` — Use these skills when you need to optimize storage, identify index issues,

- **alloydb-postgres-monitor** — `C:\Users\soren\.copilot\skills\alloydb-postgres-monitor` — Use these skills when you need to troubleshoot slow performance, analyze

- **alloydb-postgres-optimize** — `C:\Users\soren\.copilot\skills\alloydb-postgres-optimize` — Use these skills when you need to discover and manage PostgreSQL extensions

- **alloydb-postgres-replication** — `C:\Users\soren\.copilot\skills\alloydb-postgres-replication` — Use these skills when you need to monitor replication health, manage

- **bigquery** — `C:\Users\soren\.copilot\skills\bigquery` — |

- **bigquery-data-transfer-service** — `C:\Users\soren\.copilot\skills\bigquery-data-transfer-service` — Discovers and inspects BigQuery Data Transfer Service (DTS) configurations.

- **building-data-apps** — `C:\Users\soren\.copilot\skills\building-data-apps` — |

- **cloud-sql-mysql-admin** — `C:\Users\soren\.copilot\skills\cloud-sql-mysql-admin` — Use these skills when you need to provision new Cloud SQL for MySQL instances,

- **cloud-sql-mysql-data** — `C:\Users\soren\.copilot\skills\cloud-sql-mysql-data` — Use these skills when you need to explore your database schema, execute

- **cloud-sql-mysql-lifecycle** — `C:\Users\soren\.copilot\skills\cloud-sql-mysql-lifecycle` — Use these skills when you need to manage the durability and safety of

- **cloud-sql-mysql-monitor** — `C:\Users\soren\.copilot\skills\cloud-sql-mysql-monitor` — Use these skills when you need to troubleshoot slow queries, analyze

- **cloud-sql-postgres-admin** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-admin` — Use these skills when you need to provision new Cloud SQL instances,

- **cloud-sql-postgres-data** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-data` — Use these skills when you need to explore the database structure, discover

- **cloud-sql-postgres-health** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-health` — Use these skills when you need to audit database health, identify storage

- **cloud-sql-postgres-lifecycle** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-lifecycle` — Use these skills when you need to manage the lifecycle of your instances,

- **cloud-sql-postgres-monitor** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-monitor` — Use these skills when you need to troubleshoot performance bottlenecks,

- **cloud-sql-postgres-replication** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-replication` — Use these skills when you need to monitor replication health, manage

- **cloud-sql-postgres-vectorassist** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-vectorassist` — Use these skills to set up and optimize production-ready vector workloads

- **cloud-sql-postgres-view-config** — `C:\Users\soren\.copilot\skills\cloud-sql-postgres-view-config` — Use these skills when you need to discover and manage PostgreSQL extensions

- **cloud-sql-sqlserver-admin** — `C:\Users\soren\.copilot\skills\cloud-sql-sqlserver-admin` — Use these skills when you need to provision new Cloud SQL for SQL Server

- **cloud-sql-sqlserver-data** — `C:\Users\soren\.copilot\skills\cloud-sql-sqlserver-data` — Use these skills when you need to explore the database schema, execute

- **cloud-sql-sqlserver-lifecycle** — `C:\Users\soren\.copilot\skills\cloud-sql-sqlserver-lifecycle` — Use these skills when you need to manage the lifecycle and durability

- **cloud-sql-sqlserver-monitor** — `C:\Users\soren\.copilot\skills\cloud-sql-sqlserver-monitor` — Use these skills when you need to troubleshoot slow queries and analyze

- **data-autocleaning** — `C:\Users\soren\.copilot\skills\data-autocleaning` — Automated data quality and transformation capabilities for Dataform/dbt/BigQuery

- **dataform-bigquery** — `C:\Users\soren\.copilot\skills\dataform-bigquery` — Expertise in generating clean, correct, and efficient Dataform pipeline

- **dbt-bigquery** — `C:\Users\soren\.copilot\skills\dbt-bigquery` — Expert guidance for creating, modifying, and optimizing dbt pipelines

- **discovering-gcp-data-assets** — `C:\Users\soren\.copilot\skills\discovering-gcp-data-assets` — |

- **federate-lakehouse-catalog** — `C:\Users\soren\.copilot\skills\federate-lakehouse-catalog` — Sets up Google Cloud Lakehouse federated catalogs to remote Iceberg

- **firestore-data** — `C:\Users\soren\.copilot\skills\firestore-data` — Handles NoSQL document operations and collection hierarchy exploration.

- **gcloud-auth-verification** — `C:\Users\soren\.copilot\skills\gcloud-auth-verification` — Guidelines for identifying and resolving missing Google Cloud authentication

- **gcp-composer-troubleshooting** — `C:\Users\soren\.copilot\skills\gcp-composer-troubleshooting` — Provides expert guidance for troubleshooting Cloud Composer (Apache

- **gcp-data-pipelines** — `C:\Users\soren\.copilot\skills\gcp-data-pipelines` — Primary entry point for building, managing, and orchestrating data pipelines

- **gcp-dataflow** — `C:\Users\soren\.copilot\skills\gcp-dataflow` — |

- **gcp-managed-airflow-migrations** — `C:\Users\soren\.copilot\skills\gcp-managed-airflow-migrations` — Provides guidance for migrating Apache Airflow DAGs in Managed Service

- **gcp-pipeline-orchestration** — `C:\Users\soren\.copilot\skills\gcp-pipeline-orchestration` — This skill helps the agent generate or update orchestration pipeline

- **gcp-pipeline-resource-provisioning** — `C:\Users\soren\.copilot\skills\gcp-pipeline-resource-provisioning` — |

- **gcp-spark** — `C:\Users\soren\.copilot\skills\gcp-spark` — |

- **gcs-security-assessment** — `C:\Users\soren\.copilot\skills\gcs-security-assessment` — Assesses security posture, evaluates risks, and checks SAIF compliance

- **managing-python-dependencies** — `C:\Users\soren\.copilot\skills\managing-python-dependencies` — |

- **ml-best-practices** — `C:\Users\soren\.copilot\skills\ml-best-practices` — |

- **notebook-guidance** — `C:\Users\soren\.copilot\skills\notebook-guidance` — |-

- **skill-repair** — `C:\Users\soren\.copilot\skills\skill-repair` — |

- **spanner-data** — `C:\Users\soren\.copilot\skills\spanner-data` — Use these skills when you need to explore the database structure, discover

- **autoplan** — `C:\Users\soren\.claude\skills\autoplan` — Auto-review pipeline — reads the full CEO, design, eng, and DX review skills from disk and runs them sequentially with auto-decisions using 6 decision principles. (gstack)

- **benchmark** — `C:\Users\soren\.claude\skills\benchmark` — Performance regression detection using the browse daemon. (gstack)

- **benchmark-models** — `C:\Users\soren\.claude\skills\benchmark-models` — Cross-model benchmark for gstack skills. (gstack)

- **browse** — `C:\Users\soren\.claude\skills\browse` — Fast headless browser for QA testing and site dogfooding. (gstack)

- **canary** — `C:\Users\soren\.claude\skills\canary` — Post-deploy canary monitoring. (gstack)

- **careful** — `C:\Users\soren\.claude\skills\careful` — Safety guardrails for destructive commands. (gstack)

- **codex** — `C:\Users\soren\.claude\skills\codex` — OpenAI Codex CLI wrapper — three modes. (gstack)

- **context-restore** — `C:\Users\soren\.claude\skills\context-restore` — Restore working context saved earlier by /context-save. (gstack)

- **context-save** — `C:\Users\soren\.claude\skills\context-save` — Save working context. (gstack)

- **cso** — `C:\Users\soren\.claude\skills\cso` — Chief Security Officer mode. (gstack)

- **design-consultation** — `C:\Users\soren\.claude\skills\design-consultation` — Design consultation: understands your product, researches the landscape, proposes a complete design system (aesthetic, typography, color, layout, spacing, motion), and generates font+color preview... (gstack)

- **design-html** — `C:\Users\soren\.claude\skills\design-html` — Design finalization: generates production-quality Pretext-native HTML/CSS. (gstack)

- **design-review** — `C:\Users\soren\.claude\skills\design-review` — Designer's eye QA: finds visual inconsistency, spacing issues, hierarchy problems, AI slop patterns, and slow interactions — then fixes them. (gstack)

- **design-shotgun** — `C:\Users\soren\.claude\skills\design-shotgun` — Design shotgun: generate multiple AI design variants, open a comparison board, collect structured feedback, and iterate. (gstack)

- **devex-review** — `C:\Users\soren\.claude\skills\devex-review` — Live developer experience audit. (gstack)

- **diagram** — `C:\Users\soren\.claude\skills\diagram` — Turn an English description (or mermaid source) into a diagram triplet: the source, an editable .excalidraw file you can open (gstack)

- **document-generate** — `C:\Users\soren\.claude\skills\document-generate` — Generate missing documentation from scratch for a feature, module, or entire project. (gstack)

- **document-release** — `C:\Users\soren\.claude\skills\document-release` — Post-ship documentation update. (gstack)

- **freeze** — `C:\Users\soren\.claude\skills\freeze` — Restrict file edits to a specific directory for the session. (gstack)

- **gstack** — `C:\Users\soren\.claude\skills\gstack` — Router for the gstack skill suite. (gstack)

- **gstack-upgrade** — `C:\Users\soren\.claude\skills\gstack-upgrade` — Upgrade gstack to the latest version.

- **guard** — `C:\Users\soren\.claude\skills\guard` — Full safety mode: destructive command warnings + directory-scoped edits. (gstack)

- **health** — `C:\Users\soren\.claude\skills\health` — Code quality dashboard. (gstack)

- **investigate** — `C:\Users\soren\.claude\skills\investigate` — Systematic debugging with root cause investigation. (gstack)

- **ios-clean** — `C:\Users\soren\.claude\skills\ios-clean` — Remove the DebugBridge SPM package and all #if DEBUG wiring from an iOS app. (gstack)

- **ios-design-review** — `C:\Users\soren\.claude\skills\ios-design-review` — Visual design audit for iOS apps on real hardware. (gstack)

- **ios-fix** — `C:\Users\soren\.claude\skills\ios-fix` — Autonomous iOS bug fixer. (gstack)

- **ios-qa** — `C:\Users\soren\.claude\skills\ios-qa` — Live-device iOS QA for SwiftUI apps. (gstack)

- **ios-sync** — `C:\Users\soren\.claude\skills\ios-sync` — Regenerate the iOS debug bridge against the latest upstream gstack templates. (gstack)

- **land-and-deploy** — `C:\Users\soren\.claude\skills\land-and-deploy` — Land and deploy workflow. (gstack)

- **landing-report** — `C:\Users\soren\.claude\skills\landing-report` — Read-only queue dashboard for workspace-aware ship. (gstack)

- **learn** — `C:\Users\soren\.claude\skills\learn` — Manage project learnings.

- **make-pdf** — `C:\Users\soren\.claude\skills\make-pdf` — Turn any markdown file into a publication-quality PDF. (gstack)

- **office-hours** — `C:\Users\soren\.claude\skills\office-hours` — YC Office Hours — two modes. (gstack)

- **open-gstack-browser** — `C:\Users\soren\.claude\skills\open-gstack-browser` — Launch GStack Browser — AI-controlled Chromium with the sidebar extension baked in.

- **pair-agent** — `C:\Users\soren\.claude\skills\pair-agent` — Pair a remote AI agent with your browser. (gstack)

- **plan-ceo-review** — `C:\Users\soren\.claude\skills\plan-ceo-review` — CEO/founder-mode plan review. (gstack)

- **plan-design-review** — `C:\Users\soren\.claude\skills\plan-design-review` — Designer's eye plan review — interactive, like CEO and Eng review. (gstack)

- **plan-devex-review** — `C:\Users\soren\.claude\skills\plan-devex-review` — Interactive developer experience plan review. (gstack)

- **plan-eng-review** — `C:\Users\soren\.claude\skills\plan-eng-review` — Eng manager-mode plan review. (gstack)

- **plan-tune** — `C:\Users\soren\.claude\skills\plan-tune` — Self-tuning question sensitivity + developer psychographic for gstack (v1: observational). (gstack)

- **qa** — `C:\Users\soren\.claude\skills\qa` — Systematically QA test a web application and fix bugs found. (gstack)

- **qa-only** — `C:\Users\soren\.claude\skills\qa-only` — Report-only QA testing. (gstack)

- **retro** — `C:\Users\soren\.claude\skills\retro` — Weekly engineering retrospective. (gstack)

- **review** — `C:\Users\soren\.claude\skills\review` — Pre-landing PR review. (gstack)

- **scrape** — `C:\Users\soren\.claude\skills\scrape` — Pull data from a web page. (gstack)

- **setup-browser-cookies** — `C:\Users\soren\.claude\skills\setup-browser-cookies` — Import cookies from your real Chromium browser into the headless browse session. (gstack)

- **setup-deploy** — `C:\Users\soren\.claude\skills\setup-deploy` — Configure deployment settings for /land-and-deploy.

- **setup-gbrain** — `C:\Users\soren\.claude\skills\setup-gbrain` — Set up gbrain for this coding agent: install the CLI, initialize a local PGLite or Supabase brain, register MCP, capture per-remote trust policy. (gstack)

- **ship** — `C:\Users\soren\.claude\skills\ship` — Ship workflow: detect + merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR. (gstack)

- **skillify** — `C:\Users\soren\.claude\skills\skillify` — Codify the most recent successful /scrape flow into a permanent browser-skill on disk. (gstack)

- **spec** — `C:\Users\soren\.claude\skills\spec` — Turn vague intent into a precise, executable spec in five phases. (gstack)

- **sync-gbrain** — `C:\Users\soren\.claude\skills\sync-gbrain` — Keep gbrain current with this repo's code and refresh agent search guidance in CLAUDE.md. Wraps the gstack-gbrain-sync orchestrator with state (gstack)

- **unfreeze** — `C:\Users\soren\.claude\skills\unfreeze` — Clear the freeze boundary set by /freeze, allowing edits to all directories again. (gstack)

- **_gstack-command** — `C:\Users\soren\.claude\skills\_gstack-command` — Router for the gstack skill suite. (gstack)

- **cavecrew** — `C:\Users\soren\.agents\skills\cavecrew` — >

- **caveman** — `C:\Users\soren\.agents\skills\caveman` — >

- **caveman-commit** — `C:\Users\soren\.agents\skills\caveman-commit` — >

- **caveman-compress** — `C:\Users\soren\.agents\skills\caveman-compress` — >

- **caveman-help** — `C:\Users\soren\.agents\skills\caveman-help` — >

- **caveman-review** — `C:\Users\soren\.agents\skills\caveman-review` — >

- **caveman-stats** — `C:\Users\soren\.agents\skills\caveman-stats` — >

- **find-skills** — `C:\Users\soren\.agents\skills\find-skills` — Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used w

- **gstack** — `C:\Users\soren\.agents\skills\gstack` — |

- **gstack-autoplan** — `C:\Users\soren\.agents\skills\gstack-autoplan` — |

- **gstack-benchmark** — `C:\Users\soren\.agents\skills\gstack-benchmark` — |

- **gstack-browse** — `C:\Users\soren\.agents\skills\gstack-browse` — |

- **gstack-canary** — `C:\Users\soren\.agents\skills\gstack-canary` — |

- **gstack-careful** — `C:\Users\soren\.agents\skills\gstack-careful` — |

- **gstack-cso** — `C:\Users\soren\.agents\skills\gstack-cso` — |

- **gstack-design-consultation** — `C:\Users\soren\.agents\skills\gstack-design-consultation` — |

- **gstack-design-review** — `C:\Users\soren\.agents\skills\gstack-design-review` — |

- **gstack-document-release** — `C:\Users\soren\.agents\skills\gstack-document-release` — |

- **gstack-freeze** — `C:\Users\soren\.agents\skills\gstack-freeze` — |

- **gstack-guard** — `C:\Users\soren\.agents\skills\gstack-guard` — |

- **gstack-investigate** — `C:\Users\soren\.agents\skills\gstack-investigate` — |

- **gstack-land-and-deploy** — `C:\Users\soren\.agents\skills\gstack-land-and-deploy` — |

- **gstack-office-hours** — `C:\Users\soren\.agents\skills\gstack-office-hours` — |

- **gstack-plan-ceo-review** — `C:\Users\soren\.agents\skills\gstack-plan-ceo-review` — |

- **gstack-plan-design-review** — `C:\Users\soren\.agents\skills\gstack-plan-design-review` — |

- **gstack-plan-eng-review** — `C:\Users\soren\.agents\skills\gstack-plan-eng-review` — |

- **gstack-qa** — `C:\Users\soren\.agents\skills\gstack-qa` — |

- **gstack-qa-only** — `C:\Users\soren\.agents\skills\gstack-qa-only` — |

- **gstack-retro** — `C:\Users\soren\.agents\skills\gstack-retro` — |

- **gstack-review** — `C:\Users\soren\.agents\skills\gstack-review` — |

- **gstack-setup-browser-cookies** — `C:\Users\soren\.agents\skills\gstack-setup-browser-cookies` — |

- **gstack-setup-deploy** — `C:\Users\soren\.agents\skills\gstack-setup-deploy` — |

- **gstack-ship** — `C:\Users\soren\.agents\skills\gstack-ship` — |

- **gstack-unfreeze** — `C:\Users\soren\.agents\skills\gstack-unfreeze` — |

- **gstack-upgrade** — `C:\Users\soren\.agents\skills\gstack-upgrade` — |

- **orca-cli** — `C:\Users\soren\.agents\skills\orca-cli` — >-

- **workspace-storage-cleaner** — `C:\Users\soren\.agents\skills\workspace-storage-cleaner` — Audits and purges stale artifacts, nested .git clones in brain session directories, oversized task logs, and temporary files across Antigravity Brain and development workspaces.

<!-- github-copilot-toolbox:mcp-skills-awareness-end -->




<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->