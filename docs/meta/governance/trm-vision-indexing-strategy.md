# Willow Run Archive: Indexing & Scaling Strategy

**Date:** 2026-07-22  
**Collection:** Michigan Flight Museum, Sorensen Photo Archive  
**Scope:** 43 JPG files, 20 photo series, spanning 1941-1943

---

## 1. Current State

### Vault Structure
```
willow-run/
├── sources/raw/              # Original files (43 JPG + metadata docs)
├── analyzed/
│   └── variants/             # All files organized by series/variant
├── metadata/
│   ├── catalog-bridge.json   # Photo ID → file mapping
│   ├── artifacts/            # Vision analysis results (pending)
│   └── ingest-results.json   # Processing manifest
└── index/
    └── master-index.json     # Searchable index
```

### Current Indexing
- **By Series ID:** 75901, 75904, 76225, 76266, ... (20 series)
- **By Variant:** A, B, C, D, etc. (43 total files)
- **By Collection:** All linked to "michigan-flight-museum-sorensen"

---

## 2. TRM Cross-Linking Strategy

### Topic Mapping
Photos feed multiple TRM topics based on subjects + vision labels:

| Photo ID | Primary Subject | TRM Topics | Priority | Notes |
|----------|-----------------|-----------|----------|-------|
| 75901 | Sorensen, engine test | charlie-sorensen, industrial-production | HIGH | Hands-on explaining pose |
| 75904 | Willow Run model | willow-run-bomber-plant, scale-model | HIGH | Documentary record |
| 76225 | Sperry bombsight visit | industrial-tech, government-relations | HIGH | Wartime tech context |
| 76707 | Truman visit | truman-committee, wartime-inspection | HIGH | Political oversight |
| 76795 | Brett, Knudsen, Sorensen, Edsel | high-level-collaboration | HIGH | War production leadership |
| 76926 | Lindbergh, Henry Ford I | lindbergh-visit, ford-motor-company | HIGH | Industrial celebrity |
| 77104 | Roosevelt visit | roosevelt-willow-run, presidential-visit | HIGH | **HIGHEST historical value** |
| 77110 | Chinese Military Mission | diplomatic-relations, wartime-alliance | HIGH | International cooperation |
| 78311 | Joseph C. Grew visit | diplomatic-history, state-department | MEDIUM | Former Tokyo ambassador |
| 78578 | Morgenthau, HF1, Sorensen | treasury-engagement, war-finance | MEDIUM | Federal oversight |

### Fact-to-Photo Linking Rules

**Rule 1: Confirmed Subject Match**
- If TRM fact mentions photo ID directly → automatic link (confidence 1.0)
- Example: `charlie-willow-run-1784400641353-73c8` references "75901-A" → link confirmed

**Rule 2: Date + Location + Subject Overlap**
- If TRM fact date matches ± 7 days AND location matches AND subject matches → link with confidence 0.85+
- Example: TRM fact "October 1941, Sperry facility, Sorensen examining bombsight" + Photo 76225 "10-13-41, Sperry, bombsight" → 0.95 confidence

**Rule 3: Vision Labels Match Fact Categories**
- After vision analysis, if auto-detected labels align with TRM categories → link with confidence 0.7+
- Vision labels: "factory, aircraft-engine, assembly-line" + TRM category "industrial-production" → link

**Rule 4: Multi-Topic Photos**
- Photos like 77104 (Roosevelt visit) feed multiple TRM facts:
  - Roosevelt presidential activity
  - Willow Run production milestone
  - Sorensen's executive role
  - Ford family presence
  - Link to each separately with appropriate confidence tiers

---

## 3. Indexing for Heterogeneous Batches

### Problem: Mixed Data Trajectories

Future batches will arrive with varying:
- **Date ranges** (could be 1920s → 1950s Sorensen arc)
- **Quality/completeness** (full metadata vs. loose ID only)
- **Coverage** (deep Ford archival batch vs. random donations)
- **Destination** (one TRM topic vs. multi-topic spillover)

### Solution: Funnel Indexing

All incoming batches flow through 4-stage index funnel:

```
Stage 1: INGEST
  ↓ Read raw files
  ↓ Extract basic metadata (date, subject, source)
  ↓ Group by series/variant
  ↓ Output: catalog-bridge.json (Photo ID → file location + size)

Stage 2: ANALYZE
  ↓ Run vision pipeline (mock or real Google Vision)
  ↓ Extract labels, confidence, metadata
  ↓ Output: artifacts/ (per-photo analysis results)

Stage 3: LINK
  ↓ Cross-match against existing TRM facts
  ↓ Apply linking rules (subject, date, location, labels)
  ↓ Score confidence (0.0-1.0)
  ↓ Output: trm-crosslinks.json (Photo ID → TRM fact ID + confidence)

Stage 4: AGGREGATE
  ↓ Combine all stages into master index
  ↓ Flag photos with high confidence → ingest into TRM (workflow trigger)
  ↓ Flag photos with low confidence → manual review queue
  ↓ Output: master-index.json + ingest-decisions.json
```

### Index Artifacts (Per Batch)

```
batch-YYYYMMDD-label/
├── catalog-bridge.json          # Stage 1: Photo ID → file
├── artifacts/
│   └── {photo-id}_{variant}.json # Stage 2: Vision analysis
├── trm-crosslinks.json          # Stage 3: Photo → TRM fact links
├── master-index.json            # Stage 4: Complete index
└── ingest-decisions.json        # Workflow triggers
```

