---
name: phase-29-31-commit-ready-todos
description: "Atomic git-commit task blocks per service (29–31); exact files, test counts, ready to execute"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9bb1990c-6782-4cf5-9cba-f739dd4b8021
---

# Phase 29–31: Commit-Ready TODO Blocks

Each block = one git commit. Checkboxes = atomic task units.

---

## Phase 29.0 — Knowledge Graph Skeleton

### COMMIT: Knowledge Graph schema & migrations

**File:** `services/knowledge-graph/src/core/graph_store/migrations/001_init_nodes_edges.sql`
```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  labels TEXT,
  properties TEXT
);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  src_id TEXT NOT NULL REFERENCES nodes(id),
  dst_id TEXT NOT NULL REFERENCES nodes(id),
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  properties TEXT
);

CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_created_at ON nodes(created_at);
CREATE INDEX idx_edges_src_id ON edges(src_id);
CREATE INDEX idx_edges_dst_id ON edges(dst_id);
CREATE INDEX idx_edges_type ON edges(type);
CREATE INDEX idx_edges_created_at ON edges(created_at);
```

- [ ] Write `001_init_nodes_edges.sql` (20 LOC)
- [ ] Write `002_indexes.sql` with FTS index on properties (15 LOC)
- [ ] Write `migrations/index.ts` to load + run migrations (30 LOC)

**Files:** `services/knowledge-graph/src/core/models/{Node,Edge,Types}.ts`

- [ ] `Node.ts`: interface + validator (20 LOC)
- [ ] `Edge.ts`: interface + validator (20 LOC)
- [ ] `Types.ts`: enums for node/edge types (40 LOC)

**File:** `services/knowledge-graph/src/core/graph_store/GraphStore.ts`

- [ ] `GraphStore` class skeleton (constructor, db init)
- [ ] `createNode(node: Node): Promise<void>`
- [ ] `getNode(id: string): Promise<Node | null>`
- [ ] `findNodes(type: string): Promise<Node[]>`
- [ ] `updateNode(id: string, updates: Partial<Node>): Promise<void>`
- [ ] `createEdge(edge: Edge): Promise<void>`
- [ ] `getEdge(id: string): Promise<Edge | null>`
- [ ] `findEdges(srcId?: string, dstId?: string, type?: string): Promise<Edge[]>`
- [ ] `batchInsert(nodes: Node[], edges: Edge[]): Promise<void>` (transactional)
- [ ] Total: ~150 LOC

**File:** `services/knowledge-graph/tests/unit/graph_store.test.ts`

- [ ] Test `createNode` + `getNode`
- [ ] Test `findNodes` by type
- [ ] Test `createEdge` + `getEdge`
- [ ] Test `findEdges` filters (src, dst, type)
- [ ] Test `batchInsert` atomicity (rollback on error)
- [ ] 5 test suites, ~80 LOC

**Commit message:**
```
Phase 29.0: Knowledge Graph schema & GraphStore CRUD

- SQLite nodes/edges schema with indexes
- GraphStore: createNode, getNode, findNodes, etc.
- Batch insert with transaction semantics
- 5 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: GraphStore introspection routes

**File:** `services/knowledge-graph/src/api/routes/introspection/schema.ts`

- [ ] `GET /api/knowledge-graph/schema` handler
- [ ] Returns node types, edge types, properties schema (40 LOC)

**File:** `services/knowledge-graph/src/api/routes/introspection/stats.ts`

- [ ] `GET /api/knowledge-graph/stats` handler
- [ ] Counts: nodes (by type), edges (by type)
- [ ] Last ingestion timestamp
- [ ] Graph density (50 LOC)

**File:** `services/knowledge-graph/src/api/server.ts`

- [ ] Express app skeleton
- [ ] Middleware: logging, error handling
- [ ] Register `/schema`, `/stats` routes
- [ ] Health check endpoint (60 LOC)

**Files:** `services/knowledge-graph/tests/integration/api_schema_stats.test.ts`

- [ ] Test `/schema` returns correct structure
- [ ] Test `/stats` with seeded graph (10 nodes, 5 edges)
- [ ] 2 test suites, ~40 LOC

**Commit message:**
```
Phase 29.0: Knowledge Graph introspection API

- GET /schema: node/edge types + properties
- GET /stats: counts, density, last ingestion time
- Express server + error middleware
- 2 integration tests passing

