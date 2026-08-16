---
name: phase-29-31-abb
description: "Knowledge Graph (29) → Causal Reasoning (30) → Orchestration (31); file layout, checklists, migration, API spec, flows"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9bb1990c-6782-4cf5-9cba-f739dd4b8021
---

# Phase 29–31: Knowledge Graph ABB (Architecture & Build Blueprint)

## Overview

Three-phase system stacking upward:
- **Phase 29:** Knowledge Graph — unified queryable store for CIC state (agents, repos, governance, events)
- **Phase 30:** Causal Reasoning Engine — explain why, impact, counterfactuals, drift patterns
- **Phase 31:** Autonomous Orchestration Engine — plan & execute complex tasks using reasoning + governance

Inputs: TorqueQuery (memory), Vault (governance), Repomix/MemoryStore (repos), Evolution Loop (amendments/policies).

---

## Phase 29 Objectives

**Primary:** Turn TorqueQuery + Vault + MemoryStore into unified, queryable knowledge graph.
**Secondary:** Multi-hop reasoning; causal & temporal views; stable API for agents & governance.

**Scope:**
- Entities: agents, repos, files, commits, runs, policies, constraints, amendments, signals, events
- Relations: produced, affected, governed_by, violated, amended_by, derived_from, depends_on, observed_drift

---

## Core Design

### Graph Storage Layer

Engine: **SQLite-backed property graph** (adjacency tables).

Schema:
- **Nodes:** `id (UUID)`, `type`, `created_at`, `updated_at`, `labels (JSON)`, `properties (JSON)`
- **Edges:** `id (UUID)`, `src_id`, `dst_id`, `type`, `created_at`, `properties (JSON)`
- **Indexes:** by `type`, `labels`, `created_at`, `src_id`, `dst_id` + optional FTS on properties

### Ingestion & Mapping

- **TorqueQuery → Graph:**
  - Events → `RunEvent` nodes; edges: `AGENT_EXECUTED_EVENT`, `EVENT_TOUCHES_REPO`, `EVENT_EMITS_SIGNAL`
  - Signals → `Signal` nodes
  - Correlations → `CorrelationCluster` nodes; edges: `CORRELATED_WITH`, `PART_OF_CLUSTER`

- **Vault → Graph:**
  - Records → `GovernanceRecord` nodes
  - Secrets (metadata only) → `SecretDescriptor` nodes
  - Audit events → `AuditEvent` nodes
  - Edges: `RECORD_AMENDS_POLICY`, `RECORD_CREATES_CONSTRAINT`, `EVENT_TOUCHES_SECRET`, `EVENT_AUTHORED_BY_AGENT`

- **Repomix/MemoryStore → Graph:**
  - Repos → `Repo` nodes; Files → `File` nodes; Commits → `Commit` nodes
  - Edges: `REPO_CONTAINS_FILE`, `COMMIT_TOUCHES_FILE`, `AGENT_MODIFIED_REPO`

- **Evolution Loop → Graph:**
  - Amendments/Policies/Constraints → dedicated node types
  - Edges: `AMENDMENT_DERIVED_FROM_DRIFT_SIGNAL`, `POLICY_GOVERNING_AGENT`, `CONSTRAINT_APPLIES_TO_SERVICE`

---

## Services & APIs

### Knowledge Graph Service

Port: `:3100` via unified-api gateway.

Modules:
- **GraphStore:** CRUD + query abstraction
- **Mapper:** domain → graph objects
- **QueryEngine:** paths, neighborhoods, patterns, causality
- **Reasoner (29.2+):** multi-hop, ranking, explanations

API surface (`/api/knowledge-graph/*`):
- **Ingestion:** `POST /ingest/torque`, `/ingest/vault`, `/ingest/repos`, `/ingest/evolution`
- **Query:** `POST /query/paths`, `/query/neighborhood`, `/query/patterns`, `/query/causality`
- **Introspection:** `GET /schema`, `/stats`

---

## Build Plan & Milestones

### 29.0 — Graph Skeleton
- SQLite schema (nodes/edges)
- GraphStore CRUD
- `/schema` + `/stats` endpoints
- Goal: stable storage + introspection

### 29.1 — Ingestion Bridges
- Mappers for TorqueQuery, Vault, Repomix, Evolution Loop
- `/ingest/*` endpoints with batch support
- Goal: CIC state fully in graph

