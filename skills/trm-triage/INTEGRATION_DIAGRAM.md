# TRM Triage ΓÇö Integration Diagram

**Status: IMPLEMENTED**

```
Staged Task Cards (.harness/tasks/pending/)
      |
      | trm-triage (node src/index.mjs)
      v
card-triage-engine (modules/triage/card-triage-engine.mjs)
      |
      +-- Task Completion Verification (.harness/tasks/completed/)
      |
      +-- YAGNI Speculative Check
      |
      +-- Reversibility Classification (One-Way vs Two-Way Door)
      |
      v
Decision Records / Backlog Surface (ICF Gateway & Dashboard)
      |
      v
1-Click GitHub Issue Promotion (/api/reporting/trm-backlog/promote)
```