Services: knowledge-graph
```

---

## Phase 29.1 — Ingestion Bridges

### COMMIT: TorqueQuery mapper

**File:** `services/knowledge-graph/src/core/mappers/TorqueMapper.ts`

- [ ] `mapRunEvent(event: TorqueEvent): {nodes: Node[], edges: Edge[]}`
  - RunEvent node (type="RunEvent")
  - edges: AGENT_EXECUTED_EVENT, EVENT_TOUCHES_REPO, EVENT_EMITS_SIGNAL
- [ ] `mapSignal(signal: TorqueSignal): {nodes: Node[], edges: Edge[]}`
  - Signal node (type="Signal")
- [ ] `mapCorrelationCluster(cluster: TorqueCorrelation): {nodes: Node[], edges: Edge[]}`
  - CorrelationCluster node
  - edges: CORRELATED_WITH, PART_OF_CLUSTER
- [ ] Total: ~120 LOC

**File:** `services/knowledge-graph/tests/unit/mappers/torque_mapper.test.ts`

- [ ] Test mapRunEvent: node + edge generation
- [ ] Test mapSignal: correct properties
- [ ] Test mapCorrelationCluster: edge cardinality
- [ ] 3 test suites, ~60 LOC

**Commit message:**
```
Phase 29.1: TorqueQuery ingestion mapper

- MapRunEvent → RunEvent node + 3 edge types
- MapSignal → Signal node
- MapCorrelationCluster → cluster + member edges
- 3 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Vault mapper

**File:** `services/knowledge-graph/src/core/mappers/VaultMapper.ts`

- [ ] `mapGovernanceRecord(record: VaultRecord): {nodes: Node[], edges: Edge[]}`
  - GovernanceRecord node
  - edges: RECORD_AMENDS_POLICY, RECORD_CREATES_CONSTRAINT, EVENT_AUTHORED_BY_AGENT
- [ ] `mapAuditEvent(event: VaultAuditEvent): {nodes: Node[], edges: Edge[]}`
  - AuditEvent node
  - edges: EVENT_TOUCHES_SECRET (no secret material, descriptor only)
- [ ] `mapSecretDescriptor(descriptor: SecretMetadata): Node`
  - SecretDescriptor node (no plaintext)
- [ ] Total: ~100 LOC

**File:** `services/knowledge-graph/tests/unit/mappers/vault_mapper.test.ts`

- [ ] Test mapGovernanceRecord: node properties, edges
- [ ] Test mapAuditEvent: 3 edge types
- [ ] Test mapSecretDescriptor: no secret material leaked
- [ ] 3 test suites, ~50 LOC

**Commit message:**
```
Phase 29.1: Vault ingestion mapper

- MapGovernanceRecord → policy/constraint edges
- MapAuditEvent → event node
- MapSecretDescriptor → metadata only (no plaintext)
- 3 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Repo mapper

**File:** `services/knowledge-graph/src/core/mappers/RepoMapper.ts`

- [ ] `mapRepo(repo: Repomix.Repo): {nodes: Node[], edges: Edge[]}`
  - Repo node (type="Repo", properties: health_score, last_commit_at)
  - edges: REPO_CONTAINS_FILE (one per file)
- [ ] `mapFile(file: Repomix.File): Node`
  - File node (type="File", properties: path, size, modified_at)
- [ ] `mapCommit(commit: Repomix.Commit): {nodes: Node[], edges: Edge[]}`
  - Commit node (type="Commit", properties: hash, author, timestamp)
  - edges: COMMIT_TOUCHES_FILE (one per touched file), AGENT_MODIFIED_REPO
- [ ] Total: ~130 LOC

**File:** `services/knowledge-graph/tests/unit/mappers/repo_mapper.test.ts`

- [ ] Test mapRepo: Repo node + REPO_CONTAINS_FILE edges
- [ ] Test mapFile: File node properties
- [ ] Test mapCommit: Commit node + COMMIT_TOUCHES_FILE edges
- [ ] 3 test suites, ~70 LOC

**Commit message:**
```
Phase 29.1: Repomix ingestion mapper

- MapRepo → Repo node + file edges
- MapFile → File node
- MapCommit → Commit node + touched file edges
- 3 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Evolution mapper

**File:** `services/knowledge-graph/src/core/mappers/EvolutionMapper.ts`

