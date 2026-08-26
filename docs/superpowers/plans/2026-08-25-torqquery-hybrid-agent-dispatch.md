# TorqueQuery Hybrid Agent Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a policy-gated dispatcher for configured subscription CLIs, Ollama, and OpenRouter with signed authorization, operator override, sequential fallbacks, and auditable results.

**Architecture:** TorqueQuery evaluates admission and retry policy; dispatcher validates signed contracts and delegates execution to provider adapters. Provider commands/configuration are allowlisted and resolved at runtime; task input never supplies arbitrary commands or credentials.

**Tech Stack:** Dispatcher, contracts, verifier, and provider adapters are implemented in Python, matching the existing TorqueQuery adapter/runtime language. OpenRouter/TypeScript workspace configuration is read via existing config files only (no TS runtime invoked). Node/Python process execution as established by the target repository, JSONL traces, Ed25519 signing already used by the workspace (see design doc "Signing scheme"). All test files use the `.py` / pytest convention unless the target repo's TorqueQuery tests already use another established framework — confirm and pin before Task 1 starts.

**Spec:** `docs/superpowers/specs/2026-08-25-torqquery-hybrid-agent-dispatch-design.md`

## Global Constraints

- Preflight recommendation must complete before agent execution.
- One signed task contract authorizes recommendation, override, retries, and fallbacks.
- Maximum three sequential attempts; first success stops execution.
- Zero-cost mode permits only catalog routes with exact `$0` cost policy.
- Paid execution requires explicit positive signed budget.
- Provider commands are static allowlist entries; task payloads cannot provide commands.
- Credentials stay in provider configuration and never enter task files, traces, or summaries.
- Dry-run is required before live execution.
- No undocumented provider API, remote agent transport, parallel fallback, or UI.

---

### Task 1: Freeze contracts and provider catalog

**Files:**
- Create: `tools/agent-dispatch/contracts/task-contract.schema.json`
- Create: `tools/agent-dispatch/providers/catalog.json`
- Test: `tools/agent-dispatch/test/contracts_test.py`

**Interfaces:**
- `TaskContract`: version, task ID, task payload, routes, budget, attempts, expiry, override flag, signature.
- `ProviderRoute`: provider, model, execution mode, cost policy, credential reference.

- [ ] Locate the workspace's existing Ed25519 signing key/keystore and document its path and canonicalization method (sorted-keys JSON, no whitespace) per the design doc's "Signing scheme" section.
- [ ] Write failing tests for required fields, signature presence, max-attempts <= 3, zero-cost route enforcement (both `input_per_1k`/`output_per_1k` and `flat` cost-policy shapes), `expires_at` ISO 8601 UTC format with 60-second skew tolerance, and rejection of task-supplied commands.
- [ ] Run the focused contract tests and confirm failure.
- [ ] Implement schema validation and catalog loading using existing project conventions.
- [ ] Add catalog entries only after verifying installed subscription commands, Ollama configuration, and OpenRouter configuration; record command names without secrets.
- [ ] Run focused tests and confirm pass.
- [ ] Commit: `feat(dispatch): define signed task and provider contracts`.

### Task 2: Signed contract verification and dry-run preflight

**Files:**
- Create: `tools/agent-dispatch/contract_verifier.py`
- Create: `tools/agent-dispatch/preflight.py`
- Test: `tools/agent-dispatch/test/preflight_test.py`

**Interfaces:**
- `verify_contract(contract, public_key) -> VerifiedContract | raises`
- `run_preflight(verified_contract, catalog, torquequery) -> { recommendation, allowed_fallbacks, expected_cost, reason }` — in-process call into the TorqueQuery adapter library per the design doc's "Preflight interface" section; no subprocess/network hop.

- [ ] Test invalid signature, expired contract (including the 60-second skew boundary), unknown route, paid route under zero budget, and recommendation-before-execution ordering.
- [ ] Implement verification and TorqueQuery adapter invocation without launching an agent.
- [ ] Add dry-run output with redacted contract summary and resolved command metadata.
- [ ] Test missing TorqueQuery response and policy-denied routes as fail-closed.
- [ ] Commit: `feat(dispatch): gate execution through signed preflight`.

### Task 3a: Subscription-CLI provider adapter

**Files:**
- Create: `tools/agent-dispatch/providers/subscription_cli.py`
- Test: `tools/agent-dispatch/test/providers_subscription_cli_test.py`

**Interfaces:**
- `run_provider(route, task, execution_context) -> ProviderResult`
- `ProviderResult`: status, failure_class, provider, model, usage, cost, stdout_path, stderr_path, artifact_paths.

- [ ] Test command allowlisting (registry-only, no task-supplied command strings), missing local CLI configuration, timeout, nonzero exit, and secret redaction.
- [ ] Implement subscription adapter using verified existing CLI configuration only.
- [ ] Ensure adapter cannot receive arbitrary executable paths or environment secrets from task input.
- [ ] Commit: `feat(dispatch): add subscription-cli provider adapter`.

### Task 3b: Ollama provider adapter

