# Integration Diagram

```mermaid
graph TD
  DocUpdates[Doc Updates] --> SessionWrap[session-wrap]
  StageFiles[Scoped Stage List] --> SessionWrap
  SessionWrap -->|prefixed commit| Git[Git Commit]
  SessionWrap -->|structured result| Report[Wrap Report JSON]
```
