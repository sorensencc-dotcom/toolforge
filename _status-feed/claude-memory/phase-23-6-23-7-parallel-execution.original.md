---
name: phase-23-6-23-7-parallel-execution
description: Parallel execution plan for Phase 23.6 (Memory Explorer UI) and 23.7 (Memory-Driven Autonomy); coordinated via MLA/CKG schema; independent tracks with explicit sync points
metadata: 
  node_type: memory
  type: project
  originSessionId: d5df32a8-d2ad-4224-a1ad-ba12e0d3976b
---

# Phase 23.6–23.7 Parallel Execution Plan

**Execution Model:** Two independent tracks (UI + Autonomy Logic) coordinated via shared MLA/CKG events and queries.

**Timeline:** Parallel execution, start both immediately, coordinate at MLA/CKG sync points.

**Current Date:** 2026-06-08

---

## Track A: Phase 23.6 — Memory Explorer UI

**Goal:** Timeline view of CIC events with drift overlays, health indicators, and correlation-id tracing.

### 23.6.1 — UI Architecture & Data Model

**Deliverables:**
- Component tree (React/Vue)
- Data model for timeline events
- API contract (what queries UI needs from MemoryQueryAPI)
- Drift overlay specifications

**Scope:**
```
src/ui/
  /explorer/
    ExplorerLayout.tsx          # Main timeline view
    TimelineView.tsx            # Event timeline
    DriftOverlay.tsx            # Drift visualization
    HealthIndicators.tsx        # Health metrics panel
    CorrelationTracer.tsx       # Trace reconstruction
    EventCard.tsx               # Individual event display
    FilterPanel.tsx             # Timeline filters
    
  /queries/
    ExplorerQueries.ts          # API calls to MemoryQueryAPI
    EventSubscription.ts        # Real-time event polling
    
  /models/
    TimelineEvent.ts            # Event type definitions
    DriftMetrics.ts             # Drift calculation types
    HealthMetrics.ts            # Health indicator types
```

**API Contract (from MemoryQueryAPI):**
```typescript
// Timeline query
GET /memory/events?type=ARPS_DELTA,PIPELINE_RUN,GOVERNANCE_SIGNAL
    &startDate=2026-06-01&endDate=2026-06-08
    &limit=1000
    → TimelineEvent[]

// Drift query
GET /memory/summaries?window=weekly&metric=drift
    → DriftSummary[]

// Health query
GET /memory/summaries?window=hourly&metric=health
    → HealthMetric[]

// Correlation trace
GET /memory/events?correlationId=abc123
    → TimelineEvent[]
```

**Acceptance Criteria:**
- [ ] Component tree renders without errors
- [ ] UI loads 1000+ events without lag
- [ ] Drift overlays calculate in <500ms
- [ ] Correlation traces reconstruct in <200ms
- [ ] Responsive on desktop (1920x1080) and tablet (768x1024)

---

### 23.6.2 — Timeline View Implementation

**Deliverables:**
- Event rendering (ARPS, PIPELINE_RUN, GOVERNANCE_SIGNAL, APR_PLAN, CRO_RUN)
- Time-based grouping and sorting
- Event detail panels
- Navigation (zoom, pan, date range select)

**Scope:**
```typescript
// Timeline event display
type TimelineEvent = {
  timestamp: ISO8601,
  type: EventType,                // ARPS_DELTA | PIPELINE_RUN | ...
  correlationId: string,
  sessionId: string,
  summary: string,
  severity: 'info' | 'warning' | 'error',
  metadata: Record<string, any>,
  relatedEvents?: string[]        // correlation IDs
}

// Grouping strategy
GROUP BY hour (for dense timelines)
GROUP BY day (for weekly views)
GROUP BY week (for monthly views)
```

**Acceptance Criteria:**
- [ ] Events display in chronological order
- [ ] Event cards are clickable → detail panel
- [ ] Time navigation (previous/next, jump to date)
- [ ] Zoom in/out maintains detail level
- [ ] Color coding by event type

---

### 23.6.3 — Drift Overlay & Health Indicators

**Deliverables:**
- Drift score calculation display
- Health metric panels (uptime, success rate, latency)
- Anomaly highlighting
- Trend indicators

