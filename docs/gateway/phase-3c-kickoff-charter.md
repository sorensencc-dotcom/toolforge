---
title: Phase 3.C Kickoff Charter — External Cowork API Integration
summary: Formal scope, prerequisites, acceptance criteria, and execution plan for Phase 3.C (real Cowork API binding)
created: 2026-07-10
updated: 2026-07-10
tags: cowork, gateway, phase-3, integration, external-dependency, charter
---

# Phase 3.C Kickoff Charter — Cowork Gateway External Integration

**Date:** 2026-07-10  
**Owner:** Rewrite Labs / CIC  
**Status:** WAITING (external dependency)  
**Trigger:** When Cowork provides endpoint spec + auth model + credentials

---

## 1. Overview

Phase 3.C binds the fully-built Toolforge Cowork Gateway (Phase 3.A scaffolding + Phase 3.B distributed sync pipeline) to the **real external Cowork API**, replacing the mock server with production endpoints.

**Phase 3 Status:**
- 3.A (Scaffolding): ✅ COMPLETE
- 3.B (Mock Integration + E2E Tests): ✅ COMPLETE  
- 3.C (Real Cowork Binding): 🔴 WAITING (external blocker)

**Entry Criteria:** All of the following must be provided by Cowork:
1. Endpoint specification (all 6 routes, request/response schemas, error envelopes)
2. Authentication model (API key format, headers, rotation rules, env separation)
3. Credentials (dev, staging, production)

Once received, Phase 3.C can begin immediately. No additional internal prep required.

---

## 2. Scope

### What Phase 3.C Does
- Replace mock Cowork server URLs with real endpoints
- Bind CoworkClient methods to real network calls
- Validate protocol compliance against Cowork staging
- Promote gateway to production

### What Phase 3.C Does NOT Do
- Change internal gateway architecture (already complete)
- Rewrite skill registry, manifest builder, or sync coordinator (already validated)
- Add new capabilities (Phase 3.A + 3.B already define full feature set)
- Refactor test suite (already passing against mock)

### Subsystems Affected
- **CoworkClient** (endpoints, auth headers)
- **gateway.json** (base URL, endpoints)
- **.env** (credentials, deployment URLs)
- **Test execution** (staging vs. production run targets)

All other subsystems remain unchanged.

---

## 3. Prerequisites (Blocking)

### 3.1 Cowork Endpoint Specification
Cowork must provide the authoritative API contract, including:

**For each of the 6 routes:**
- Exact path (e.g., `/v1/skills/register` vs. `/cowork/register`)
- HTTP method (POST, PATCH, GET)
- Request payload schema (JSON structure, required fields, types)
- Response payload schema (success case + error cases)
- Error codes and envelopes (e.g., 422 format, 5xx retryability)
- Rate limits (per-endpoint, per-gateway, burst allowances)
- Timeout expectations (p50, p95, p99)
- Any Cowork-specific metadata fields not in mock spec

**Reference:** Current mock implements 6 endpoints under `/v1/` prefix with Bearer auth. If Cowork uses different paths, headers, or response shapes, the spec must be explicit.

### 3.2 Authentication Model
Cowork must specify:

- **Key Format:** Alphanumeric + hyphens, length, encoding
- **Header Name:** `Authorization: Bearer <key>` vs. custom header
- **Signature Requirements:** HMAC, JWTs, or simple Bearer token
- **Key Rotation:** Expiry, refresh flow, grace periods
- **Environment Isolation:** Dev/staging/prod keys vs. single universal key
- **Rate Limit Headers:** Response headers for remaining quota

**Reference:** Current implementation uses `Authorization: Bearer <apiKey>`. If Cowork requires HMAC or custom headers, CoworkAuth.ts must be updated.

### 3.3 Credentials (Three Environments)

Cowork must provide:

| Environment | API Key | Base URL | Notes |
|---|---|---|---|
| **Dev** | `cowork-dev-key-...` | `https://api-dev.cowork.ai` | For local testing |
| **Staging** | `cowork-staging-key-...` | `https://api-staging.cowork.ai` | For pre-prod validation |
| **Production** | `cowork-prod-key-...` | `https://api.cowork.ai` | For live gateway |