### 29.2 — Query Engine
- Path, neighborhood, pattern, basic causality queries
- Integration tests across chains
- Goal: usable graph for agents & governance

### 29.3 — Governance Integration
- Vault-backed access control
- Digest chain for ingestion batches
- Policy-aware query enforcement
- Goal: production-safe knowledge graph

---

## File Layout

```
services/
  knowledge-graph/
    src/
      api/
        routes/
          ingest/       [torque, vault, repos, evolution].ts
          query/        [paths, neighborhood, patterns, causality].ts
          introspection/[schema, stats].ts
        server.ts
      core/
        graph_store/
          GraphStore.ts
          migrations/   [001_init_nodes_edges.sql, 002_indexes.sql]
        mappers/
          [TorqueMapper, VaultMapper, RepoMapper, EvolutionMapper].ts
        query_engine/
          [PathQuery, NeighborhoodQuery, PatternQuery, CausalityQuery].ts
        models/
          [Node, Edge, Types].ts
      infra/
        [config, logging, errors, health].ts
    tests/
      unit/
        graph_store.test.ts
        mappers/      [torque, vault, repo, evolution]_mapper.test.ts
        query_engine/ [paths, neighborhood, patterns, causality].test.ts
      integration/
        ingest_[torque, vault, repo, evolution]_to_graph.test.ts
        api_query_[paths, causality].test.ts

  reasoning-engine/
    src/
      api/
        routes/       [why, impact, counterfactual, drift_patterns].ts
      core/
        causal_model/ [CausalGraphView, TemporalIndex].ts
        operators/    [WhyOperator, ImpactOperator, CounterfactualOperator, DriftPatternsOperator].ts
        models/       [ReasoningRequest, ReasoningResponse].ts
      infra/        [config, logging, errors, health].ts
    tests/
      unit/
        operators/    [why, impact, counterfactual, drift_patterns]_operator.test.ts
        causal_model/ [causal_graph_view, temporal_index].test.ts
      integration/
        api_[why, impact, counterfactual, drift_patterns].test.ts

  orchestration-engine/
    src/
      api/
        routes/       [plan, execute, status, graph].ts
      core/
        planner/      [GoalParser, TaskGraphBuilder, CapabilityResolver].ts
        executor/     [WorkflowRunner, RetryPolicy, DriftAwareExecutor].ts
        integration/  [GovernanceGuard, SelfHealingAdapter, KnowledgeGraphClient, ReasoningEngineClient].ts
        models/       [PlanRequest, PlanResponse, ExecutionStatus].ts
      infra/        [config, logging, errors, health].ts
    tests/
      unit/
        planner/      [task_graph_builder, capability_resolver].test.ts
        executor/     [workflow_runner, retry_policy, drift_aware_executor].test.ts
        integration/  [governance_guard, self_healing_adapter].test.ts
      integration/
        api_[plan, execute, status, graph].test.ts

libs/
  torquequery-client/      TorqueQueryClient.ts
  vault-client/            VaultClient.ts
  repomix-client/          RepomixClient.ts
  evolution-client/        EvolutionClient.ts
  unified-api/
    router.ts
    middleware/            [errors, timeouts, logging, auth].ts
```

---

## Phase 29.0 Checklist (GraphStore & Schema)

**Define Models**
- [ ] Node model (id, type, created_at, updated_at, labels, properties)
- [ ] Edge model (id, src_id, dst_id, type, created_at, properties)

**Migrations**
- [ ] `001_init_nodes_edges.sql`: nodes + edges tables
- [ ] `002_indexes.sql`: indexes on type, created_at, src_id, dst_id, FTS

**GraphStore Implementation**
- [ ] `createNode`, `updateNode`, `getNode`, `findNodes`
- [ ] `createEdge`, `updateEdge`, `getEdge`, `findEdges`
- [ ] Transactional batch ingestion

**Routes**
- [ ] `GET /api/knowledge-graph/schema` (returns node/edge types + properties)
- [ ] `GET /api/knowledge-graph/stats` (counts, density, timestamps)

**Tests**
- [ ] GraphStore CRUD operations
- [ ] Index correctness
- [ ] Batch transactional semantics

---

## Phase 29.1 Checklist (Ingestion Bridges)

**Mappers**
- [ ] TorqueMapper (RunEvent, Signal, CorrelationCluster)
- [ ] VaultMapper (GovernanceRecord, AuditEvent, SecretDescriptor)
- [ ] RepoMapper (Repo, File, Commit)
- [ ] EvolutionMapper (Amendment, Policy, Constraint)