- [ ] `mapAmendment(amendment: Evolution.Amendment): {nodes: Node[], edges: Edge[]}`
  - Amendment node (type="Amendment")
  - edges: AMENDMENT_DERIVED_FROM_DRIFT_SIGNAL
- [ ] `mapPolicy(policy: Evolution.Policy): {nodes: Node[], edges: Edge[]}`
  - Policy node (type="Policy")
  - edges: POLICY_GOVERNING_AGENT
- [ ] `mapConstraint(constraint: Evolution.Constraint): {nodes: Node[], edges: Edge[]}`
  - Constraint node (type="Constraint")
  - edges: CONSTRAINT_APPLIES_TO_SERVICE
- [ ] Total: ~100 LOC

**File:** `services/knowledge-graph/tests/unit/mappers/evolution_mapper.test.ts`

- [ ] Test mapAmendment: node + signal edge
- [ ] Test mapPolicy: node + agent edge
- [ ] Test mapConstraint: node + service edge
- [ ] 3 test suites, ~50 LOC

**Commit message:**
```
Phase 29.1: Evolution Loop ingestion mapper

- MapAmendment → Amendment node + signal edge
- MapPolicy → Policy node + agent edge
- MapConstraint → Constraint node + service edge
- 3 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Ingestion API routes

**File:** `services/knowledge-graph/src/api/routes/ingest/torque.ts`

- [ ] `POST /api/knowledge-graph/ingest/torque` handler
- [ ] Validate batch payload
- [ ] Call `TorqueMapper.mapRunEvent`, `.mapSignal`, `.mapCorrelationCluster`
- [ ] Call `GraphStore.batchInsert`
- [ ] Return `{status: "ok", nodeCount, edgeCount}` (60 LOC)

**File:** `services/knowledge-graph/src/api/routes/ingest/vault.ts`

- [ ] `POST /api/knowledge-graph/ingest/vault` handler
- [ ] Call VaultMapper methods
- [ ] batchInsert
- [ ] Response (50 LOC)

**File:** `services/knowledge-graph/src/api/routes/ingest/repos.ts`

- [ ] `POST /api/knowledge-graph/ingest/repos` handler
- [ ] Call RepoMapper methods
- [ ] batchInsert
- [ ] Response (50 LOC)

**File:** `services/knowledge-graph/src/api/routes/ingest/evolution.ts`

- [ ] `POST /api/knowledge-graph/ingest/evolution` handler
- [ ] Call EvolutionMapper methods
- [ ] batchInsert
- [ ] Response (50 LOC)

**File:** `services/knowledge-graph/src/api/server.ts` (update)

- [ ] Register `/ingest/torque`, `/ingest/vault`, `/ingest/repos`, `/ingest/evolution` routes

**File:** `services/knowledge-graph/tests/integration/ingest_torque_to_graph.test.ts`

- [ ] Send batch → `/ingest/torque`
- [ ] Verify nodes + edges in graph
- [ ] Test idempotency (same batch twice = once)
- [ ] 2 test suites, ~80 LOC

**Files:** `services/knowledge-graph/tests/integration/ingest_vault_to_graph.test.ts`, `ingest_repo_to_graph.test.ts`, `ingest_evolution_to_graph.test.ts`

- [ ] Same pattern per mapper
- [ ] 2 test suites each, ~80 LOC per file

**Commit message:**
```
Phase 29.1: Ingestion API routes

- POST /ingest/torque, /vault, /repos, /evolution
- Batch validation + mapper dispatch
- batchInsert with idempotent semantics
- 4 integration tests passing (one per mapper)

Services: knowledge-graph
```

---

## Phase 29.2 — Query Engine

### COMMIT: Path query operator

**File:** `services/knowledge-graph/src/core/query_engine/PathQuery.ts`

- [ ] `class PathQuery`
- [ ] `run(startId: string, endId: string, maxDepth: int, edgeTypeFilter?: string[]): Promise<Path[]>`
- [ ] BFS implementation
- [ ] Cycle detection
- [ ] Return top N paths (limit 10)
- [ ] Total: ~150 LOC

**File:** `services/knowledge-graph/tests/unit/query_engine/paths.test.ts`

- [ ] Test BFS: simple 3-node path
- [ ] Test maxDepth: path beyond depth returns empty
- [ ] Test edgeTypeFilter: only AGENT_EXECUTED_EVENT edges
- [ ] Test cycle detection
- [ ] Test no path found
- [ ] 5 test suites, ~100 LOC

**Commit message:**
```
Phase 29.2: Path query operator

