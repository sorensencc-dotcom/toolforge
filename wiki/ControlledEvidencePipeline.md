---
title: "Controlled Evidence Pipeline"
category: "wiki"
status: "active"
---

# Controlled evidence pipeline & TRM topic scaffolding

The controlled evidence pipeline is an end-to-end framework for extracting grounded factual claims from primary source text documents without risking unanchored LLM hallucination. All candidate claims are bound to immutable document revisions and exact character span SHA-256 hashes.

## End-to-end architecture workflow diagram

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#1d2d44',
    'primaryTextColor': '#E8E0D4',
    'primaryBorderColor': '#B8922A',
    'lineColor': '#B8922A',
    'secondaryColor': '#2C2420',
    'tertiaryColor': '#1A1410',
    'fontFamily': 'Barlow Condensed, sans-serif',
    'fontSize': '14px'
  }
}}%%
flowchart TD
    subgraph Ingestion["1. Intake & Grounding"]
        A["Raw Source Corpus (.txt)"] --> B["TorqueQuery Resolver"]
        B -->|Compute SHA-256 File Revision| C["research.task.v1 Spec"]
        B -->|Extract Byte/Character Span| D["Span SHA-256 Hash"]
    end

    subgraph Extraction["2. Bounded Extraction"]
        C --> E["Ollama Extraction Worker"]
        D --> E
        E -->|Strict Schema Constraint| F["candidate.fact.v1 Payload"]
    end

    subgraph Validation["3. Validation & Audit"]
        F --> G{"Validation Gate"}
        G -->|Hash Mismatch / Corrupted| H["Hard Rejection Drop"]
        G -->|Hash Match & Token Grounded| I["/api/audit Adversarial Screening"]
    end

    subgraph Storage["4. Materialization & Adjudication"]
        I -->|Passed Audit| J["canonical_knowledge.json"]
        I -->|Contradiction Flagged| K["staged_review_queue.json"]
        K --> L{"Adjudication Gate"}
        L -->|APPROVE_OVERRIDE| J
        L -->|MARKED_CONTRADICTED| M["Bidirectional Contradiction Edge"]
        M --> J
        L -->|REJECT| N["Dropped & Logged"]
    end

    subgraph Automation["5. Automation & Audit Tools"]
        J --> O["Gap Mining Engine"]
        O -->|Multi-Pattern Heuristics| P["Downstream research.task.v1 Specs"]
        P --> B
        Q["batch_task_generator.py"] -->|Scan Corpus| C
        R["trm/scaffold_topic.py"] -->|Generate Testbed| A
        S["trm/topic_coverage_auditor.py"] -->|3-Tier Audit| T["topic_coverage_audit_report.json"]
    end

    classDef pass fill:#1b4332,color:#E8E0D4,stroke:#2d6a4f,stroke-width:2px;
    classDef fail fill:#641220,color:#E8E0D4,stroke:#a01a2c,stroke-width:2px;
    classDef process fill:#1d2d44,color:#E8E0D4,stroke:#B8922A,stroke-width:2px;
    classDef ember fill:#C4501A,color:#E8E0D4,stroke:#B8922A,stroke-width:2px;

    class J,T pass;
    class H,N fail;
    class B,E,G,I,L,O process;
    class K,Q,R,S ember;
```

---

## Core components & audit enforcement

| Component | Entry Point | Enforcement Mechanism |
| --- | --- | --- |
| **TorqueQuery Resolver** | [`torque_span_resolver.py`](file:///c:/dev/tests/pilots/willow-run-1941/torque_span_resolver.py) | Calculates source file revision and character span SHA-256 hashes. |
| **Bounded Extractor** | [`ollama_bounded_extractor.py`](file:///c:/dev/tests/pilots/willow-run-1941/ollama_bounded_extractor.py) | Constrains LLM extraction strictly to validated text spans. |
| **Validation Gate** | [`validation_gate.py`](file:///c:/dev/tests/pilots/willow-run-1941/validation_gate.py) | Performs cryptographic span hash verification and idempotency check. |
| **Adversarial Audit** | [`staged_review_audit.py`](file:///c:/dev/tests/pilots/willow-run-1941/staged_review_audit.py) | Screens candidates against canonical records for temporal/spatial conflicts. |
| **Adjudication Gate** | [`adjudication_gate.py`](file:///c:/dev/tests/pilots/willow-run-1941/adjudication_gate.py) | Supports `APPROVE_OVERRIDE`, `MARKED_CONTRADICTED`, and `REJECT` actions. |
| **Gap Mining Engine** | [`gap_mining_engine.py`](file:///c:/dev/tests/pilots/willow-run-1941/gap_mining_engine.py) | Evaluates 4 heuristic rules: parameters, vendors, contracts, and production volume. |
| **Batch Task Generator** | [`batch_task_generator.py`](file:///c:/dev/tests/pilots/willow-run-1941/batch_task_generator.py) | Scans primary corpus accessions to generate batch `research.task.v1` specs. |
| **Topic Generator CLI** | [`trm/scaffold_topic.py`](file:///c:/dev/trm/scaffold_topic.py) | Scaffolds topic testbeds, corpus paths, task specs, and 7 Python modules. |
| **Topic Coverage Auditor** | [`trm/topic_coverage_auditor.py`](file:///c:/dev/trm/topic_coverage_auditor.py) | Runs 3-tier audits: orphan source detection, topic emergence, and scope drift. |

---

## Execution commands

To run topic scaffolding:
```bash
python trm/scaffold_topic.py --topic-slug <topic-slug>
```

To run topic coverage audits:
```bash
python trm/topic_coverage_auditor.py \
    --topics-dir ./tests/pilots \
    --corpus-dir ./tests/pilots/willow-run-1941/corpus \
    --report trm/topic_coverage_audit_report.json
```

To run the complete pilot feedback loop and batch ingestion runner:
```bash
python tests/pilots/willow-run-1941/run_feedback_loop.py
python tests/pilots/willow-run-1941/run_batch_ingestion.py
```
