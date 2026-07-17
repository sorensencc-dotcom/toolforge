# Integration Diagram: CIC Ingest World

```
┌──────────────────────┐
│  External World      │
│  (Source System)     │
└──────────┬───────────┘
           │
           ▼
   ┌──────────────────┐
   │  Ingest World    │
   │  (This Skill)    │
   └──────┬───────────┘
          │
          ├─────────────┬────────────────┐
          │             │                │
          ▼             ▼                ▼
    ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │ Manifest │  │ Lineage  │  │ Downstream   │
    │          │  │ Index    │  │ Processing   │
    └──────────┘  └──────────┘  └──────────────┘
```

**Phase 1 Stub**: Basic ingestion; TorqueQuery queryability in Phase 2.