---

## 4. Confidence Scoring

### Vision Confidence
- **Google Vision API** returns [0.0-1.0] per label
- **Adaptive threshold** (CIC Vision Subsystem) = 0.6-0.85 (tuned per batch)
- **Use:** Filter low-confidence auto-extractions

### Link Confidence
- **Confirmed (1.0):** Photo ID explicitly in TRM fact
- **High (0.85-0.99):** Date + location + subject all match
- **Medium (0.70-0.84):** Vision labels align with TRM category
- **Low (0.50-0.69):** Weak subject overlap (manual review required)
- **Reject (<0.50):** Unrelated to TRM topic

### Aggregate Confidence
```
photo_confidence = min(
  vision_confidence,      # How confident in photo analysis?
  link_confidence         # How confident in TRM match?
)

IF photo_confidence >= 0.80:
  → AUTO-INGEST to TRM (with artifact)
ELSE IF 0.50 <= photo_confidence < 0.80:
  → REVIEW QUEUE (flag for human decision)
ELSE:
  → REJECT (not TRM-relevant)
```

---

## 5. TRM Fact Creation from Photos

### When to Create New TRM Facts

If photo doesn't match existing TRM fact but:
- ✓ Contains previously undocumented event (e.g., new Sorensen visit)
- ✓ Shows new historical subject (e.g., Chinese Military Mission)
- ✓ Provides unique evidence (e.g., sole photo of Roosevelt at Willow Run)

**Workflow:**
1. Flag in `ingest-decisions.json` → `new_fact_candidates`
2. Extract metadata: date, subjects, location, description
3. Create TRM fact stub (status: draft)
4. Link photo as primary evidence
5. Human review + approval

**Current Willow Run batch triggers 3+ new fact candidates:**
- Chinese Military Mission visit (HIGH priority)
- Crown Prince Olaf Norway visit (HIGH priority)
- Joseph C. Grew diplomatic context (MEDIUM priority)

---

## 6. Scaling for Future Batches

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Files per batch | 50-500 | 43 |
| Ingest time (stage 1) | <5 min | <30 sec |
| Vision analysis (stage 2, mock) | <30 sec | - |
| Vision analysis (stage 2, real) | <10 min | - |
| TRM linking (stage 3) | <2 min | - |
| Total pipeline end-to-end | <20 min | <2 min |

### Batch Size Scaling

**Bottleneck:** Vision API quotas (Google Gemini)

| Batch Size | Google API Cost | Time | Approach |
|------------|-----------------|------|----------|
| <50 | $0-5 | <5 min | Real API (batch-1 phase) |
| 50-200 | $25-50 | 20-60 min | Mock for preview, real async |
| 200-500 | $100-200 | 2-4 hrs | Mock preview → real overnight |
| 500+ | $200+ | >4 hrs | Split into sub-batches |

**Current:** Mock provider only (instant, $0, for metadata validation)

### Recommended Next Batch

- **Label:** `willow-run-expansion` (additional Ford archival sources)
- **Expected size:** 80-120 files
- **Approach:** Stage 1-2 with mocks (metadata validation), Stage 3 cross-link live, Stage 4 aggregate + decision
- **Timeline:** 2-3 hours end-to-end

---

## 7. Indexing API (Future)

Once batches stabilize, expose query interface:

```javascript
// Query by TRM topic
index.photosByTopic('charlie-sorensen')
  → [75901, 76225, 76266, 76795, 76880, 76901, 77100, 77104, 78311, 78578, ...]

// Query by date range
index.photosByDateRange('1942-07-01', '1942-09-30')
  → [76795, 76880, 76901, 76926, 77104, 77110, ...]

// Query by confidence threshold
index.photosByConfidence(0.85)
  → [{ photo_id: 75901, trm_fact: 'charlie-sorensen-engine-expertise', confidence: 0.95 }, ...]

// Query cross-topic spillover
index.photosCrossingTopics()
  → Photos linking to 2+ TRM topics (for research synthesis)
```

---

## 8. Governance

### Approval Gates

- **Stage 1 (Ingest):** Automatic if files valid
- **Stage 2 (Vision):** Automatic if analysis succeeds
- **Stage 3 (Link):** Manual review if link confidence <0.80
- **Stage 4 (Aggregate):** CIC Governance artifact (pending → ratified)

### Archive Integrity

- All original files preserved in `sources/raw/`
- All processed files archived in `analyzed/variants/`
- All indices versioned: `master-index-v001.json`, `master-index-v002.json`
- Dedupe check: Compare file hash before re-ingesting same batch

---

## Next Steps

1. **Vision Analysis:** Batch process all 43 JPGs through CIC Vision Subsystem (mock provider)
2. **TRM Cross-Linking:** Match photos to existing TRM facts (charlie-willow-run, etc.)
3. **Decision Making:** Flag high-confidence matches for auto-ingest, flag low-confidence for review
4. **New Facts:** Create TRM fact stubs for undocumented events (Chinese Mission, Crown Prince Olaf)
5. **Indexing:** Publish master-index + search interface

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-22 17:50 UTC  
**Vault Location:** `C:\Users\soren\trm-vault\topics\charlie\willow-run\INDEX-STRATEGY.md`
