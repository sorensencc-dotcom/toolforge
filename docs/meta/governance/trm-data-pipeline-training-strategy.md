# Data Pipeline → TRM Driver Strategy

**Date:** 2026-07-22  
**Scope:** Comprehensive data ingestion to train TRM research framework  
**Vision:** Ingest all available data → catalog + index → drive TRM creation/prioritization

---

## Executive Summary

**Goal:** Build a data-driven TRM framework where comprehensive indexing of available sources directly informs which TRMs are created, prioritized, and expanded.

**Current State:**
- Willow Run photo archive: 43 JPGs (Phase 1)
- Pending: Unknown volume of additional data sources

**Target State:**
- All sources ingested, cataloged, indexed
- TRM priorities derived from data coverage
- Research focus driven by data availability
- Training corpus ready for ML/AI model development

---

## Data Tier Classification

### Tier 1: Primary Documentary Evidence (High Priority TRM Drivers)
**Definition:** Direct, dated, authored sources with confirmed subjects

**Examples:**
- Willow Run photo archive (43 JPGs, confirmed metadata)
- Sorensen family letters/memoranda
- Ford Motor Company internal records (1920s-1950s)
- Contemporary news archives (automotive, aviation, wartime production)

**Ingest Approach:** Full metadata extraction, confident TRM linking (0.85+ threshold)

**Expected Impact:** Creates 5-10 new HIGH-PRIORITY TRMs per 500-file batch

---

### Tier 2: Supporting Research Material (Medium Priority TRM Drivers)
**Definition:** Secondary sources with partial subjects/dates, high contextual value

**Examples:**
- Biography excerpts (Sorensen, Ford family, industry figures)
- Technical documentation (engine specs, production processes)
- Historical reviews/analyses (wartime production studies)
- Organizational charts, facility maps, product timelines

**Ingest Approach:** Selective metadata extraction, careful link scoring (0.70-0.85)

**Expected Impact:** Enriches 3-5 existing TRMs per 500-file batch, flags 2-3 new candidates

---

### Tier 3: Exploratory/Contextual Data (Lower Priority, High Coverage)
**Definition:** Loose connections, limited metadata, but fills gaps

**Examples:**
- Photographs without clear ID or date
- Tangentially related newspaper clippings
- General histories (automotive, aviation, WWII)
- Genealogical records, census data

**Ingest Approach:** Minimal metadata, low link thresholds (0.50-0.70), flagged for human review

**Expected Impact:** Flags 5-10 ambiguous links per 500-file batch, requires manual curation

---

## Data Pipeline: 3-Phase Ingestion Model

```
PHASE A: INTAKE & CATALOGING
├─ Receive batch (raw files + metadata if available)
├─ Extract basic info (date, subject, source origin)
├─ Classify tier (1, 2, 3)
├─ Dedupe against existing index
└─ Generate catalog bridge
    ↓
PHASE B: INDEXING & LINKING
├─ Run vision/OCR analysis (photos, documents)
├─ Extract structured metadata (people, places, dates, events)
├─ Cross-match against existing TRM facts
├─ Score confidence per link (0.0-1.0)
├─ Flag multi-topic spillover
└─ Generate TRM crosslinks
    ↓
PHASE C: PRIORITIZATION & DECISION
├─ Aggregate all phases into master index
├─ Identify TRM coverage gaps (topics with high data but no TRM yet)
├─ Recommend new TRM creation
├─ Score TRM priority based on data availability
├─ Flag for governance review
└─ Publish research roadmap
```

---

## TRM Priority Scoring (Data-Driven)

### Metric 1: Data Coverage
```
coverage_score = (document_count + photo_count + artifact_count) / 10

If coverage_score > 5:  TRM is MAJOR (10+ sources)
If coverage_score 2-5:  TRM is ESTABLISHED (2-10 sources)
If coverage_score <2:   TRM is EMERGING (<2 sources, consider deferring)
```

### Metric 2: Temporal Density
```
density_score = years_spanned / (document_count)

High density (0.1-0.5):  Concentrated period, well-documented
Low density (>0.5):      Sparse coverage, gaps to fill
```

