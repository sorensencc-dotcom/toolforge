---
title: Toolforge Phase 2b Charter — Dashboard v2, Execution History & Release Automation
date: 2026-07-11
status: TIER1_APPROVAL_PENDING
decision: APPROVED_FOR_EXECUTION
critical_path: true
deadline: 2026-08-01
---

# Toolforge Phase 2b Charter — Dashboard v2, Execution History & Release Automation

## Executive Summary

Phase 2b completes Toolforge operationalization by implementing execution history tracking, error collection, release automation, and runtime status badges. This is the foundation for CIC Phase 3 integration and operator-grade tool observability. Phase 2a (documentation + governance) locked 2026-06-28; Phase 2b executes the operational infrastructure required for production readiness.

---

## Phase 2a Recap (Complete ✅)

Phase 2a established governance and operator documentation:
- **Directory structure locked** (7 categories) ✅
- **Tool discovery + auto-registration** (manifest.json system) ✅
- **OPERATOR_GUIDE.md + TOOL_CREATION_GUIDE.md** (complete) ✅
- **Governance framework documented** (GOVERNANCE.md) ✅
- **Skill inventory dashboard v1** (5 tools, 22 skills registered) ✅
- **v1.1.0 shipped** (2026-06-28) ✅

---

## Phase 2b Scope

### 2b.1 Execution History + Run Tracking (Root Dependency)

**Objective:** Capture and persist all tool invocations with complete telemetry.

**Subsystem Components:**

| Component | Purpose | Deliverable |
|-----------|---------|-------------|
| run-store.db | SQLite execution log (authoritative store) | Schema + initialization script |
| Telemetry hook (run-tool.ps1) | Emit telemetry on start/finish/error | Modified wrapper |
| Telemetry adapter | REST API for dashboard consumption | `/api/toolforge/runs` endpoint |
| Dashboard v2 History Panel | Visualize execution timeline | HTML tab + JS |

**Data Schema:**
```sql
runs(
  invocation_id UUID PRIMARY KEY,
  tool TEXT NOT NULL,
  timestamp ISO8601 NOT NULL,
  duration_ms INTEGER,
  status TEXT (success|fail),
  error_code TEXT,
  error_message TEXT,
  version TEXT (semver),
  INDEX (tool, timestamp),
  INDEX (status, timestamp)
)
```

**Success Criteria:**
- [ ] run-store.db created + initialized
- [ ] run-tool.ps1 generates invocation_id + writes telemetry
- [ ] `/api/toolforge/runs` returns last 100 runs (queryable)
- [ ] Dashboard v2 "Execution History" tab displays runs with filters
- [ ] Telemetry data persists across daemon restarts

### 2b.2 Error Collection + Alerts (Stability Layer)

**Objective:** Structured error logging + threshold-based alerting.

**Subsystem Components:**

| Component | Purpose | Deliverable |
|-----------|---------|-------------|
| Structured error logs | JSON error records (not unstructured .log files) | New error log table |
| Error taxonomy | Classification (E_RUNTIME, E_VALIDATION, E_TIMEOUT, etc.) | Error codes enum |
| Alert thresholds | Fire alerts when error rates spike | Thresholds config |
| Dashboard v2 Error Panel | View errors + stack traces | HTML tab + JS |

**Error Taxonomy:**
- **E_VALIDATION** — Input validation failure
- **E_RUNTIME** — Runtime execution error
- **E_DEPENDENCY** — Dependency not found / unavailable
- **E_ENVIRONMENT** — Environment configuration error
- **E_TIMEOUT** — Execution exceeded time limit

**Alert Thresholds:**
- E_RUNTIME spike > 10 in 10 minutes → ALERT
- fail_rate_1h > 15% → ALERT
- duration_p99 > 2× baseline → ALERT

**Success Criteria:**
- [ ] Structured error logs written to run-store.db
- [ ] Error taxonomy classified + enforced
- [ ] Alert thresholds configured
- [ ] Dashboard v2 "Errors" tab displays timeline + taxonomy
- [ ] Error rate trends calculated (24h, 7d)