- BFS path finding between nodes
- Depth limit + edge type filter
- Cycle detection
- 5 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Neighborhood query operator

**File:** `services/knowledge-graph/src/core/query_engine/NeighborhoodQuery.ts`

- [ ] `class NeighborhoodQuery`
- [ ] `run(nodeId: string, k: int, nodeTypeFilter?: string[], edgeTypeFilter?: string[]): Promise<Neighborhood>`
- [ ] Return set of k-hop neighbors
- [ ] K-levels expansion
- [ ] Filters
- [ ] Total: ~120 LOC

**File:** `services/knowledge-graph/tests/unit/query_engine/neighborhood.test.ts`

- [ ] Test 1-hop neighbors
- [ ] Test 2-hop neighbors (k=2)
- [ ] Test nodeTypeFilter
- [ ] Test edgeTypeFilter
- [ ] 4 test suites, ~80 LOC

**Commit message:**
```
Phase 29.2: Neighborhood query operator

- K-hop expansion around node
- Node type + edge type filters
- Deduplicated results
- 4 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Pattern query operator

**File:** `services/knowledge-graph/src/core/query_engine/PatternQuery.ts`

- [ ] `class PatternQuery`
- [ ] `run(pattern: {startType: string, edgeType: string, endType: string}, limit?: int): Promise<Match[]>`
- [ ] Simple 3-node pattern matching
- [ ] Return all matching triplets
- [ ] Total: ~100 LOC

**File:** `services/knowledge-graph/tests/unit/query_engine/patterns.test.ts`

- [ ] Test simple pattern: Agent → EXECUTED → RunEvent
- [ ] Test pattern with no matches
- [ ] Test limit
- [ ] 3 test suites, ~60 LOC

**Commit message:**
```
Phase 29.2: Pattern query operator

- Simple 3-node pattern matching
- {startType, edgeType, endType}
- Limit + results
- 3 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Causality query operator

**File:** `services/knowledge-graph/src/core/query_engine/CausalityQuery.ts`

- [ ] `class CausalityQuery`
- [ ] `run(nodeId: string, direction: "upstream" | "downstream", maxDepth?: int): Promise<CausalChain>`
- [ ] Upstream: traverse AMENDS_POLICY, AUTHORED_BY_AGENT, DERIVED_FROM_SIGNAL edges
- [ ] Downstream: reverse traversal
- [ ] Return chain of events
- [ ] Total: ~140 LOC

**File:** `services/knowledge-graph/tests/unit/query_engine/causality.test.ts`

- [ ] Test upstream: Repo change → Policy → Amendment
- [ ] Test downstream: Policy → affected agents
- [ ] Test maxDepth
- [ ] Test no causal chain
- [ ] 4 test suites, ~100 LOC

**Commit message:**
```
Phase 29.2: Causality query operator

- Upstream: event → governing policy → amendment
- Downstream: policy → affected agents/repos
- Max depth limit
- 4 unit tests passing

Services: knowledge-graph
```

---

### COMMIT: Query API routes

**File:** `services/knowledge-graph/src/api/routes/query/paths.ts`

- [ ] `POST /api/knowledge-graph/query/paths` handler
- [ ] Request: {start: NodeRef, end: NodeRef, maxDepth?, edgeTypes?}
- [ ] Call PathQuery.run
- [ ] Response: {paths: Path[][]} (50 LOC)

**File:** `services/knowledge-graph/src/api/routes/query/neighborhood.ts`

- [ ] `POST /api/knowledge-graph/query/neighborhood` handler
- [ ] Request: {node: NodeRef, k: int, nodeTypes?, edgeTypes?}
- [ ] Call NeighborhoodQuery.run
- [ ] Response: {neighbors: Node[], edges: Edge[]} (50 LOC)

**File:** `services/knowledge-graph/src/api/routes/query/patterns.ts`

- [ ] `POST /api/knowledge-graph/query/patterns` handler
- [ ] Request: {pattern: {startType, edgeType, endType}, limit?}
- [ ] Call PatternQuery.run
- [ ] Response: {matches: Match[]} (40 LOC)

**File:** `services/knowledge-graph/src/api/routes/query/causality.ts`