### Metric 3: Perspective Diversity
```
diversity_score = (primary_sources + secondary_sources + visual_media) / 3

High (>0.8):   Multiple viewpoints, rich context
Medium (0.5-0.8): Some redundancy, could expand
Low (<0.5):    Heavily weighted to one source type
```

### Final TRM Priority
```
priority = (coverage_score × 0.5) + (density_score × 0.3) + (diversity_score × 0.2)

RESEARCH FOCUS:
- Score > 7:   TIER A (primary research focus)
- Score 5-7:   TIER B (secondary, expand if time permits)
- Score 3-5:   TIER C (background context, low urgency)
- Score <3:    TIER D (defer until data coverage improves)
```

---

## Willow Run Batch: Baseline Metrics

### Current Data (43 JPGs)
| Metric | Value | Status |
|--------|-------|--------|
| Document count | 43 | Tier 1 primary |
| Coverage score | 4.3 | Established |
| Date range | 1941-1943 (30 months) | Very dense |
| Temporal density | 0.70 | High concentration |
| Perspective diversity | 0.33 (visual only) | Needs written sources |

### Emerging TRM Priorities (from this batch alone)
1. **charlie-sorensen-wartime-role** (10+ photos) → Priority 7.8 (TIER A)
2. **willow-run-bomber-plant** (8+ photos) → Priority 7.2 (TIER A)
3. **roosevelt-wartime-industrial-visits** (1 series, 4 variants) → Priority 6.8 (TIER B)
4. **lindbergh-industrial-visits** (1 series, 6 variants) → Priority 6.5 (TIER B)
5. **chinese-military-mission-usa** (1 series, 6 variants) → Priority 6.2 (TIER B)

**Gap Analysis:**
- Missing: Written Sorensen records (letters, memos, speeches)
- Missing: Ford Motor internal documents (production logs, design records)
- Missing: Government records (War Production Board, military inspection reports)
- Missing: Contemporary press coverage (automotive, aviation, wartime production journals)

---

## Data Sources Inventory (Planning)

### Known Available
- **Willow Run photo archive:** 43 JPGs ✅ (Phase 1 complete)
- **Michigan Flight Museum:** Additional Sorensen materials (TBD)
- **Ford Motor Company Archives:** Estimated 1000+ documents (pending access)
- **National Archives:** War Production Board records (estimated 500+ documents)

### Tier 1 Priority Acquisitions
1. Sorensen family papers (letters, memos, personal records)
2. Ford internal production logs (1941-1945)
3. War Production Board inspection reports
4. Automotive/aviation industry journals (1940-1950)

### Tier 2 Priority Acquisitions
5. Biographical materials (Henry Ford I, Edsel Ford, William Knudsen, others)
6. Corporate organization charts + facility maps
7. Technical specifications (engines, aircraft, manufacturing processes)
8. Congressional records (wartime production hearings, tax records)

### Tier 3 (Exploratory)
9. Genealogical records (Sorensen family tree)
10. Census data, business directories
11. Secondary histories (WWII automotive production, etc.)

---

## Batch Intake Workflow

### When New Data Arrives

**Step 1: Classify & Register**
```
batch-metadata.json:
{
  "batch_id": "batch-20260722-willow-run-001",
  "source": "Michigan Flight Museum",
  "classification": "Tier 1 Primary",
  "file_count": 43,
  "size_mb": 31.75,
  "date_range": "1941-10 to 1943-09",
  "estimated_trm_impact": 5-7,
  "intake_date": "2026-07-22",
  "target_topics": ["charlie-sorensen", "willow-run-bomber-plant", "wartime-production"]
}
```

**Step 2: Ingest (Phase A)**
- Run `batch-ingest` script
- Output: catalog-bridge.json

**Step 3: Index (Phase B)**
- Run vision/OCR analysis
- Cross-link to TRM facts
- Output: trm-crosslinks.json

**Step 4: Prioritize (Phase C)**
- Aggregate metrics
- Score coverage + density + diversity
- Recommend TRM priorities
- Output: ingest-decisions.json + priority-roadmap.md

**Step 5: Publish**
- Update master index
- Update TRM roadmap
- Flag governance for artifacts + new fact approval

