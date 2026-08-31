# Parallel Search integration

```text
Caller
  |
  +--> parallel_search --> Parallel Search API --> deterministic SearchOutput
  +--> parallel_extract -> Parallel Extract API -> deterministic ExtractOutput
  +--> parallel_task ----> Parallel Task Run API -> queued TaskOutput

All calls require PARALLEL_API_KEY, validate inputs before network access, and return stable fail-closed errors.
```