**Scope:**
```typescript
// Drift overlay on timeline
type DriftOverlay = {
  timestamp: ISO8601,
  driftScore: number,             // 0.0–1.0
  signals: {
    semantic_drift: number,
    temporal_drift: number,
    narrative_drift: number,
    causal_drift: number
  },
  severity: 'normal' | 'warning' | 'critical'
}

// Health metrics
type HealthMetric = {
  window: '1h' | '24h' | '7d',
  uptime: percentage,
  successRate: percentage,
  p50Latency: ms,
  p99Latency: ms,
  errorCount: number,
  eventCount: number
}
```

**Acceptance Criteria:**
- [ ] Drift scores displayed on timeline
- [ ] Health panels refresh hourly
- [ ] Anomalies highlighted (drift > 0.7)
- [ ] Trends calculated (up/down/stable)
- [ ] Tooltips explain metrics

---

### 23.6.4 — Correlation Tracing & Audit View

**Deliverables:**
- Trace reconstruction from correlation_id
- Audit log display (all events in trace)
- Causality visualization
- Export/share traces

**Scope:**
```typescript
// Correlation trace reconstruction
type CorrelationTrace = {
  correlationId: string,
  initiatingEvent: TimelineEvent,
  relatedEvents: TimelineEvent[],
  timeline: TimelineEvent[],       // sorted by timestamp
  criticalPath?: TimelineEvent[]   // DAG of causality
}
```

**Acceptance Criteria:**
- [ ] Click event → see all related events
- [ ] Trace reconstruction in <200ms
- [ ] Critical path calculated for >3 event chains
- [ ] Export as JSON/CSV
- [ ] Share link copies correlation_id to clipboard

---

### 23.6.5 — Integration with MemoryQueryAPI

**Deliverables:**
- Query client for Explorer
- Polling/subscription for real-time updates
- Error handling and retry logic
- Caching strategy

**Scope:**
```typescript
// ExplorerQueries.ts
class ExplorerClient {
  async getTimeline(
    startDate: Date,
    endDate: Date,
    types?: EventType[],
    limit?: number
  ): Promise<TimelineEvent[]>
  
  async getDriftMetrics(window: 'hourly' | 'daily' | 'weekly'): Promise<DriftMetric[]>
  
  async getHealthMetrics(window: '1h' | '24h' | '7d'): Promise<HealthMetric[]>
  
  async getCorrelationTrace(correlationId: string): Promise<CorrelationTrace>
  
  subscribeToEvents(callback: (event: TimelineEvent) => void): () => void
}
```

**Acceptance Criteria:**
- [ ] All queries timeout <2s
- [ ] Polling interval: 5s (configurable)
- [ ] Cache invalidation on new events
- [ ] Errors logged but don't break UI
- [ ] Retry with exponential backoff

---

### 23.6.6 — Memory Explorer UI Tests

**Deliverables:**
- Component unit tests
- Integration tests (UI ↔ MemoryQueryAPI)
- Visual regression tests
- Performance benchmarks

**Scope:**
```
tests/ui/explorer/
  TimelineView.test.tsx           # Rendering, interactions
  DriftOverlay.test.tsx           # Drift calculation
  CorrelationTracer.test.tsx      # Trace reconstruction
  ExplorerQueries.test.ts         # API mocking
  Performance.bench.ts            # Render/load times
```

**Acceptance Criteria:**
- [ ] Unit tests: >80% coverage
- [ ] Integration tests: 10+ scenarios
- [ ] Performance: render <100ms, load <500ms
- [ ] Visual regressions: pixel-perfect on canary

---

### 23.6.7 — Memory Explorer UI Launch

**Deliverables:**
- Deploy to staging
- Validate all queries work end-to-end
- Documentation (user guide, API reference)
- Monitoring dashboard

**Scope:**
```
/docs/
  /ui/
    EXPLORER_GUIDE.md             # User documentation
    API_REFERENCE.md              # Query reference
    
/monitoring/
  explorer_dashboard.json         # Grafana config
```

**Acceptance Criteria:**
- [ ] UI accessible at `/cic/explorer`
- [ ] All queries execute <2s
- [ ] 0 runtime errors in logs
- [ ] User guide complete
- [ ] Monitoring alerts configured

---

## Track B: Phase 23.7 — Memory-Driven Autonomy

**Goal:** CIC proposes roadmap updates based on historical patterns; detects drift, instability, performance regressions.

### 23.7.1 — Autonomy Logic & Signal Detection

**Deliverables:**
- Signal detection engine (drift, instability, regression)
- Anomaly classification
- Severity scoring
- Decision thresholds