**Routes**
- [ ] `POST /api/knowledge-graph/ingest/torque` (batch)
- [ ] `POST /api/knowledge-graph/ingest/vault` (batch)
- [ ] `POST /api/knowledge-graph/ingest/repos` (batch)
- [ ] `POST /api/knowledge-graph/ingest/evolution` (batch)

**Integration**
- [ ] Ingest TorqueQuery export → verify graph
- [ ] Ingest Vault export → verify graph
- [ ] Ingest Repomix export → verify graph
- [ ] Ingest Evolution export → verify graph
- [ ] Idempotent semantics (same batch twice = once)

---

## Phase 29.2 Checklist (Query Engine)

**Operators**
- [ ] PathQuery (BFS/DFS with type filters, max depth, cycle protection)
- [ ] NeighborhoodQuery (k-hop expansion, edge/node filters)
- [ ] PatternQuery ({start_type, edge_type, end_type} matching)
- [ ] CausalityQuery (event → upstream governance chain)

**Routes**
- [ ] `POST /api/knowledge-graph/query/paths`
- [ ] `POST /api/knowledge-graph/query/neighborhood`
- [ ] `POST /api/knowledge-graph/query/patterns`
- [ ] `POST /api/knowledge-graph/query/causality`

**Tests**
- [ ] Each operator with synthetic graphs
- [ ] API contracts over composed graphs
- [ ] Performance (reasonable latency for 10K node graphs)

---

## Phase 29.3 Checklist (Governance Integration)

**Access Control**
- [ ] VaultClient integration
- [ ] Query filtering by agent identity + policy
- [ ] Constraint enforcement from Evolution Loop

**Integrity**
- [ ] Digest chain: per batch → batch_id + sha256(delta) in Vault
- [ ] Tamper-evidence logs

**Tests**
- [ ] Policy-filtered queries (same query, different agent → different results)
- [ ] Constraint violation detection

---

## TorqueQuery → Knowledge Graph Migration

### Preparation
- [ ] Inventory TorqueQuery outputs (byType, byAgent, byCorrelation, bySignal, agentTimeline, governanceHistory)
- [ ] Define mapping spec (each TQ entity → KG node/edge types)

### Dual-Write Phase
- [ ] Add export endpoints to TorqueQuery (events, signals, correlations)
- [ ] Implement ingestion in KG
- [ ] Enable dual-write: new events → both TQ + KG
- [ ] Backfill historical TQ data

### Read Migration
- [ ] Implement KG-backed query variants (agentTimelineFromKG, etc.)
- [ ] Shadow mode: compute from both, log discrepancies
- [ ] Switch primary reads to KG
- [ ] Keep TQ as fallback for one release

### Decommission
- [ ] Reduce TQ scope: local semantic index only
- [ ] Mark KG as source of truth for global relationships

---

## Phase 30 & 31 (High-level)

**Phase 30 — Causal Reasoning Engine**
- CausalGraphView + TemporalIndex
- WhyOperator, ImpactOperator, CounterfactualOperator, DriftPatternsOperator
- `/api/reasoning/{why, impact, counterfactual, drift-patterns}`

**Phase 31 — Orchestration Engine**
- Planner (GoalParser, TaskGraphBuilder, CapabilityResolver)
- Executor (WorkflowRunner, RetryPolicy, DriftAwareExecutor)
- Integration (GovernanceGuard, SelfHealingAdapter)
- `/api/orchestration/{plan, execute, status, graph}`

---

## Integration Points

- **Unified API:** register knowledge-graph routes under `:3100`
- **Evolution Loop:** use graph queries to detect patterns, propose amendments
- **Rewrite Labs:** use graph to identify high-impact refactors, trace changes
- **Reasoning Engine (30):** causal reasoning via KG subgraphs
- **Orchestration Engine (31):** plan & execute via KG + reasoning

---

## Why This Matters

TorqueQuery gives fast semantic index; Vault gives governance records; Repomix gives code snapshots. KG unifies them into a queryable, reasoned-over model of CIC's entire state and evolution. Reasoning engine asks **why** CIC does what it does. Orchestration engine **plans & executes** using both.

Result: CIC moves from reactive (recording events) → proactive (understanding causality, planning autonomously).