### 2b.3 Release Automation + Status Badges (Distribution)

**Objective:** Automate semver, CI publish, and runtime status badges.

**Subsystem Components:**

| Component | Purpose | Deliverable |
|-----------|---------|-------------|
| Semver automation | Auto-increment version (patch/minor/major) | Version bump logic |
| CI publish pipeline | Build → test → tag → publish → badge update | GitHub Actions workflow |
| Release notes generator | Auto-generate CHANGELOG from commit log | Script + template |
| Status badges | Runtime health + metrics (not manifest-only) | Badge endpoints |

**Semver Rules:**
- Patch bump (v1.1.0 → v1.1.1): any code change
- Minor bump (v1.1.0 → v1.2.0): new tool or feature
- Major bump (v1.1.0 → v2.0.0): breaking change

**Badge Endpoints:**
- `/api/toolforge/badge/health/{tool}` → ONLINE/DEGRADED/DOWN
- `/api/toolforge/badge/version/{tool}` → semver
- `/api/toolforge/badge/latency/{tool}` → p95 ms
- `/api/toolforge/badge/errors/{tool}` → 24h count

**Success Criteria:**
- [ ] VERSION.md auto-incremented by CI
- [ ] Release notes generated from commits
- [ ] GitHub Actions workflow publishes release
- [ ] Status badges reflect runtime health (from run-store.db)
- [ ] Dashboard v2 integrates badge data

### 2b.4 Dashboard v2 Multi-Tab Interface

**Layout:**
- **Tab 1: Skills** (existing v1 — skill inventory)
- **Tab 2: Execution History** (new — run timeline + filters)
- **Tab 3: Errors** (new — error taxonomy + trends)
- **Tab 4: Release Pipeline** (new — semver + publish status)
- **Tab 5: Badges** (new — runtime health + metrics)

**Success Criteria:**
- [ ] All 5 tabs functional
- [ ] Tabs fetch from `/api/toolforge/*` endpoints
- [ ] Filters work (tool, time range, status)
- [ ] Real-time updates on refresh
- [ ] WCAG AA accessible

---

## Execution Model

### Parallelism Matrix

| Wave | Component | Dependencies | Parallelism | Effort |
|------|-----------|--------------|-------------|--------|
| W1 | run-store.db schema + initialization | None | 1x | 1 day |
| W1 | run-tool.ps1 telemetry hook | None | 1x | 1 day |
| W2 | `/api/toolforge` Node backend (REST) | W1 | 1x | 1.5 days |
| W2 | Dashboard v2 HTML tabs (scaffold) | W1 | 1x | 1 day |
| W3 | Dashboard History panel (consume API) | W2 | 1x | 1 day |
| W3 | Error taxonomy + logging | W1 | 1x | 1 day |
| W4 | Alert thresholds + Dashboard Errors tab | W3 | 1x | 1 day |
| W5 | Semver automation + CI pipeline | W2 | 1x | 1.5 days |
| W5 | Release notes generator | W5 | 1x | 0.5 days |
| W6 | Status badges (endpoints + dashboard) | W2, W3, W5 | 1x | 1 day |

**Critical Path:** W1 → W2 → W3 → W4 → W5 → W6  
**Total Estimated Effort:** 10 days  
**Deadline:** 2026-08-01 (21 days available)

### Step-by-Step Execution Order

**Step 1: Build Execution History (W1–W3)**
1. Create run-store.db schema
2. Modify run-tool.ps1 to emit telemetry
3. Build `/api/toolforge/runs` endpoint
4. Add "Execution History" tab to dashboard.html
5. Verify: run a tool, see telemetry in dashboard

**Step 2: Build Error Subsystem (W3–W4)**
1. Create error log table in run-store.db
2. Implement error taxonomy classification
3. Configure alert thresholds
4. Add "Errors" tab to dashboard.html
5. Verify: trigger an error, see it in dashboard