All three are required. Gateway will be tested against staging before promotion to production.

---

## 4. Acceptance Criteria

Phase 3.C is **COMPLETE** when:

### 4.1 Protocol Compliance
- [ ] CoworkClient methods (`register`, `pushManifest`, `pullManifestHash`, `syncState`, `heartbeat`, `status`) all bind to real Cowork endpoints
- [ ] Request payloads match Cowork spec exactly (all required fields, no extra fields unless explicitly allowed)
- [ ] Response parsing matches Cowork spec (all response fields correctly extracted, typed, and returned)
- [ ] Error envelopes match Cowork spec (error codes recognized, retry logic respects 4xx vs. 5xx, timeouts handled)

### 4.2 Authentication
- [ ] CoworkAuth correctly formats auth headers per Cowork spec
- [ ] API keys validate per Cowork's format requirements
- [ ] All three environments (dev/staging/prod) authenticate successfully
- [ ] Key rotation (if applicable) is documented and tested

### 4.3 End-to-End Workflows
Run full integration test suite against Cowork **staging**:

- [ ] Register all 22 skills → Cowork accepts, returns plugin IDs
- [ ] Push full manifest → Cowork persists, returns manifest ID
- [ ] Pull manifest hash → Cowork returns current hash, matches locally computed hash
- [ ] Sync state → Cowork accepts state updates, acks correctly
- [ ] Send heartbeat → Cowork acknowledges, updates last-seen timestamp
- [ ] Check status → Cowork returns online status, skill counts match registry

**Acceptance:** All 6 workflows execute end-to-end with 100% success against staging.

### 4.4 Error Handling
- [ ] 4xx errors (400, 422, 401, 403) fail immediately without retry
- [ ] 5xx errors (500, 503) retry with exponential backoff (100ms, 300ms, 1000ms)
- [ ] 429 (rate limit) retries with backoff
- [ ] Timeouts (>30s) fail gracefully, log error, do not hang
- [ ] All error cases produce clear logs and actionable error messages

### 4.5 Performance (Staging)
- [ ] p50 latency per endpoint: <500ms
- [ ] p95 latency per endpoint: <2s
- [ ] p99 latency per endpoint: <5s
- [ ] No hanging requests or resource leaks

### 4.6 Documentation
- [ ] Cowork API endpoint spec linked from gateway README
- [ ] Updated .env template with real Cowork URLs and key format
- [ ] Deployment runbook (dev → staging → prod progression) documented
- [ ] Any Cowork-specific quirks or gotchas noted in README

### 4.7 Tier-1 Sign-Off
- [ ] Staging integration passes all workflows
- [ ] Production credentials validated against real Cowork
- [ ] Tier 1 approves promotion to production
- [ ] Ready for live skill registration

---

## 5. Execution Plan

Once all prerequisites are met, execute in order:

### Phase 3.C.1: Update CoworkClient
**Owner:** Engineer  
**Duration:** 2–4 hours  

1. Read Cowork API spec
2. Update CoworkClient.ts endpoint paths to match spec
3. Update request/response types per spec
4. Update error parsing per spec error envelopes
5. Update CoworkAuth.ts if auth model differs from current Bearer token
6. Verify TypeScript compilation

**Deliverable:** CoworkClient.ts + CoworkAuth.ts compiled and type-checked

---

### Phase 3.C.2: Update gateway.json
**Owner:** Engineer  
**Duration:** 30 minutes  

1. Update `endpoints` block with real Cowork paths
2. Update base URL (if needed)
3. Update `apiVersion` if Cowork requires it
4. Validate against gateway.json schema

**Deliverable:** gateway.json with real Cowork endpoints

---

### Phase 3.C.3: Test Against Cowork Staging
**Owner:** Engineer  
**Duration:** 4–8 hours  

1. Obtain staging credentials from Cowork
2. Update `.env.staging` with Cowork staging URLs + keys
3. Start gateway pointing at staging
4. Run full integration test suite against staging (all 6 workflows)
5. Validate latencies, error handling, retry behavior
6. Log results in test-run report

**Deliverable:** Staging test-run report (all 6 workflows PASS)

---

