---
name: phase-c-ship-readiness-decision
description: Phase C ship-readiness + Phase D fallback state machine deferred scope clarification
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b9e4418-e9b7-4f47-8b0a-fa70e19169d1
---

## Clarification: FallbackChain Status (Correction 2026-07-03)

**Previous claim:** "Commit 0ddb285 + 2da77ed yanked FallbackChain"  
**Finding:** False. Investigation (2026-07-03 session):
- Commit 0ddb285 does not exist in git history
- Commit 2da77ed (Thu Jul 2 12:34:24) touched only resilientMetricsCollector.ts (typo) + retry.ts (unused retryableErrorCodes), zero changes to fallbackChain.ts
- FallbackChain.ts still exists today (146 lines, fully intact) with only one commit in history (e202bc8, creation in Phase B)
- GrokHardenedAdapter.ts still exists in cic-ingestion/ with doc comment: "Fallback providers deferred to Phase D"

**Actual situation:** FallbackChain shipped in Phase B, complete + intact. Phase C deferred the wiring + per-provider state machine (which is what Phase D is now implementing).

---

## Phase C Ship-Readiness (Actual)

**Date:** 2026-07-02  
**Status:** ✅ LOCKED

**Deliverables (all done):**
- Phase A: RagCache (caching + batching)
- Phase B: HardeningOrchestrator (CB + RL + timeout + retry) + FallbackChain (ordered-provider fallback)
- Phase C: ResilientMetricsCollector (observability + Prometheus export)

**What Phase C locked:**
- GrokHardenedAdapter with Circuit Breaker + Rate Limiter + Timeout + Retry
- FallbackChain instantiated but **not wired** into execute() path (dead code)
- Metrics collection + Prometheus export live for CB/RL/timeout/retry (fallback metrics dropped)

**Scope decision:** Defer FallbackChain wiring to Phase D (not a removal, a deferral)

---

## Phase D: Fallback State Machine (2026-07-03 Implementation)

### Scope
1. **Wire fallback into HardeningOrchestrator.execute()**: wrap circuitBreaker.execute() in try-catch, invoke fallback on failure
2. **Add per-provider health state machine**: CLOSED/OPEN/HALF_OPEN per provider (not just ordered-try-all)
3. **Surface fallback metrics**: populate ProviderMetrics.fallback + add 2 Prometheus metric families
4. **Comprehensive tests**: state transitions + orchestrator wiring + metrics assertions

### What NOT in scope
- New provider adapters (OpenRouter/Ollama don't exist yet)
- SLA rules / Grafana dashboard updates (no providers registered in production yet)
- MAAL routing integration (future phase)

### Per-provider state machine design
- **CLOSED** (default): eligible, tried normally
- **CLOSED → OPEN**: after `providerFailureThreshold` consecutive failures (default 3)
- **OPEN**: skipped during execute(). Timer (providerResetTimeoutMs default 30000ms) flips to HALF_OPEN
- **HALF_OPEN**: eligible for one trial. Success → CLOSED. Failure → OPEN (restart cooldown)
- **Selection logic**: prefer state !== "OPEN" providers; if all OPEN, fallthrough to full list (last resort)

### Files changed
- `src/resilience/fallbackChain.ts`: FallbackProviderState type, per-provider state map, state machine logic, hasProviders(), updated getMetrics()
- `src/resilience/hardeningOrchestrator.ts`: execute() wrapped with try-catch fallback invocation
- `src/observability/resilientMetricsCollector.ts`: ProviderMetrics.fallback field, getSnapshot() population, 2 Prometheus metric families
- `src/tests/hardening-phase-b.test.ts`: +8 state-transition tests, +3 orchestrator wiring tests
- `src/tests/phase-c-integration.test.ts`: +3 fallback metrics assertions, +2 Prometheus export tests

---

## Ship-Readiness: Phase C (Locked)

- ✅ Deterministic (no fallback branching)
- ✅ Validated (25 hardening tests + 15 integration tests PASS)
- ✅ Observable (ResilientMetricsCollector for CB/RL/timeout/retry)
- ✅ Clean execution (fallback dead code isolated, not triggered)
- ✅ Ready for staging + Week 2 canary

---

## Phase D: Ready to ship (2026-07-03)

- ✅ Per-provider state machine + orchestrator wiring (implemented)
- ✅ Fallback metrics surfacing (implemented)
- ✅ Comprehensive tests (implemented: 11 new tests + 5 Prometheus checks)
- ✅ Backward compatible (zero fallback providers = zero behavior change)
- ✅ Production-safe (no providers registered until future wave adds alternates)