**Step 3: Build Release Automation (W5)**
1. Implement semver bump logic
2. Create GitHub Actions workflow (build → test → tag → publish)
3. Implement release notes generator
4. Create VERSION.md as CI output
5. Verify: commit code, watch CI auto-bump version

**Step 4: Build Status Badges (W6)**
1. Implement badge endpoints (health, version, latency, errors)
2. Modify dashboard.html to consume badges
3. Wire badges to runtime data (from run-store.db)
4. Add "Badges" tab to dashboard.html
5. Verify: open dashboard, see live health status

---

## Dependencies

**CIC Integration (Phase 3):**
- Phase 2b execution history enables CIC Phase 3 drift detection
- Error taxonomy supports governance audit trails
- Status badges required for Phase 6 canary monitoring

**Toolforge Internal:**
- run-store.db is authoritative for all Phase 2b subsystems
- Telemetry hook in run-tool.ps1 feeds all downstream consumers

---

## Success Criteria (Exit Gate)

Phase 2b is complete when:

- [ ] run-store.db operational (sqlite, schema locked, writes verified)
- [ ] run-tool.ps1 emits telemetry on all invocations
- [ ] `/api/toolforge/runs`, `/api/toolforge/errors`, `/api/toolforge/badge/*` endpoints respond
- [ ] Dashboard v2 displays all 5 tabs (Skills, History, Errors, Release, Badges)
- [ ] Execution History tab shows last 100 runs with filters
- [ ] Errors tab shows error taxonomy + trends
- [ ] Release Pipeline tab shows version + publish status
- [ ] Status badges reflect runtime health (not manifest-only)
- [ ] All telemetry persists across daemon restarts
- [ ] Zero data loss on error conditions
- [ ] WCAG AA accessibility verified

**Test Gate:**
- [ ] 20+ E2E tests PASS (run tool → verify telemetry → check dashboard)
- [ ] Error scenarios tested (tool failure, timeout, missing dependency)
- [ ] Dashboard filters work (time range, status, tool)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| run-store.db write contention | Lost telemetry if concurrent writes | Use SQLite WAL mode + atomic transactions |
| Telemetry hook slows run-tool.ps1 | Tool invocation latency increase | Async writes, batch to reduce I/O |
| API backend unavailable | Dashboard cannot load data | Fallback to JSON export, local file read |
| Version bump collision (multiple releases in flight) | Conflicting semver bumps | Lock file + sequential CI queue |
| Badge endpoints overloaded | Dashboard lag | Cache badge data (5min TTL) |

---

## Approval & Governance

### Tier 1 Sign-Off Required

**Question:** Should Phase 2b proceed with execution?

**Options:**
1. **APPROVED** — Execute Phase 2b as chartered (10 days, 2026-08-01)
2. **CONDITIONAL** — Approve with modifications (specify)
3. **DEFER** — Defer to Phase 3 (not recommended — blocks CIC integration)

### Timeline

| Milestone | Date | Status |
|-----------|------|--------|
| Phase 2b charter created | 2026-07-11 | ✅ This turn |
| Tier 1 approval | 2026-07-11 | ⏳ Pending |
| Implementation plan detailed | 2026-07-11 | ⏳ Next |
| Step 1 (W1–W3) complete | 2026-07-15 | 📅 Planned |
| Step 2 (W3–W4) complete | 2026-07-18 | 📅 Planned |
| Step 3 (W5) complete | 2026-07-22 | 📅 Planned |
| Step 4 (W6) complete + exit gate | 2026-08-01 | 📅 Planned |
| Phase 3 entry ready | 2026-08-02 | 📅 Planned |

---

## Decision Log

- **2026-07-11:** Phase 2b charter created. Tier 1 approval pending.

---

**Charter Status:** ⏳ AWAITING_TIER1_APPROVAL

**Next Step:** Tier 1 approves → Detailed Phase 2b implementation plan (B) created