**Scope:**
```typescript
// Signal types
type AutonomySignal = {
  type: 'drift' | 'instability' | 'regression' | 'opportunity',
  severity: 'info' | 'warning' | 'critical',
  confidence: number,             // 0.0–1.0
  affectedPhases: string[],       // ['Phase 7', 'Phase 24', ...]
  evidence: MemoryEvent[],        // supporting events
  timestamp: ISO8601,
  recommendation?: string         // optional proposed action
}

// Decision thresholds
const THRESHOLDS = {
  DRIFT_CRITICAL: 0.75,           // drift > 75% triggers signal
  INSTABILITY_ERROR_RATE: 0.15,   // error rate > 15%
  REGRESSION_LATENCY: 2.0,        // latency increased 2x
  OPPORTUNITY_SUCCESS_RATE: 0.95  // consistently >95% success
}
```

**Acceptance Criteria:**
- [ ] Detect drift across 4 signal types (semantic, temporal, narrative, causal)
- [ ] Classify instability from error/latency/failure patterns
- [ ] Calculate regression vs. baseline
- [ ] Score confidence 0.0–1.0 for each signal
- [ ] Generate recommendations for critical signals

---

### 23.7.2 — Roadmap Proposal Engine

**Deliverables:**
- Propose phase reprioritization based on signals
- Suggest resource reallocation
- Identify blocking dependencies
- Cost-benefit analysis

**Scope:**
```typescript
// Roadmap proposal
type RoadmapProposal = {
  proposalId: string,
  timestamp: ISO8601,
  triggeredBy: AutonomySignal[],
  actions: ProposalAction[],
  impact: {
    affectedPhases: string[],
    estimatedDurationChange: hours,
    riskLevel: 'low' | 'medium' | 'high',
    dependencies: string[]
  },
  confidence: number,
  approvalStatus: 'pending' | 'approved' | 'rejected',
  rejectionReason?: string
}

type ProposalAction =
  | { type: 'reprioritize', phase: string, newPosition: number }
  | { type: 'allocate_resources', phase: string, resource: string, quantity: number }
  | { type: 'add_phase', phase: string, insertAfter: string }
  | { type: 'defer_phase', phase: string, newTargetDate: ISO8601 }
```

**Acceptance Criteria:**
- [ ] Proposals based on ≥3 supporting signals
- [ ] Impact assessment calculated
- [ ] Dependencies graph checked
- [ ] Confidence score explains uncertainty
- [ ] Approval workflow ready for governance (Phase 13/24)

---

### 23.7.3 — Drift-Aware Roadmap Queries

**Deliverables:**
- Query API for autonomy signals
- Roadmap proposal endpoints
- Signal history and trends
- What-if simulation

**Scope:**
```typescript
// Autonomy API
GET /autonomy/signals?severity=critical,warning&window=7d
  → AutonomySignal[]

GET /autonomy/proposals?status=pending,approved
  → RoadmapProposal[]

GET /autonomy/signals/trends?metric=drift&phase=Phase%2024
  → SignalTrend[]

POST /autonomy/simulate?action=defer_phase&phase=Phase%2025&days=3
  → SimulationResult
```

**Acceptance Criteria:**
- [ ] All queries <500ms
- [ ] Pagination for >100 results
- [ ] Filters on severity, phase, date range
- [ ] Simulation non-destructive (no writes)
- [ ] Results include confidence and evidence

---

### 23.7.4 — Integration with APR & ARPS

**Deliverables:**
- Feed autonomy signals into APR (Phase 25) planning
- Update ARPS (Phase 22) with roadmap changes
- Coordination layer between autonomy + planning

**Scope:**
```typescript
// Autonomy → APR bridge
class AutonomyToPlannerBridge {
  async feedSignalsToPlanner(signals: AutonomySignal[]): Promise<void>
  // Convert signals → APR goals
  // Trigger replanning if critical signals
}

// Autonomy → ARPS bridge
class AutonomyToARPSBridge {
  async updateARPSWithProposal(proposal: RoadmapProposal): Promise<void>
  // Log proposal as ARPS_DELTA event
  // Update phase priorities in ARPS state
}
```

**Acceptance Criteria:**
- [ ] Signals flow to APR goal generator
- [ ] APR replanning triggered on critical signals
- [ ] Proposals logged as ARPS_DELTA events
- [ ] Phase priorities updated in real-time
- [ ] Feedback loop to autonomy on plan success

---

### 23.7.5 — Governance Integration (Phase 24/13)