**Files:**
- Create: `tools/agent-dispatch/providers/ollama.py`
- Test: `tools/agent-dispatch/test/providers_ollama_test.py`

- [ ] Test missing/unreachable local endpoint, timeout, nonzero/error response, and secret redaction.
- [ ] Implement Ollama adapter using existing local endpoint/configuration only.
- [ ] Commit: `feat(dispatch): add ollama provider adapter`.

### Task 3c: OpenRouter provider adapter

**Files:**
- Create: `tools/agent-dispatch/providers/openrouter.py`
- Test: `tools/agent-dispatch/test/providers_openrouter_test.py`

- [ ] Test missing credential/configuration, timeout, HTTP/provider error, and secret redaction (key never appears in result, trace, or logs).
- [ ] Implement OpenRouter adapter through existing workspace configuration/key resolver only.
- [ ] Commit: `feat(dispatch): add openrouter provider adapter`.

### Task 4: Sequential dispatcher and retry policy

**Files:**
- Create: `tools/agent-dispatch/dispatcher.py`
- Test: `tools/agent-dispatch/test/dispatcher_test.py`

**Interfaces:**
- `dispatch(verified_contract, options) -> DispatchResult`
- `DispatchResult`: final_status, attempts, recommendation, override, operator_identity, final_provider, final_model, total_cost, result_artifact, trace_path.

- [ ] Test recommendation is emitted before attempt one.
- [ ] Test operator override only selects signed allowlisted route.
- [ ] Test operator identity is captured from the invoking authenticated local identity (not from task input) and recorded on every override and attempt.
- [ ] Test first success stops; failures proceed through fallback order sequentially.
- [ ] Test hard stop at attempt three and refusal of out-of-contract fallback.
- [ ] Test zero-cost contract rejects paid route even when operator requests it.
- [ ] Test worktree containment rejects a resolved path (post symlink/`..` resolution) outside the approved workspace root.
- [ ] Implement dispatcher with bounded timeout, worktree containment, and fail-closed policy checks.
- [ ] Commit: `feat(dispatch): execute signed tasks with bounded fallbacks`.

### Task 5: Results, traces, and operator output

**Files:**
- Create: `tools/agent-dispatch/results.py`
- Create: `tools/agent-dispatch/trace.py`
- Test: `tools/agent-dispatch/test/results_test.py`

**Interfaces:**
- `write_result(result, output_dir) -> { result_path, summary }`
- `append_trace(event, trace_path) -> None`

- [ ] Test structured result and terminal summary agree on status, attempts, route, cost, and artifact paths.
- [ ] Test append-only trace fields and secret redaction.
- [ ] Implement human-readable summary with explicit policy stop, provider failure, and success wording.
- [ ] Implement JSON result and JSONL trace writes with atomic result publication.
- [ ] Commit: `feat(dispatch): emit auditable results and summaries`.

### Task 6: End-to-end dry-run and live smoke coverage

**Files:**
- Create: `tools/agent-dispatch/test/e2e_test.py`
- Modify: existing test/config docs only where required by discovered provider setup.

- [ ] Run dry-run with a zero-cost Ollama or configured free OpenRouter route.
- [ ] Run dry-run with an operator override and verify the route remains allowlisted.
- [ ] **Gate:** before any live smoke run, stop and get explicit operator go-ahead — confirm which real provider/credentials will be used, expected cost (must be $0 or an explicitly approved amount), and the exact bounded prompt. Do not proceed on an assumed yes.
- [ ] Run a controlled live smoke task using a harmless bounded prompt and approved worktree, only after that go-ahead.
- [ ] Exercise one forced failure and verify sequential fallback plus maximum-three-attempt behavior.
- [ ] Run the repository's focused and full validation commands.
- [ ] Review diff for unrelated files and untracked secret/config artifacts.
- [ ] Commit: `test(dispatch): verify hybrid routing end to end`.

## Final verification

- [ ] `git diff --check`
- [ ] Focused dispatcher/provider test suite
- [ ] Full repository test suite or documented bounded substitute
- [ ] Dry-run receipt
- [ ] Live smoke receipt, if credentials/configuration are available
- [ ] Secret scan and clean scoped diff review

## Task 2 signing decision

Use Sigil's existing Ed25519 + RFC 8785 JCS profile. Canonical bytes are the JCS serialization of the task contract with `signature` omitted. Signature shape is `{ algorithm: "Ed25519", key_id: string, value: base64url }`; verification resolves `key_id` through the configured local trust/identity registry. Do not create a TorqueQuery-specific key format or signing scheme.

## Task 2 boundary ruling

Use a versioned Sigil verifier CLI/API as the cryptographic boundary. Do not duplicate JCS or Ed25519 in TorqueQuery and do not import `C:\dev\sigil-repo` source directly. Add the verifier command/response contract before the TorqueQuery preflight caller. Expected response: `{ valid: boolean, contract_hash: string, key_id: string, reason: string|null }`; nonzero exit, malformed response, unknown key, revoked key, or invalid signature fails closed.