---

## TRM Roadmap: Data-Driven (Provisional)

### Tier A Research Focus (Data Concentration >7.0)
1. **Charles E. Sorensen Wartime Role** — 30+ sources expected
2. **Willow Run Bomber Plant** — 20+ sources expected
3. **Ford Motor Company War Production** — 40+ sources expected

### Tier B Expansion (Data Coverage 5-7)
4. **Roosevelt's Industrial Oversight** — 5-8 sources
5. **Lindbergh Aviation Expertise** — 4-6 sources
6. **Cross-Manufacturer Wartime Collaboration** — 8-12 sources
7. **International Diplomatic/Military Coordination** — 6-10 sources

### Tier C Background (Data Coverage 3-5)
8. **Aircraft Engine Technology (Pratt & Whitney, Rolls-Royce)** — 3-5 sources
9. **American Wartime Industrial Policy** — 5-10 sources

### Tier D: Defer (Low Data Coverage <3)
- Henry Ford I Late Career
- Edsel Ford & Next Generation
- Ford Family Succession/Internal Conflict

*(Will escalate if additional data arrives)*

---

## Indexing Architecture for Training

### Master Index (Query Interface)

```javascript
// After all batches ingested & indexed:

// Query 1: Data coverage per TRM
trm.metadata('charlie-sorensen')
  → { 
      documents: 35,
      photos: 12,
      videos: 0,
      primary_sources: 18,
      secondary_sources: 17,
      coverage_score: 7.8,
      priority: 'TIER_A'
    }

// Query 2: Find gaps
trm.gaps('willow-run-bomber-plant')
  → { 
      missing_periods: ['1943-06 to 1943-12'],
      missing_perspectives: ['German intelligence reports'],
      missing_subjects: ['Final cost analysis', 'Post-war decommissioning']
    }

// Query 3: Train mode (for ML)
index.trainingCorpus('charlie-sorensen')
  → [
      { source: 'photo-75901', type: 'image', text: 'Sorensen explaining...', confidence: 0.95 },
      { source: 'memo-1942-06', type: 'text', text: 'Production targets...', confidence: 0.92 },
      ...
    ]
```

---

## Governance Integration

### Pre-Ingest Gate
- ✅ Batch metadata complete?
- ✅ Tier classification clear?
- ✅ No known dupes?

### Phase C Decision Gate
- ✅ TRM priority scores generated?
- ✅ New fact candidates identified?
- ✅ Artifacts pending governance review?

### Post-Ingest Ratification
- ✅ Coverage metrics published?
- ✅ Training corpus available for ML?
- ✅ Research roadmap updated?

---

## Timeline: Full Data Ingestion

### Phase 1 (Current)
- Willow Run photo archive: 43 JPGs ✅
- Expected TRM coverage: 5-7 topics

### Phase 2 (Next: July-August 2026)
- Ford internal documents: ~200 files
- Sorensen family papers: ~50 files
- War Production Board records: ~100 files
- **Cumulative coverage:** 35+ TRM topics candidate

### Phase 3 (September-October 2026)
- Industry journals + contemporary press: ~300 files
- National Archives materials: ~150 files
- Biographical materials: ~80 files
- **Cumulative coverage:** 50+ TRM topics, comprehensive training corpus

### Phase 4+ (November 2026+)
- ML model training on indexed corpus
- TRM auto-generation + refinement
- Research synthesis + narrative generation

---

## Success Metrics

| Milestone | Target | Status |
|-----------|--------|--------|
| Data sources ingested | 1000+ files | In progress (Phase 1: 43) |
| TRM topics created/expanded | 50+ | Projected |
| Training corpus readiness | 90%+ annotated | On track for Q4 |
| Research focus clarity | Tier A priorities locked | Phase C output |
| Coverage completeness | All major gaps identified | Roadmap-driven |

---

**Next Action:** Publish batch-ingest summaries for Phase 1 (Willow Run) → Feed into Phase 2 planning.

**Revision Date:** As new batches arrive  
**Strategy Owner:** CIC Vision Subsystem + TRM Governance  
**Last Updated:** 2026-07-22 18:00 UTC
