---
name: parallel-search
description: Use for current web search, URL extraction, or asynchronous deep-research task creation through Parallel.
compatibility: Node.js 20+, `PARALLEL_API_KEY`, and the `parallel-web` package.
---

# Parallel Search

Exports `parallel_search`, `parallel_extract`, and `parallel_task` from `src/index.ts`.

All operations validate inputs before network access and return `{ ok: true, data }` or `{ ok: false, error }`. Task creation is nonblocking and returns the queued Task Run identifiers; result retrieval belongs to a later integration phase.
