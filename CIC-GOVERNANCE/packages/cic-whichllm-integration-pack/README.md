---
title: "CIC-WHICHLLM Integration Pack"
document_id: "CIC-WHICHLLM-INTEGRATION-PACK-README"
category: "readme"
status: "candidate"
version: "1.0.0"
---

# CIC-WHICHLLM-INTEGRATION-PACK v1.0

**CIC Spec v2.4.0 | Amendment §2/S3-A1 | Rewrite Labs Operator Grade**

A fully self-contained, zero-dependency Node 20+ ESM integration pack for connecting the CIC governance infrastructure to the WHICHLLM API. Every artifact in this pack enforces determinism, lineage integrity, and governance compliance at the operator level.

---

## Provenance & Attribution

> [!NOTE]
> Toolforge integrates the external **WhichLLM** routing and evaluation system.
> Source: [https://github.com/whichllm/whichllm](https://github.com/whichllm/whichllm)
>
> Toolforge wraps WhichLLM within this integration pack, augmenting it with CIC governance checks (GC-01..GC-05), deterministic SHA-256 lineage hash chaining, BFCL evaluation, and Prometheus observability sidecars.

---


## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  WhichLLMAdapter                         │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │ Governance  │  │ LineageContract  │  │ Observer   │  │
│  │ Wrapper     │  │ (hash chain)     │  │ (metrics)  │  │
│  │ GC-01..05   │  │ SHA-256 chained  │  │ Prometheus │  │
│  └──────┬──────┘  └───────┬──────────┘  └────────────┘  │
│         │ preCheck()      │ stamp()                       │
│         ▼                 ▼                               │
│    WHICHLLM API ◄── fetch() [canonical JSON payload]      │
│         │                 │                               │
│         ▼                 ▼                               │
│    GovernanceAttestation + lineageHash → WhichLLMResult  │
└──────────────────────────────────────────────────────────┘
         │
         ▼
  HarvesterRegistry (singleton Map, append-only)
```

## Artifact Inventory

| Artifact | Path | Purpose |
|---|---|---|
| Deterministic Adapter | `src/adapter/whichllm-adapter.js` | Core ESM adapter; all IDs SHA-256 derived |
| OpenRouter Provider | `src/adapter/openrouter-provider.js` | Cloud provider adapter with rate card registry & retries |
| Ingestion Schema | `schemas/whichllm-ingestion-schema.json` | JSON Schema Draft 2020-12 extension |
| Governance Wrapper | `src/governance/governance-wrapper.js` | 5-check CIC governance gate (GC-01..05) |
| Lineage Contract | `src/lineage/lineage-contract.js` | Append-only SHA-256 hash chain |
| Harvester Registry | `src/harvester/harvester-registry.js` | Singleton registry with lifecycle API |
| Observability Node | `src/observability/adapter-observer.js` | Spans + Prometheus metrics + HTTP server |
| Unit Tests | `tests/unit/*.test.js` | 75+ assertions covering all modules |
| Integration Tests | `tests/integration/*.test.js` | Cross-module contract validation |
| E2E Tests | `tests/e2e/full-pipeline.test.js` | 7 full-pipeline scenarios |

---

## Requirements

- **Node.js ≥ 20.0.0** (ESM, built-in test runner, `fetch` global)
- **Zero runtime dependencies** — pure Node built-ins only

---

## Quick Start

```js
import { WhichLLMAdapter } from '@cic/whichllm-integration-pack';

const adapter = new WhichLLMAdapter({
  apiEndpoint: 'https://api.whichllm.io',
  apiKey: process.env.WHICHLLM_API_KEY,
  harvesterId: 'cic-whichllm-default-v1',
  tenantId: 'my-tenant',
  strictMode: true,
});

const result = await adapter.query({
  queryId: 'qry-stable-001',       // deterministic, caller-supplied
  prompt: 'Summarise the CIC spec.',
  modelHints: ['gpt-4o'],
  meta: { environment: 'production' },
});

console.log(result.lineageHash);      // SHA-256 chain hash
console.log(result.governance.status); // 'passed'
```

---

## Running Tests

```bash
# Full suite
node --test tests/unit/*.test.js tests/integration/*.test.js tests/e2e/*.test.js

# With coverage
node --test --experimental-test-coverage tests/**/*.test.js

# npm shortcuts
npm test             # full suite
npm run test:unit
npm run test:integration
npm run test:e2e
```

---

## Governance Checks (§2/S3-A1)

| Check ID | Name | Pre/Post | Description |
|---|---|---|---|
| GC-01 | Harvester Registration Integrity | Pre | Validates `harvesterId` is in registry with `status: 'active'` and amendment binding |
| GC-02 | Payload Schema Compliance | Pre | Validates required query fields and type constraints |
| GC-03 | Prompt Policy Gate | Pre | Enforces max prompt size (128 KiB) and prohibited-pattern filter |
| GC-04 | Model Allowlist Enforcement | Post | Confirms selected model is on the `MODEL_ALLOWLIST` |
| GC-05 | Attestation Completeness | Post | Ensures all required attestation context fields are present |

In `strictMode: true` (default), any `fail` result throws a `GovernanceViolationError` immediately.

---

## Lineage Contract

The lineage chain implements the §2/S3-A1 §4.2 chaining spec:

```
entry_n.hash = SHA-256( entry_(n-1).hash ‖ canonical_json(entry_n.payload) )
```

- **Genesis hash** is deterministic: `SHA-256("CIC:GENESIS:v2.4.0:§2/S3-A1")`
- **Canonical JSON**: keys sorted recursively, no whitespace
- **Replay**: chain can be fully verified from genesis seed + payloads alone
- **Snapshot/restore**: persist with `adapter.getLineageSnapshot()`, restore via `new LineageContract({ seedChain })` — tampered chains throw on construction

---

## Observability

Start the HTTP server sidecar:

```bash
CIC_HARVESTER_ID=my-harvester CIC_OBSERVER_PORT=9090 node scripts/start-observer.js
```

| Endpoint | Format | Use |
|---|---|---|
| `GET /metrics` | Prometheus text | Prometheus scrape target |
| `GET /dashboard` | JSON | Grafana / custom UI |
| `GET /health` | JSON | Load balancer health probe |

Key metrics emitted (all namespaced `cic_whichllm_`):

- `queries_total`, `queries_success_total`, `queries_error_total`
- `retries_total`
- `governance_pass_total`, `governance_fail_total`
- `query_latency_ms` (histogram: P50, P95, P99)
- `lineage_chain_length` (histogram)

---

## Harvester Registry

```js
import { registerHarvester, retireHarvester, activateHarvester, listHarvesters } from '@cic/whichllm-integration-pack/harvester';

// Register
registerHarvester({
  harvesterId: 'my-prod-harvester-v1',
  displayName: 'Production Harvester',
  apiEndpoint: 'https://api.whichllm.io',
  status: 'active',
  amendmentRefs: ['§2/S3-A1'],
  capabilities: ['query', 'batch', 'lineage'],
});

// Lifecycle
retireHarvester('my-prod-harvester-v1');   // status → 'retired' (never deleted)
activateHarvester('my-prod-harvester-v1'); // status → 'active'

// Query
listHarvesters({ status: 'active', amendmentRef: '§2/S3-A1' });
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WHICHLLM_API_KEY` | — | **Required.** WHICHLLM Bearer token |
| `WHICHLLM_API_ENDPOINT` | `https://api.whichllm.io` | API base URL |
| `CIC_HARVESTER_ID` | `cic-whichllm-default-v1` | Active harvester ID |
| `CIC_TENANT_ID` | `null` | CIC tenant scope |
| `CIC_STRICT_MODE` | `true` | Governance strict mode |
| `CIC_TIMEOUT_MS` | `30000` | Per-request timeout |
| `CIC_MAX_RETRIES` | `3` | Retry attempts |
| `CIC_OBSERVER_PORT` | `9090` | Observability HTTP port |

---

## Scripts

```bash
node scripts/health-check.js       # Verify all subsystems are ready
node scripts/start-observer.js     # Start Prometheus/dashboard HTTP server
node scripts/validate-schema.js    # Validate an ingestion record against JSON schema
```

---

## CIC Spec Compliance

| Requirement | Status |
|---|---|
| CIC Spec v2.4.0 | ✓ Implemented |
| Amendment §2/S3-A1 | ✓ Implemented |
| Deterministic IDs (SHA-256 derived) | ✓ |
| No `Math.random()` / `crypto.randomUUID()` in hot paths | ✓ |
| Canonical JSON serialisation (sorted keys) | ✓ |
| Append-only lineage hash chain | ✓ |
| All 5 governance checks (GC-01..GC-05) | ✓ |
| Harvester registry with lifecycle API | ✓ |
| JSON Schema Draft 2020-12 ingestion extension | ✓ |
| Zero runtime dependencies | ✓ |
| Node 20+ ESM | ✓ |

---

## License

UNLICENSED — Internal use only. CIC-GOVERNANCE project, Rewrite Labs.
