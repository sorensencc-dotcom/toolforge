# Integration Diagram

```mermaid
graph TD
  Manifest[manifest.json] --> SkillHealthMonitor[skill-health-monitor]
  SkillsDir[skills/ directory] --> SkillHealthMonitor
  SkillHealthMonitor -->|staleness, never-run, drift| HealthReport[Health Report JSON]
  HealthReport -->|healthScore, recommendations| Consumer[Dashboard / CI]
```