- [ ] `POST /api/knowledge-graph/query/causality` handler
- [ ] Request: {node: NodeRef, direction: "upstream" | "downstream", maxDepth?}
- [ ] Call CausalityQuery.run
- [ ] Response: {chain: CausalChain} (50 LOC)

**File:** `services/knowledge-graph/src/api/server.ts` (update)

- [ ] Register `/query/*` routes

**File:** `services/knowledge-graph/tests/integration/api_query_paths.test.ts`

- [ ] Build seeded graph (agent → repo → file chain)
- [ ] Call `/query/paths` between agent and file
- [ ] Verify path returned
- [ ] 1 test suite, ~50 LOC

**File:** `services/knowledge-graph/tests/integration/api_query_causality.test.ts`

- [ ] Build seeded graph (amendment → policy → repo)
- [ ] Call `/query/causality` upstream from repo
- [ ] Verify chain returned
- [ ] 1 test suite, ~50 LOC

**Commit message:**
```
Phase 29.2: Query API routes

- POST /query/paths, /neighborhood, /patterns, /causality
- Request validation + operator dispatch
- Structured responses
- 2 integration tests passing

Services: knowledge-graph
```

---

## Phase 29.3 — Governance Integration

### COMMIT: Access control + digest chain

**File:** `services/knowledge-graph/src/infra/vault_client.ts`

- [ ] VaultClient: query policies, check agent permissions
- [ ] Fetch constraint rules
- [ ] Store ingestion batch digests
- [ ] Total: ~100 LOC

**File:** `services/knowledge-graph/src/api/middleware/policy_filter.ts`

- [ ] Middleware: filter query results by agent + policies
- [ ] Redact nodes/edges not accessible to agent
- [ ] Total: ~80 LOC

**File:** `services/knowledge-graph/src/core/graph_store/GraphStore.ts` (update)

- [ ] Add `batchInsertWithDigest(nodes, edges, agentId): Promise<digestHash>`
- [ ] Compute SHA256 of batch
- [ ] Store digest in Vault
- [ ] Total: ~30 LOC added

**File:** `services/knowledge-graph/tests/integration/api_policy_filtered_query.test.ts`

- [ ] Agent A queries → sees filtered results (governed edges only)
- [ ] Agent B queries same → different results
- [ ] Verify digest stored in Vault
- [ ] 2 test suites, ~80 LOC

**Commit message:**
```
Phase 29.3: Governance integration

- VaultClient: policy + constraint lookup
- Query result filtering by agent + policy
- Batch digest chain for tamper-evidence
- 2 integration tests passing

Services: knowledge-graph, vault-client
```

---

## Phase 30 — Causal Reasoning Engine (Skeleton)

### COMMIT: Causal model + operators

**File:** `services/reasoning-engine/src/core/causal_model/CausalGraphView.ts`

- [ ] `class CausalGraphView`
- [ ] Load KG subgraph via KnowledgeGraphClient
- [ ] Build directed causal DAG (subset of edges: AMENDS, GOVERNED_BY, DERIVED_FROM)
- [ ] Total: ~100 LOC

**File:** `services/reasoning-engine/src/core/causal_model/TemporalIndex.ts`

- [ ] `class TemporalIndex`
- [ ] Index nodes by created_at
- [ ] Query by time window
- [ ] Detect temporal ordering violations
- [ ] Total: ~80 LOC

**File:** `services/reasoning-engine/src/core/operators/WhyOperator.ts`

- [ ] `class WhyOperator`
- [ ] `run(target: NodeRef, maxDepth?: int): Promise<WhyExplanation>`
- [ ] Upstream causal chain via CausalGraphView
- [ ] Format as explanation (chain + summary)
- [ ] Total: ~100 LOC

**File:** `services/reasoning-engine/src/core/operators/ImpactOperator.ts`

- [ ] `class ImpactOperator`
- [ ] Downstream impact graph
- [ ] Compute blast radius metrics
- [ ] Total: ~100 LOC

**File:** `services/reasoning-engine/src/core/operators/CounterfactualOperator.ts`

- [ ] `class CounterfactualOperator`
- [ ] Simulate node/edge removal
- [ ] Recompute reachable nodes
- [ ] Return delta vs baseline
- [ ] Total: ~120 LOC

**File:** `services/reasoning-engine/src/core/operators/DriftPatternsOperator.ts`

