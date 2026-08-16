---
name: phase-29-31-test-matrices
description: "Integration test matrix for Phases 29-31; what to test, inputs, expected outputs"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9bb1990c-6782-4cf5-9cba-f739dd4b8021
---

# Phase 29–31 Integration Test Matrices

Operator-grade view of test coverage per phase/service.

---

## Phase 29 — Knowledge Graph

| **Area** | **Test Name** | **Inputs** | **Expected** |
|---------|----------------|-----------|--------------|
| **GraphStore** | `graph_store_crud_nodes` | create/get/update/delete node | node persisted, updated, removed deterministically |
| **GraphStore** | `graph_store_crud_edges` | create/get/update/delete edge | edge persisted, updated, removed deterministically |
| **GraphStore** | `graph_store_indexes` | insert many nodes/edges | queries by type/id use indexes, performance within bounds |
| **TorqueMapper** | `ingest_torque_batch_basic` | single event + signal + correlation | correct RunEvent/Signal/CorrelationCluster nodes + edges |
| **TorqueMapper** | `ingest_torque_batch_with_repo_files` | event with repo + files | EVENT_TOUCHES_REPO / EVENT_TOUCHES_FILE edges present |
| **VaultMapper** | `ingest_vault_records` | governance records + audit events | GovernanceRecord/AuditEvent nodes + RECORD_AMENDS_POLICY edges |
| **RepoMapper** | `ingest_repo_snapshot` | repo + files + commits | Repo/File/Commit nodes + REPO_CONTAINS_FILE / COMMIT_TOUCHES_FILE edges |
| **EvolutionMapper** | `ingest_evolution_outputs` | amendments + policies + constraints | Amendment/Policy/Constraint nodes + derived edges |
| **API / ingest** | `api_ingest_torque_to_graph` | POST batch to `/ingest/torque` | 200 + nodes/edges present in DB |
| **API / ingest** | `api_ingest_vault_to_graph` | POST batch to `/ingest/vault` | 200 + governance nodes/edges present |
| **API / query/paths** | `api_query_paths_agent_to_repo` | agent + repo IDs | path includes AGENT_EXECUTED_EVENT + EVENT_TOUCHES_REPO |
| **API / query/causality** | `api_query_causality_repo_change` | repo change node | upstream chain includes agent + policy (if present) |
| **Introspection** | `api_schema` | GET `/schema` | node/edge types match implementation |
| **Introspection** | `api_stats` | GET `/stats` after ingestion | counts reflect inserted nodes/edges |

---

## Phase 30 — Causal Reasoning Engine

| **Area** | **Test Name** | **Inputs** | **Expected** |
|---------|----------------|-----------|--------------|
| **CausalGraphView** | `causal_graph_view_basic_chain` | small KG subgraph | upstream/downstream traversal matches edges |
| **TemporalIndex** | `temporal_index_ordering` | events with timestamps | ordering consistent, violations detected |
| **WhyOperator** | `why_operator_simple` | target node with clear upstream chain | chain returned in correct order, depth respected |
| **ImpactOperator** | `impact_operator_blast_radius` | node with downstream dependencies | impact metrics (node count/types) correct |
| **CounterfactualOperator** | `counterfactual_remove_policy` | policy node + scenario | delta graph excludes policy effects |
| **DriftPatternsOperator** | `drift_patterns_simple_motif` | KG with repeated drift motif | motif detected and returned |
| **API / why** | `api_why_agent_run` | POST `/why` with RunEvent | explanation includes agent + governance chain if present |
| **API / impact** | `api_impact_policy_change` | POST `/impact` with Policy | downstream repos/agents listed |
| **API / drift-patterns** | `api_drift_patterns_basic` | POST `/drift-patterns` | patterns returned, no errors |

---

## Phase 31 — Orchestration Engine

| **Area** | **Test Name** | **Inputs** | **Expected** |
|---------|----------------|-----------|--------------|
| **GoalParser** | `goal_parser_basic` | simple textual goal | structured intent (target, constraints) produced |
| **TaskGraphBuilder** | `task_graph_builder_linear` | goal with sequential steps | DAG with correct dependencies |
| **TaskGraphBuilder** | `task_graph_builder_branching` | goal with parallelizable tasks | DAG with multiple branches |
| **CapabilityResolver** | `capability_resolver_match_agents` | tasks + KG capabilities | tasks assigned to appropriate agents |
| **WorkflowRunner** | `workflow_runner_success_path` | DAG with all tasks succeeding | all tasks complete, status = success |
| **WorkflowRunner** | `workflow_runner_failure_with_retry` | one task failing with retry policy | retries applied, final status correct |
| **DriftAwareExecutor** | `drift_aware_executor_detects_risk` | task with high drift risk from CRE | execution adapted (e.g., blocked or rerouted) |
| **GovernanceGuard** | `governance_guard_blocks_unauthorized` | task violating Vault policy | execution denied, status = blocked |
| **SelfHealingAdapter** | `self_healing_adapter_reroute` | failing agent node | tasks rerouted to backup agent |
| **API / plan** | `api_plan_simple_goal` | POST `/plan` | planId + tasks returned |
| **API / execute** | `api_execute_plan` | POST `/execute` with planId | workflow started, status trackable |
| **API / status** | `api_status_running_and_done` | GET `/status/{id}` | transitions from running → completed |
| **API / graph** | `api_graph_execution_view` | GET `/graph/{id}` | execution DAG returned with statuses |

---

## Smoke Tests (Cross-Phase)

| **Area** | **Test Name** | **Setup** | **Flow** | **Validate** |
|---------|----------------|----------|---------|------------|
| **KG → CRE** | `smoke_kg_to_cre_why` | ingest TQ batch → KG | call `/why` on RunEvent | upstream chain returned |
| **CRE → Orchestration** | `smoke_cre_to_orchestration_risk_adapt` | seeded KG + high-drift task | plan task, get risk from `/impact` | execution plan adapted |
| **End-to-End** | `smoke_full_stack_ingest_reason_execute` | empty KG | ingest TQ batch → query KG → reason on result → plan task → execute | all layers respond correctly |

---

## Test Counts Summary

- **Phase 29:** 14 tests
- **Phase 30:** 9 tests
- **Phase 31:** 13 tests
- **Smoke:** 3 tests
- **Total:** 39 test scenarios
