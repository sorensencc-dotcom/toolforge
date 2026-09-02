# Integration Diagram

```mermaid
graph TD
  BrainRoot[Antigravity Brain] --> Cleaner[workspace-storage-cleaner]
  WorkspaceRoot[C:\dev workspace] --> Cleaner
  Cleaner -->|audit| Report[reclaimedBytes, actions]
  Cleaner -->|--apply| Purge[Purged: nested .git, oversized logs, temp files]
```