- [ ] `class DriftPatternsOperator`
- [ ] Detect repeated drift motifs
- [ ] Example: policy → agent → repo → drift → amendment
- [ ] Total: ~110 LOC

**File:** `services/reasoning-engine/tests/unit/operators/why_operator.test.ts`

- [ ] Test simple upstream chain
- [ ] Test maxDepth
- [ ] Test summary formatting
- [ ] 3 test suites, ~60 LOC

**Files:** `tests/unit/operators/impact_operator.test.ts`, `counterfactual_operator.test.ts`, `drift_patterns_operator.test.ts`

- [ ] 3 test suites each, ~60 LOC per file

**Commit message:**
```
Phase 30: Causal reasoning operators

- CausalGraphView + TemporalIndex for KG slicing
- WhyOperator (upstream), ImpactOperator (downstream)
- CounterfactualOperator (removal sim), DriftPatternsOperator
- 12 unit tests passing

Services: reasoning-engine
```

---

### COMMIT: Reasoning API routes

**File:** `services/reasoning-engine/src/api/routes/why.ts`

- [ ] `POST /api/reasoning/why` handler
- [ ] Request: {target: NodeRef, maxDepth?, filters?}
- [ ] Call WhyOperator.run
- [ ] Response: {chains: NodeRef[][], summary: string} (50 LOC)

**File:** `services/reasoning-engine/src/api/routes/impact.ts`

- [ ] `POST /api/reasoning/impact` handler
- [ ] Request: {target: NodeRef, maxDepth?}
- [ ] Call ImpactOperator.run
- [ ] Response: {blastRadius: {nodeCount, edgeCount}, affectedTypes: string[]} (50 LOC)

**File:** `services/reasoning-engine/src/api/routes/counterfactual.ts`

- [ ] `POST /api/reasoning/counterfactual` handler
- [ ] Request: {nodeToRemove: NodeRef}
- [ ] Call CounterfactualOperator.run
- [ ] Response: {delta: {newlyUnreachable: NodeRef[]}} (50 LOC)

**File:** `services/reasoning-engine/src/api/routes/drift_patterns.ts`

- [ ] `POST /api/reasoning/drift-patterns` handler
- [ ] Request: {timeWindow?: [start, end]}
- [ ] Call DriftPatternsOperator.run
- [ ] Response: {patterns: Pattern[], frequency: map} (50 LOC)

**File:** `services/reasoning-engine/src/api/server.ts`

- [ ] Express app + routes
- [ ] Health check
- [ ] Error middleware (50 LOC)

**File:** `services/reasoning-engine/tests/integration/api_why.test.ts`

- [ ] Build seeded KG (amendment → policy → repo)
- [ ] Call `/why` on repo change
- [ ] Verify chain + summary
- [ ] 1 test suite, ~50 LOC

**Commit message:**
```
Phase 30: Reasoning API

- POST /why, /impact, /counterfactual, /drift-patterns
- Operator dispatch + response formatting
- 1 integration test passing (why flow)

Services: reasoning-engine
```

---

## Phase 31 — Orchestration Engine (Skeleton)

### COMMIT: Planner + Executor skeletons

**File:** `services/orchestration-engine/src/core/planner/GoalParser.ts`

- [ ] `class GoalParser`
- [ ] `parse(goal: string): Promise<StructuredIntent>`
- [ ] Extract intent, constraints, agents
- [ ] Total: ~80 LOC

**File:** `services/orchestration-engine/src/core/planner/TaskGraphBuilder.ts`

- [ ] `class TaskGraphBuilder`
- [ ] `build(intent: StructuredIntent): Promise<TaskDAG>`
- [ ] Generate task nodes, dependencies
- [ ] Total: ~120 LOC

**File:** `services/orchestration-engine/src/core/planner/CapabilityResolver.ts`

- [ ] `class CapabilityResolver`
- [ ] `resolve(task: Task): Promise<{agent: AgentRef, capabilities: string[]}>`
- [ ] Use KG to find capable agents
- [ ] Total: ~100 LOC

**File:** `services/orchestration-engine/src/core/executor/WorkflowRunner.ts`

- [ ] `class WorkflowRunner`
- [ ] `run(dag: TaskDAG): Promise<ExecutionResult>`
- [ ] Topological sort + parallel execution
- [ ] Track status per task
- [ ] Total: ~150 LOC

