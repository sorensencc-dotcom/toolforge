# Integration Diagram

```
+-------------------------------------------------------------+
|                  @lukstei/slop-grader (npm)                 |
|          no-ai-slop + tech-docs rulesets, OpenRouter         |
+------------------------------+------------------------------+
                               |
                    src/run-slop-grader.mjs
                    (spawn, JSON parse, 30s timeout)
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
      +---------------+                 +----------------+
      | changed mode  |                 |  sweep mode    |
      | (pre-commit)  |                 |  (scheduled)   |
      +-------+-------+                 +--------+-------+
              |                                  |
              v                                  v
   git diff --cached (staged .md         glob docs/|wiki/|**/specs/
   under docs/|wiki/|**/specs/)          (full repo)
              |                                  |
              v                                  v
   stdout warning summary,             drift/SLOP-REPORT.md
   exit 0 always                       (Status: DEGRADED on failure)

Credential path (both modes):
  resolveApiKey('openrouter')  -->  OPENROUTER_API_KEY env
  (C:\dev\credential-resolver.ts)

Installed alongside, separate tier:
  skills/writing-heuristics/  (deterministic regex linter, unchanged)
```
