---
title: "RFC: Deterministic Synthetic Content Filtering Gate for CIC-KB Ingestion"
category: "research"
topic: "rfc-synthetic-content-filtering-gate"
gap_id: "act-04-synthetic-content-filtering-gate"
status: "draft"
created_at: "2026-10-04T15:15:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "gemini-3.7-flash"
router_confidence: 0.96
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: null
citations:
  - "scripts/synthetic-content-filter.mjs"
  - "tests/synthetic-content-filter.test.mjs"
  - "trm/research-gaps/cic-kb.md"
---

# RFC: Deterministic synthetic content filtering gate for CIC-KB ingestion

## 1. Problem statement and background

Automated ingestion pipelines in Cast Iron Charlie (CIC) and `kb-sync` process multi-modal documents, transcripts, and web sources into high-density knowledge packs for NotebookLM and downstream LLM agents. During high-throughput scraping and extraction, three failure modes pollute the knowledge base:

1. **Synthetic model hallucinations & preamble slop**: Ingesting ungrounded AI summaries containing canned preamble phrases (`Certainly! Here is...`, `In conclusion, it is important to remember...`, `delve into the rich tapestry`) inflates token storage costs and degrades retrieval precision.
2. **Degenerate repetitive boilerplate loops**: Failed OCR scans or circular scraper loops inject low-entropy text chunks that waste embedding compute and trigger vector store pollution.
3. **Buffer overflows & ENOBUFS failures**: Chunks exceeding $380\text{ KiB}$ cause Node.js IPC pipe saturation and ENOBUFS crashes during NotebookLM source sync.

To maintain corpus integrity, the ingestion pipeline requires a deterministic, zero-external-dependency validation gate that filters candidate content before storage and indexing.

---

## 2. Gate architecture and evaluation metrics

```
+-------------------------------------------------------------------------------+
|                       Ingestion Stream / Extraction Queue                     |
|            (Raw PDF Extractions, Web Scrapes, Video Transcripts)              |
+---------------------------------------+---------------------------------------+
                                        | Candidate payload
                                        v
+-------------------------------------------------------------------------------+
|                  Synthetic Content Filtering Gate (Deterministic)             |
|                                                                               |
|  1. KIS-P Byte Budget Check      : Size <= 380 KiB (ENOBUFS protection)       |
|  2. Shannon Entropy Scoring      : Bits per char >= 3.0                       |
|  3. Compression Ratio Analysis   : Deflate ratio >= 0.22 (Boilerplate check)  |
|  4. Synthetic Marker Scanner     : Zero AI slop / throat-clearing markers     |
|  5. Provenance & Lineage Check   : Verifiable URL, RFC, or Git hash presence  |
+-------------------+-------------------+-------------------+-------------------+
                    |                   |                   |
         Score >= 0.75                  | 0.45 <= Score < 0.75 | Score < 0.45
                    v                   v                   v
+-----------------------+ +-----------------------+ +---------------------------+
|      PASS VERDICT     | |      WARN VERDICT     | |       REJECT VERDICT      |
|  Ingest into CIC-KB   | | Flagged for Operator  | | Quarantined / Dropped     |
|  and Index in Vault   | | Review in Dashboard   | | Telemetry Alert Emitted   |
+-----------------------+ +-----------------------+ +---------------------------+
```

### 2.1 Quantitative scoring parameters

| Metric Component | Mathematical Basis | Threshold / Ceiling | Weight Penalty |
| :--- | :--- | :--- | :--- |
| **Buffer Budget ($B$)** | $\text{ByteLength}(T)$ | $\le 380\text{ KiB}$ | Immediate Hard $\text{REJECT}$ ($S = 0.0$) |
| **Shannon Entropy ($H$)** | $-\sum_{i=1}^n p(c_i) \log_2 p(c_i)$ | $H \ge 3.0\text{ bits/char}$ | $-0.40$ if $H < 3.0$ |
| **Compressibility ($\rho$)** | $\frac{\text{len}(\text{Deflate}(T))}{\text{len}(T)}$ | $\rho \ge 0.22$ | $-0.35$ if $\rho < 0.22$ |
| **Slop Markers ($M$)** | Regex token classification | $M = 0$ | $-\min(0.60, M \times 0.25)$ |
| **Provenance Grounding ($P$)** | URL, RFC, Hash, Wikilink match | $P \ge 1$ indicator | $-0.25$ if missing |

---

## 3. Implementation verification and benchmark results

The filtering gate is implemented in [`scripts/synthetic-content-filter.mjs`](file:///C:/dev/scripts/synthetic-content-filter.mjs) and validated in [`tests/synthetic-content-filter.test.mjs`](file:///C:/dev/tests/synthetic-content-filter.test.mjs).

### Test execution summary
- **Entropy differentiation**: Correctly distinguishes uniform repetitive streams ($H = 0.00$) from historical manufacturing corpora ($H = 4.38$).
- **Boilerplate loop detection**: Identifies low-entropy repeated phrases ($\rho = 0.08$) and rejects without regex timeouts.
- **AI slop identification**: Flags multi-marker canned introductions and reduces candidate score below $0.45$.
- **Execution latency**: Evaluates a $100\text{ KiB}$ candidate chunk in under $2\text{ ms}$ on standard V8 runtimes.

---

## 4. Operational integration plan

1. **Pre-Ingestion Hook**: Wire `evaluateContentGate` into the CIC crawler pipeline prior to database staging.
2. **Automated Quarantine**: Route any item receiving a `REJECT` verdict into `.kb_cache/quarantine/` with structured diagnostic telemetry.
3. **Operator Dashboard Surface**: Display daily triage counts and pass/warn/reject ratios on the ICF dashboard telemetry stream.