**Deliverables:**
- Autonomy proposals routed to Council voting (Phase 24)
- Policy rails enforcement (high-risk proposals require approval)
- Audit trail of all autonomy decisions
- Governance feedback to autonomy engine

**Scope:**
```typescript
// Governance integration
class AutonomyGovernanceBridge {
  async routeProposalToGovernance(proposal: RoadmapProposal): Promise<void>
  // Assess risk level
  // Route to Council if risk > threshold
  // Wait for approval before execution
  
  async recordGovernanceDecision(
    proposal: RoadmapProposal,
    decision: 'approved' | 'rejected',
    councilVotes?: VoteRecord[]
  ): Promise<void>
  // Update proposal status
  // Log GOVERNANCE_SIGNAL event
  // Feed back into autonomy learning
}
```

**Acceptance Criteria:**
- [ ] Proposals with risk='high' require Council approval
- [ ] Governance audit trail complete
- [ ] Rejection reasons fed back to autonomy
- [ ] Autonomy learns from governance feedback
- [ ] All decisions logged as GOVERNANCE_SIGNAL

---

### 23.7.6 — Autonomy Learning & Drift Decay

**Deliverables:**
- Learn from approved vs. rejected proposals
- Tune signal thresholds based on outcomes
- Decay old signals automatically
- Adjust confidence scores based on accuracy

**Scope:**
```typescript
// Autonomy learning
class AutonomyLearner {
  async evaluateProposalOutcome(
    proposal: RoadmapProposal,
    outcome: 'success' | 'partial' | 'failure'
  ): Promise<void>
  // Update confidence model
  // Adjust signal thresholds
  // Log learning event
  
  async decayOldSignals(): Promise<void>
  // Remove signals >30 days old
  // Archive to long-term memory
  // Reduce weight in active decision-making
}
```

**Acceptance Criteria:**
- [ ] Signal accuracy tracked over time
- [ ] Thresholds auto-adjust based on false positives
- [ ] Signals >30 days old archived
- [ ] Confidence scores improve with data
- [ ] Learning curves visible in monitoring

---

### 23.7.7 — Memory-Driven Autonomy Tests

**Deliverables:**
- Unit tests for signal detection
- Integration tests (signals → proposals → governance)
- Scenario tests (simulated drift events)
- Performance benchmarks

**Scope:**
```
tests/autonomy/
  SignalDetection.test.ts         # Drift, instability, regression
  RoadmapProposal.test.ts         # Proposal generation
  AutonomyGovernance.test.ts      # Governance routing
  AutonomyLearning.test.ts        # Threshold adjustment
  Scenarios.integration.test.ts   # E2E scenarios
```

**Acceptance Criteria:**
- [ ] Unit tests: >80% coverage
- [ ] Integration tests: 15+ scenarios
- [ ] Signal detection latency <100ms
- [ ] Proposal generation latency <500ms
- [ ] All edge cases handled (no crashes)

---

### 23.7.8 — Autonomy Dashboard & Monitoring

**Deliverables:**
- Autonomy signals dashboard (Grafana)
- Proposal history view
- Learning metrics (threshold changes, accuracy)
- Decision audit log

**Scope:**
```
/monitoring/
  autonomy_signals.json           # Grafana dashboard config
  autonomy_proposals.json         # Proposal tracking dashboard
  
/logs/
  autonomy_decisions.log          # Decision audit trail
```

**Acceptance Criteria:**
- [ ] Dashboard displays active signals
- [ ] Proposal history searchable by phase/date
- [ ] Learning metrics show accuracy trends
- [ ] Audit log immutable and queryable
- [ ] Alerts on critical signals

---

## Coordination Layer: MLA/CKG Sync Points

**How Track and Track B coordinate via shared data:**

### Sync Point 1: Event Flow (MLA)

Track B (Autonomy) reads all events written by Track (UI) and broader CIC system:

```
CIC System → MLA Events
  ↓
Track B: Signal Detection (reads event stream)
  ↓
AutonomySignal → MLA as AUTONOMY_SIGNAL event
  ↓
Track A: Explorer UI (displays AUTONOMY_SIGNAL)
```

**Events in MLA:**
- `ARPS_DELTA` — roadmap changes
- `PIPELINE_RUN` — executions
- `AGENT_TELEMETRY` — agent metrics
- `GOVERNANCE_SIGNAL` — approval decisions
- `AUTONOMY_SIGNAL` — new (from Track B)

---

### Sync Point 2: Queries (MemoryQueryAPI)

