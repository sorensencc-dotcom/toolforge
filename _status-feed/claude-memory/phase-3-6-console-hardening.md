---
name: phase-3-6-console-hardening
description: Phase 3.6 console accessibility hardening; cross-component focus order, keyboard workflows, live regions
metadata:
  type: project
---

# Phase 3.6: Operator Console Accessibility Hardening (2026-06-23)

**Status:** SPEC LOCKED  
**Dependencies:** Phase 3.5 Complete ✅  
**Estimate:** 3–5 days  
**Components:** Operator Console v3, Ingestion Dashboard  

---

## Objective

Ship Operator Console with WCAG AA compliance verified across **composite workflows** (not just primitives). Phase 3.5 certified individual components; Phase 3.6 certifies their integration in real operator dashboards.

---

## Scope (3 Streams)

### **A. Focus Order Validation (1 day)**

**Why:** Dashboard grids (Tier 1 Health Panel + Tier 2 Agents Panel) can trap focus or skip interactive elements if composite focus order is wrong.

| Task | Acceptance |
|---|---|
| Tab order audit (Health → Agents → Controls → Alerts) | Keyboard-only navigation hits all interactive elements in logical order |
| Trap-escape handlers (focusin/focusout) | Focus doesn't trap in modals/popovers; Escape returns to trigger |
| Focus restoration after async updates | Polling updates (5s Health, 10s Pipelines) don't steal focus from user |
| Test coverage | Keyboard nav + focus-order tests for each panel composition |

**Success:** Console navigable via Tab+Shift+Tab only; all controls reachable.

---

### **B. Keyboard-Only Workflows (1.5 days)**

**Why:** Live dashboards require power-user keyboard shortcuts (no mouse). WCAG AA requires full keyboard access; operator workflows require parity.

| Workflow | Keyboard Binding | Expected Behavior |
|---|---|---|
| Health refresh | Ctrl+R | POST /api/health (same as UI button) |
| Pipeline pause/restart | P + number | Pause/restart pipeline {N} |
| Alert acknowledge | A | Acknowledge focused alert (aria-current) |
| Focus to search | / | Focus search input, autoClear |
| Next/prev panel | [ \| ] | Tab-order focus to adjacent panel |

**Success:** All user workflows completable without mouse. Documented in OPERATOR_KB.md.

---

### **C. Live Regions + Async Events (1.5 days)**

**Why:** Operator dashboards poll for updates (Health 10s, Pipelines 5s, Alerts 3s). Screen reader users must be notified of changes without losing focus or breaking keyboard flow.

| Event | Live Region | Announcement |
|---|---|---|
| Pipeline state change (Idle → Running) | status | "Pipeline {name} now running, {task} in progress" |
| Health check recovered | status | "Health check passed, {count} services operational" |
| Alert severity escalation | alert | "CRITICAL: {service} unresponsive, {duration}s down" |
| Agent task completion | log | "{agent} completed {action}, {result}" |

**Acceptance:**
- `role="status"` + `aria-live="polite"` for state changes  
- `role="alert"` + `aria-live="assertive"` for critical alerts  
- Announcements don't interfere with keyboard navigation  
- NVDA + JAWS test pass

**Success:** Screen reader users notified of all CIC state changes without loss of focus.

---

### **D. External Audit Reconciliation (1 day)**

**Why:** Phase 3.5 noted "ingestion dashboard, test page findings tracked separately." These must be resolved before Operator Console v3 ships.

| Finding | Scope | Fix | Verify |
|---|---|---|---|
| Ingestion dashboard contrast | Form labels + table cells | Apply cic-component-tokens.css + component fixes | WCAG AA pass (axe) |
| Test page semantics | Navigation + code samples | Add aria-label + heading hierarchy | Manual review |
| Theme token drifts | dark/light toggle | Reconcile cic-component-tokens.css + storybook | Snapshot test |

**Success:** Zero AA_FAILs + zero BLOCKERs on full console + dashboard.

---

## Deliverables

| File | Description |
|---|---|
| `src/ui/console-v3/focus-order.test.ts` | Tab order validation for all panels |
| `src/ui/console-v3/keyboard-shortcuts.ts` | Ctrl+R, P+N, A, /, [ ] bindings + test |
| `src/ui/console-v3/live-regions.tsx` | StatusLive, AlertLive, LogLive regions + ARIA wiring |
| `docs/OPERATOR_KB.md` | Keyboard workflow reference for ops team |
| `docs/ACCESSIBILITY.md` | Phase 3.5 + 3.6 audit results + external findings reconciled |
| Tests | +18 tests (focus order, keyboard, live regions, async updates) |

---

## Success Gate

| Metric | Target | Current |
|---|---|---|
| Console tests passing | ≥95% | TBD |
| WCAG AA (axe) | 0 violations | TBD |
| Keyboard-only workflows | 5/5 complete | TBD |
| Focus trap regressions | 0 | TBD |
| Screen reader test (NVDA/JAWS) | Pass | TBD |

**Ship gate:** All metrics green + zero AA_FAILs + external audit findings resolved.

---

## Downstream Impact

**Operator Console v3 Ship-Ready:** Locked for Docker integration, ops team deployment  
**CIC Library Frozen:** v1.0.0 tag, no breaking changes pending  
**Next Phase:** CIC subsystem integration (Phase 4)
