# Integration Diagram: CIC Repair Pipeline

```
┌──────────────────────────┐
│  Pipeline Stage Monitor  │
└──────────────┬───────────┘
               │
               ▼
        ┌─────────────┐
        │  Diagnose   │
        │  Failures   │
        └──────┬──────┘
               │
          ┌────┴────┐
          │          │
          ▼          ▼
      [Auto]     [Manual]
          │          │
          ▼          ▼
    ┌─────────┐  ┌─────────┐
    │ Repair  │  │ Report  │
    │ & Test  │  │ Only    │
    └────┬────┘  └────┬────┘
         │            │
         └────┬───────┘
              ▼
         ┌──────────┐
         │ Output   │
         │ Report   │
         └──────────┘
```

**Phase 1 Stub**: Basic stage repair; full distributed repair in Phase 2.
