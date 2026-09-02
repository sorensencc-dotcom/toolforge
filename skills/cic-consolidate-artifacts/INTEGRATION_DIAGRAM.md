# Integration Diagram: CIC Consolidate Artifacts

```
┌─────────────────────────────────────┐
│   CIC Artifact Sources              │
│  (multiple ingestion streams)       │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌─────────────┐
        │  Validator  │
        │  (strict)   │
        └──────┬──────┘
               │
               ▼
     ┌──────────────────┐
     │  Consolidation   │
     │  Engine          │
     └──────┬───────────┘
            │
            ▼
    ┌──────────────────┐
    │  Manifest Out    │
    │  + Report        │
    └──────────────────┘
```

**Phase 1 Stub**: Basic consolidation without advanced merging.