Track queries MemoryQueryAPI for timeline + drift data. 
Track B queries MemoryQueryAPI for signal history + correlation. 
Both query same underlying memory store:

```
Track A: GET /memory/events?type=ARPS_DELTA,...
Track B: GET /memory/events?type=ARPS_DELTA,... (then analyze)
  ↓
Both read authoritative MLA state
  ↓
Track A displays, Track B proposes
```

---

### Sync Point 3: CKG Integration (Phase 27)

Once CKG (Phase 27) is live, both tracks feed into it:

```
Track A → CKG: UI timeline = entity lifecycle view
Track B → CKG: Autonomy proposals = relationship updates
  ↓
CKG synthesizes: "This phase drifted because..."
  ↓
Both tracks query CKG for reasoning context
```

---

### Sync Point 4: Governance Feedback

Track B proposes → Track visualizes in proposal panel 
Governance approves/rejects → Track B learns 
Both tracks log GOVERNANCE_SIGNAL to MLA:

```
Track B: Proposal → Governance
  ↓
Governance decision → GOVERNANCE_SIGNAL event
  ↓
Track A: Display decision in Explorer
Track B: Learn from decision, adjust thresholds
  ↓
Both log decision to MLA
```

---

## Implementation Sequence

### Phase A (Weeks 1–2): Parallel Foundation

**Track Work:**
- 23.6.1 UI Architecture
- 23.6.2 Timeline View (basic rendering)
- 23.6.5 ExplorerQueries client

**Track B Work:**
- 23.7.1 Signal Detection (core logic)
- 23.7.2 Roadmap Proposal Engine (basic)
- 23.7.3 Autonomy API (endpoints)

**Sync:** Both write events to MLA; both query MemoryQueryAPI

---

### Phase B (Weeks 3–4): Feature Development

**Track Work:**
- 23.6.3 Drift Overlay & Health Indicators
- 23.6.4 Correlation Tracing
- 23.6.6 Tests

**Track B Work:**
- 23.7.4 APR Integration
- 23.7.5 Governance Integration
- 23.7.6 Learning & Decay

**Sync:** Track B writes AutonomySignal events; Track visualizes them

---

### Phase C (Week 5): Integration & Launch

**Track Work:**
- 23.6.7 Launch (staging deployment)
- Monitoring setup

**Track B Work:**
- 23.7.7 Tests
- 23.7.8 Dashboards

**Sync:** Full end-to-end: Signals → Proposals → Governance → UI Audit View

---

## Success Criteria (Combined)

- [ ] Track A: Timeline UI renders <100ms, queries <2s
- [ ] Track B: Signals detected <100ms, proposals generated <500ms
- [ ] Both: MLA event flow synchronized, no loss
- [ ] Both: All queries use same authoritative MLA/CKG data
- [ ] Both: Tests >80% coverage, integration scenarios >15
- [ ] Both: Governance integration working (Phase 24 Council routing)
- [ ] Both: Monitoring dashboards live
- [ ] Both: Documentation complete

---

## File Structure (Both Tracks)

```
/cic-ingestion/
  /src/
    /memory/
      MemoryStore.ts              # Existing 23.2
      MemoryQueryAPI.ts           # Existing 23.5
      
    /ui/                          # Track A (23.6)
      /explorer/
        ExplorerLayout.tsx
        TimelineView.tsx
        DriftOverlay.tsx
        HealthIndicators.tsx
        CorrelationTracer.tsx
        
    /autonomy/                    # Track B (23.7)
      SignalDetection.ts
      RoadmapProposal.ts
      AutonomyAPI.ts
      AutonomyGovernanceBridge.ts
      AutonomyLearner.ts
      
    /bridges/
      AutonomyToPlannerBridge.ts  # 23.7.4
      AutonomyToARPSBridge.ts     # 23.7.4
      
  /tests/
    /ui/explorer/
      *.test.tsx
    /autonomy/
      *.test.ts
      
  /monitoring/
    explorer_dashboard.json       # Track A
    autonomy_signals.json         # Track B
```

---

**Ready to execute. Both tracks start now, synchronized via MLA/CKG.**

Which track should I scaffold first?

A) **Track — Memory Explorer UI** (23.6.1 component tree + architecture) 
B) **Track B — Memory-Driven Autonomy** (23.7.1 signal detection + proposal engine) 
C) **Both in parallel** — scaffold both now, alternate focus as blocks clear

**Choose now.**
