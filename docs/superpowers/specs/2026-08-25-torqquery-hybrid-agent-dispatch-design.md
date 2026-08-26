# TorqueQuery Hybrid Agent Dispatch — Design

## Status

Approved v1 scope. Design only; no runtime implementation is included here.

## Goal

Route bounded work to configured local subscription agents, Ollama models, or OpenRouter models through TorqueQuery preflight, with operator override, signed authorization, sequential fallback, and auditable human-readable results.

## Architecture

TorqueQuery remains the policy authority. It evaluates a normalized task contract before execution and recommends a provider/model. A separate dispatcher validates the signed contract, launches an allowlisted provider adapter, captures the result, and asks TorqueQuery whether a retry or approved fallback remains available.

Provider adapters isolate execution differences:

- `subscription-cli`: existing locally configured Codex/Claude-style CLI commands; exact commands and flags must be discovered from the installed environment before implementation.
- `ollama`: existing local Ollama endpoint/configuration.
- `openrouter`: existing OpenRouter configuration and key handling in the workspace; credentials never enter task JSON or traces.

No provider autodiscovery, undocumented vendor API, arbitrary shell command, remote-agent transport, UI, or parallel fallback is in v1.

## Signed task contract

The task file is the portable approval record. It must bind at least:

```json
{
  "contract_version": "1.0",
  "task_id": "TASK-001",
  "task": "...",
  "recommended_route": {"provider": "ollama", "model": "..."},
  "allowed_routes": [{"provider": "ollama", "model": "..."}],
  "max_cost_usd": 0,
  "max_attempts": 3,
  "expires_at": "...",
  "operator_override": true,
  "signature": {
    "algorithm": "Ed25519",
    "key_id": "operator-key-1",
    "value": "base64url-signature"
  }
}
```

`max_attempts` is capped at 3. Zero-cost mode requires both `max_cost_usd: 0` and a provider/model catalog entry whose cost policy is exactly zero. A paid route requires explicit nonzero budget in the signed contract. Retries and fallbacks stay within `allowed_routes`; anything outside the contract requires a new authorization.

### Signing scheme

Contracts are signed with the workspace's existing Ed25519 signing key (same key/keystore used elsewhere in the workspace for local artifact signing; the implementer must locate and reuse it rather than mint a new one). The signature covers the canonical JSON contract body (all fields except `signature` itself, keys sorted, no whitespace). The verifier holds only the corresponding public key. Task 1 must record the discovered key location and canonicalization method before any schema work proceeds.

### Cost policy format

Catalog `cost_policy` entries are USD-per-1K-tokens as a decimal number (input/output may differ: `{"input_per_1k": 0.0, "output_per_1k": 0.0}`). "Exactly zero" means both fields equal `0`. Flat-rate subscription routes (no metered cost) use `{"flat": 0}` and are treated as zero-cost only when `flat` is `0`.

### Preflight interface

`runPreflight` is an in-process function call within the dispatcher process (not a subprocess or network call) that invokes the TorqueQuery adapter library directly and returns its response synchronously before any provider attempt is scheduled. If TorqueQuery is only reachable out-of-process in the target repo, the implementer must wrap it in a local adapter that preserves this synchronous, in-process call contract for the dispatcher.

## Execution flow

1. Validate contract shape, signature, expiry, allowlisted routes, budget, and attempt cap.
2. Run TorqueQuery preflight; return recommendation, expected cost, fallback list, and policy reason.
3. Apply operator override only if it names an allowed route; record override.
4. Execute one attempt in the assigned worktree with bounded timeout and output limits.
5. Normalize provider result into status, failure class, usage/cost receipt, stdout/stderr paths, and artifact paths.
6. On success, stop and emit result. On failure, ask TorqueQuery for the next permitted attempt; stop after three attempts.
7. Emit append-only trace and human-readable terminal summary. Never print credentials or raw secret-bearing environment values.

## Result contract

Every run emits a structured JSON result and a terminal summary containing task ID, attempt count, selected provider/model, recommendation versus override, status, termination reason, cost, and artifact paths. Provider errors, policy stops, authorization failures, timeouts, and task failures use distinct failure classes.

## Safety boundaries

- Provider commands are registry entries, never task-supplied command strings.
- Worktree path must be explicitly supplied and contained within an approved workspace root; the containment check resolves symlinks and `..` segments before comparison and rejects any resolved path outside the root.
- Credentials are resolved by provider configuration at execution time.
- Task and trace data exclude secrets, raw environment, and unrestricted prompt copies.
- Dry-run validates contract, recommendation, and command resolution without launching work.
- Every attempt is attributable to task ID, contract hash, operator identity, provider, model, and timestamp. Operator identity is captured from the invoking user's authenticated local identity (existing workspace convention, e.g. signed-in CLI session or OS user) at override time and recorded in the trace; it is never taken from unauthenticated task input.
- `expires_at` is an ISO 8601 UTC timestamp (`Z` suffix required). Expiry comparison uses the verifier host's UTC clock; contracts within 60 seconds of expiry are treated as expired to absorb clock skew.

## Acceptance criteria

- Preflight produces a recommendation before any agent starts.
- Operator override works only within signed allowlist and is logged.
- Zero-cost contract cannot execute a paid route.
- Three sequential attempts maximum; first success stops execution.
- Local subscription, Ollama, and OpenRouter adapters use existing configuration.
- Missing credentials, unavailable provider, timeout, policy stop, and malformed contract fail closed.
- Structured artifact and human-readable summary agree on final status.
- Dry-run and secret-redaction tests pass.

## Signing profile

Task contracts reuse Sigil's existing Ed25519 signature and RFC 8785 JCS canonicalization profile. The signed bytes are the JCS serialization of the contract with `signature` omitted. The signature is encoded as the existing Sigil envelope shape: `{ "algorithm": "Ed25519", "key_id": "...", "value": "base64url" }`. Verification resolves the operator public key by `key_id` from the configured local trust/identity registry; unknown keys, revoked keys, malformed signatures, and canonicalization failures fail closed. The contract hash and `key_id` are recorded in every attempt trace; private keys never enter task files or traces.

## Verification boundary

Signature verification is delegated to a versioned Sigil verifier interface. TorqueQuery does not reimplement RFC 8785 JCS or Ed25519 verification and does not import Sigil source files directly. The interface accepts a contract plus configured trust context and returns `{ valid, contract_hash, key_id, reason }`; malformed, expired, revoked, unknown-key, or invalid-signature results are fail-closed. The first implementation may be a local Sigil CLI subprocess, but the command and JSON response schema must be versioned and allowlisted.
