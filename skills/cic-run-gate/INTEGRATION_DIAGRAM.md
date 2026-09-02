# Integration Diagram: CIC Run Gate

```
┌────────────────────────────┐
│  CIC Pipeline             │
│ (all active stages)        │
└──────────────┬─────────────┘
               │
               ▼
        ┌─────────────────┐
        │  Run Gate (*)   │
        │  This Skill     │
        └────────┬────────┘
                 │
         ┌───────┴───────┬──────────┐
         │               │          │
         ▼               ▼          ▼
    [Stage 1]      [Stage 2]   [Stage N]
    Validate       Validate    Validate
         │               │          │
         └───────┬───────┴──────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Aggregate       │
        │ Verdicts        │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Report + Exit   │
        │ Code (0/1/2)    │
        └─────────────────┘
```

**Phase 1 Stub**: Single-run gate; continuous monitoring in Phase 2.