### Phase 3.C.4: Promote to Production
**Owner:** Engineer + Tier 1 Approval  
**Duration:** 1 hour (execution) + approval time  

1. Obtain production credentials from Cowork
2. Update `.env.production` with Cowork production URLs + keys
3. Update gateway deployment to point at production
4. Run smoke test (single skill register, status check)
5. Monitor first 24h for errors
6. If clean: Phase 3 COMPLETE

**Deliverable:** Gateway live on real Cowork API

---

## 6. Success Metrics

Phase 3.C succeeds when:

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Staging E2E success rate** | 100% | All 6 workflows pass in test run |
| **Staging p95 latency** | <2s | From test-run logs |
| **Production uptime (first 24h)** | >99.5% | Monitor logs, no critical errors |
| **Skill registration rate** | 100% of 22 skills | All 22 skills register within 5 min of gateway start |
| **Manifest propagation** | <5s | Hash sync time from push to Cowork confirmation |
| **Heartbeat cadence** | ≤60s stale | Last heartbeat timestamp within 60s |

All metrics must be satisfied to consider Phase 3 COMPLETE.

---

## 7. Rollback Plan

If staging or production fails:

1. **Staging failure:** Revert CoworkClient to mock-compatible implementation, re-run against mock to confirm no regression. Debug Cowork API mismatch with API provider.
2. **Production failure:** Kill real Cowork endpoints in gateway deployment, revert to mock. Notify Tier 1. Investigate before retry.

Rollback is a single-command revert of CoworkClient endpoints back to mock URLs. No data loss (state lives in PostgreSQL, not Cowork).

---

## 8. Blockers & Risks

### Identified Blockers
- **External API spec not finalized:** If Cowork provides incomplete or changing spec, Phase 3.C will stall. Mitigation: Request spec freeze + versioning from Cowork before beginning.
- **Auth model mismatch:** If Cowork requires HMAC or JWT but spec was ambiguous, CoworkAuth.ts will need rework. Mitigation: Request auth spec with working examples.
- **Rate limits too strict:** If Cowork enforces rate limits preventing bulk skill registration, retry strategy will need tuning. Mitigation: Request rate limit allowance details in spec.

### Known Risks
- **Schema drift:** Cowork API may evolve post-spec. Mitigation: Version all payloads, add schema validation layer.
- **Credential rotation:** If Cowork rotates keys without notice, gateway will fail. Mitigation: Request rotation schedule + grace period in advance.
- **Network latency:** If Cowork API is geographically distant, timeouts may occur. Mitigation: Request latency SLAs, tune timeout settings if needed.

---

## 9. Entry Checklist (When Cowork Provides Spec)

When Cowork delivers the API spec + auth model + credentials, verify:

- [ ] Specification is in written form (PDF, markdown, or API docs)
- [ ] Specification includes all 6 endpoint definitions (paths, methods, schemas, errors)
- [ ] Authentication model is explicitly defined (header name, key format, rotation rules)
- [ ] Three sets of credentials are provided (dev, staging, production)
- [ ] Cowork confirms staging environment is live and accessible
- [ ] Cowork confirms API is in beta/stable (not development-only)

Once all checkboxes pass, Phase 3.C can **begin immediately** with no additional prep.

---

## 10. Next Steps

**Now (2026-07-10):**
- Phase 3.A + 3.B complete and shipped
- Phase 3.C charter locked
- Awaiting Cowork endpoint spec + credentials

**When spec arrives:**
1. Tier 1 reviews spec + charter
2. Engineer executes Phase 3.C.1–4 (Cowork binding)
3. Staging validation → production promotion
4. Phase 3 COMPLETE

**Estimated duration (from spec → production):** 1–2 days (execution only; excludes Tier 1 review/approval gates)

---

## 11. Related Docs

- [Phase 3 Scope Charter](phase-3-scope-charter.md)
- [Cowork Mock API (Internal)](cowork-mock-api.md)
- [Cowork Gateway README](../../toolforge/gateway/cowork/README.md)
- [CIC + Rewrite Labs Governance](../governance/governance.md)

---

**Status:** WAITING  
**Unblock:** Cowork provides endpoint spec + auth model + credentials  
**Target completion:** 2026-07-12 (est., after spec delivery)
