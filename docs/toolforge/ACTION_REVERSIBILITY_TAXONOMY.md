# Action Reversibility Taxonomy & One-Way Door Gates

## Overview

In autonomous agent governance, operations are categorized into **one-way doors** (irreversible actions such as deleting files, transmitting sensitive network payloads, committing financial mutations, or deploying infrastructure) versus **two-way doors** (reversible actions such as code refactoring, scratchpad calculation, AST inspection, and reading local state).

Toolforge implements explicit execution gates via [`modules/OneWayDoorActionGate.mjs`](file:///c:/dev/modules/OneWayDoorActionGate.mjs) to guarantee maximum autonomous velocity on safe two-way door sub-tasks while enforcing mandatory human-in-the-loop pauses on irreversible mutations.

---

## The Three-Tier Reversibility Model

| Tier | Category | Reversibility | Autonomy Policy | Description |
|---|---|---|---|---|
| **Two-Way Door** | `REVERSIBLE` | Fully Reversible | **Autonomous** | Read-only operations, status checks, AST inspection, and deterministic dry-runs. Pre-computed autonomous execution is permitted. |
| **Bounded Sandbox** | `BOUNDED` | Scoped Reversible | **Autonomous within bounds** | File modifications or scratch calculations strictly isolated within temporary directories (`scratch/`, `tmp/`, `.tmp/`). Breaches immediately trigger gates. |
| **One-Way Door** | `IRREVERSIBLE` | Irreversible | **Gated (Human Confirmation)** | File deletions, external network transmissions, database truncations, package publishing, and infrastructure alterations. Blocked until confirmed. |

---

## Standard Tool Classifications

| Tool Identifier | Reversibility Tier | Default Action | Risk Classification |
|---|---|---|---|
| `read_file` | `REVERSIBLE` | Autonomous pass | `LOW` |
| `list_files` | `REVERSIBLE` | Autonomous pass | `LOW` |
| `search_code` | `REVERSIBLE` | Autonomous pass | `LOW` |
| `git_status` | `REVERSIBLE` | Autonomous pass | `LOW` |
| `git_diff` | `REVERSIBLE` | Autonomous pass | `LOW` |
| `inspect_symbol` | `REVERSIBLE` | Autonomous pass | `LOW` |
| `write_scratch` | `BOUNDED` | Autonomous if in `scratch/` | `MEDIUM` |
| `run_sandboxed_test` | `BOUNDED` | Autonomous if sandboxed | `MEDIUM` |
| `delete_file` | `IRREVERSIBLE` | **BLOCKED_BY_GATE** | `CRITICAL` |
| `git_push` | `IRREVERSIBLE` | **BLOCKED_BY_GATE** | `HIGH` |
| `publish_package` | `IRREVERSIBLE` | **BLOCKED_BY_GATE** | `CRITICAL` |
| `send_message` | `IRREVERSIBLE` | **BLOCKED_BY_GATE** | `HIGH` |
| `http_post_external` | `IRREVERSIBLE` | **BLOCKED_BY_GATE** | `CRITICAL` |
| `execute_financial_transaction` | `IRREVERSIBLE` | **BLOCKED_BY_GATE** | `CRITICAL` |
| `modify_production_infra` | `IRREVERSIBLE` | **BLOCKED_BY_GATE** | `CRITICAL` |

---

## Gate Architecture & Interceptor Workflow

### 1. Interception
Before executing any tool call, the agent runtime invokes `OneWayDoorInterceptor.intercept({ toolName, params, confirmationToken, planContext })`.

```javascript
import { OneWayDoorInterceptor, formatGatingPrompt } from './modules/OneWayDoorActionGate.mjs';

const interceptor = new OneWayDoorInterceptor();
const check = await interceptor.intercept({
  toolName: 'delete_file',
  params: { path: 'data/records.db' }
});

if (check.status === 'BLOCKED_BY_GATE') {
  console.log(formatGatingPrompt(check));
  // Halts execution and presents confirmation prompt to operator
}
```

Example rendered prompt:
```text
=================================================================
 ⚠️  ONE-WAY DOOR EXECUTION GATE (ACTION CONFIRMATION REQUIRED)
=================================================================
 Tool:           delete_file
 Risk Level:     CRITICAL
 Reversibility:  IRREVERSIBLE
 Gate ID:        gate-1a2b3c4d5e6f7081
 Target/Params:  {"path":"data/records.db"}
 Impact/Diff:    Irreversible mutation via delete_file
-----------------------------------------------------------------
 This action is irreversible. Autonomous execution is paused.
 To approve, provide confirmation token for gate: gate-1a2b3c4d5e6f7081
=================================================================
```

### 2. Cryptographic & Interactive Confirmation
When an irreversible action is intercepted:
- The interceptor calculates a deterministic `gateId` (invariant to parameter key ordering) and returns `{ status: 'BLOCKED_BY_GATE', gateId, confirmationRequired: true }`.
- To confirm, the operator or controlling human generates an HMAC approval token:
  `generateConfirmationToken(gateId, secretKey)`
- The gate verifies tokens with timing-safe comparison:
  `verifyConfirmationToken(token, gateId, secretKey)`
- Re-executing with `confirmationToken` validates the cryptographic signature and allows execution: `{ status: 'ALLOWED', confirmed: true, tokenVerified: true }`.

### 3. Bounded Sandbox Hardening
For `BOUNDED` operations (e.g. `write_scratch`):
- Targets must reside within approved scratchpad paths (`scratch/`, `tmp/`, etc.).
- Traversal sequences (`..`, `../`, `/../`), POSIX absolute paths (`/`), and Windows drive paths (`C:\`) are strictly rejected with `BOUNDARY_EXCEEDED`.

### 4. Dynamic Plan Drift Detection
If an agent starts with a declared plan of `REVERSIBLE_ONLY`:
- If an earlier step fails and the agent attempts an unapproved fallback involving an irreversible tool (e.g. attempting to delete or overwrite files), the interceptor immediately issues a `HARD_PAUSE`.
- Return format: `{ status: 'HARD_PAUSE', error: 'PLAN_DRIFT_DETECTED', driftedAction: toolName }`.
- Execution halts until the agent re-aligns with the operator and obtains charter expansion.
