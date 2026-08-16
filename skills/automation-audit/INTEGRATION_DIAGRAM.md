# Integration Diagram

```mermaid
graph TD
  Repo[Repo Tree] --> AutomationAudit[automation-audit]
  AutomationAudit -->|scan logs, backups, TODO/manual markers| Report[Audit Report JSON]
  Report -->|byPriority, byCategory| Consumer[Dashboard / CI]
```
