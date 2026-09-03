# TinyFish Search integration

```text
Caller
  |
  +--> tinyfish_search --> TinyFish Search API --> deterministic SearchOutput
  +--> tinyfish_extract -> TinyFish Fetch API ----> deterministic ExtractOutput

All calls require TINYFISH_API_KEY, validate inputs before network access, and return stable fail-closed errors.
```
