# Integration Diagram

```mermaid
graph TD
  TrmVault[trm-vault topic] --> TrmFeedbackReport[trm-feedback-report]
  TrmFeedbackReport -->|trm CLI| TrmStatus[trm-status]
  TrmFeedbackReport -->|classifier quality, OCR latency, new-topic candidates| Report[Markdown Report]
  Report --> ReportsDir[trmRoot/reports/]
```
