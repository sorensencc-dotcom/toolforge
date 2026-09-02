# Integration Diagram

```mermaid
graph TD
  CicOrchestrateFlow[cic-orchestrate-flow] --> CicIngestWorld[cic-ingest-world]
  CicIngestWorld --> CicRunGate[cic-run-gate]
  CicRunGate --> CicRepairPipeline[cic-repair-pipeline]
  CicRepairPipeline --> CicConsolidateArtifacts[cic-consolidate-artifacts]
  CicOrchestrateFlow -.uses.-> CicShared[_cic-shared]
```