**File:** `services/orchestration-engine/src/core/executor/RetryPolicy.ts`

- [ ] `class RetryPolicy`
- [ ] Exponential backoff config
- [ ] Circuit breaker
- [ ] Total: ~60 LOC

**File:** `services/orchestration-engine/src/core/executor/DriftAwareExecutor.ts`

- [ ] `class DriftAwareExecutor`
- [ ] Consult ReasoningEngineClient for drift risk
- [ ] Adapt task sequence if risk > threshold
- [ ] Total: ~100 LOC

**File:** `services/orchestration-engine/tests/unit/planner/task_graph_builder.test.ts`

- [ ] Test simple 2-task DAG
- [ ] Test dependency order
- [ ] 2 test suites, ~50 LOC

**File:** `services/orchestration-engine/tests/unit/executor/workflow_runner.test.ts`

- [ ] Test DAG execution order
- [ ] Test status tracking
- [ ] 2 test suites, ~50 LOC

**Commit message:**
```
Phase 31: Planner + Executor skeletons

- GoalParser → StructuredIntent
- TaskGraphBuilder → DAG
- WorkflowRunner → topological execution
- DriftAwareExecutor → risk adaptation
- 4 unit tests passing

Services: orchestration-engine
```

---

### COMMIT: Orchestration API routes

**File:** `services/orchestration-engine/src/api/routes/plan.ts`

- [ ] `POST /api/orchestration/plan` handler
- [ ] Request: {goal: string, constraints?: string[]}
- [ ] Call Planner.generatePlan
- [ ] Response: {planId: UUID, tasks: Task[], dependencies: Dependency[]} (60 LOC)

**File:** `services/orchestration-engine/src/api/routes/execute.ts`

- [ ] `POST /api/orchestration/execute` handler
- [ ] Request: {planId: UUID}
- [ ] Call Executor.run
- [ ] Response: {executionId: UUID, status: "running"} (40 LOC)

**File:** `services/orchestration-engine/src/api/routes/status.ts`

- [ ] `GET /api/orchestration/status/{id}` handler
- [ ] Return: {executionId, status, tasks: {taskId, status, logs}[]} (40 LOC)

**File:** `services/orchestration-engine/src/api/routes/graph.ts`

- [ ] `GET /api/orchestration/graph/{id}` handler
- [ ] Return execution graph (nodes=tasks, edges=dependencies) (30 LOC)

**File:** `services/orchestration-engine/src/api/server.ts`

- [ ] Express app + routes
- [ ] Health check (50 LOC)

**File:** `services/orchestration-engine/tests/integration/api_plan.test.ts`

- [ ] Call `/plan` with goal
- [ ] Verify planId + task structure
- [ ] 1 test suite, ~50 LOC

**File:** `services/orchestration-engine/tests/integration/api_execute.test.ts`

- [ ] Call `/execute` on plan
- [ ] Call `/status` → verify status = "running"
- [ ] 1 test suite, ~50 LOC

**Commit message:**
```
Phase 31: Orchestration API

- POST /plan, /execute
- GET /status/{id}, /graph/{id}
- Planner dispatch, executor launch, status tracking
- 2 integration tests passing

Services: orchestration-engine
```

---

## Integration Across Phases

### COMMIT: Unified API router

**File:** `libs/unified-api/src/router.ts` (update)

- [ ] Register `/api/knowledge-graph/*` routes
- [ ] Register `/api/reasoning/*` routes
- [ ] Register `/api/orchestration/*` routes
- [ ] Ensure consistent error handling + timeouts
- [ ] Total: ~40 LOC added

**Commit message:**
```
Unified API: register KG, Reasoning, Orchestration routes

- `:3100` gateway routes all three services
- Consistent middleware (error, timeout, logging)
- Health check aggregates all three services

Services: unified-api
```

---

## Summary

**Phase 29:** 8 commits (schema, routes, 4 mappers, 4 ingest routes, 4 query operators, 4 query routes, governance)
**Phase 30:** 2 commits (operators, API routes)
**Phase 31:** 2 commits (planner/executor, API routes)
**Integration:** 1 commit (unified API)

**Total: 13 commits**
**Total LOC:** ~5000 (code + tests)
**Total tests:** ~80+ test suites, ~600+ test cases

Each commit is atomic, testable, deployable.
