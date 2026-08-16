---
name: build_queue_executor_skill_pattern
description: "Build Queue Executor skill — reusable pattern for sequencing Docker builds, testing, committing"
metadata: 
  node_type: memory
  type: observation
  originSessionId: af9b13d6-bfea-4543-9aa6-409d0298c2a8
---

## Build Queue Executor Skill (Shared Library)

**Location:** `C:\Users\soren\.claude\skills\build-queue-executor.md`

**Purpose:** Queue Docker builds, execute them sequentially via docker-compose, run tests, commit on pass or halt on fail. Supports build matrix input (multiple phases/services).

**Input Format:**
```json
{
  "builds": [
    { "name": "Phase Name", "tests": true, "commit": true },
    { "name": "Another Phase", "tests": true, "commit": true }
  ],
  "stopOnFail": true,
  "pushOnComplete": true
}
```

**Execution Model:**
1. For each build in queue:
 - `docker-compose build --no-cache` 
 - `docker-compose up -d <service>`
 - `npm test` (if tests: true)
 - `git add . && git commit` (if commit: true)
 - Stop or continue (if stopOnFail: true)
2. After all builds: `git push origin main` (if pushOnComplete: true)

**Phase 0.9 Context:**
- Skill exists as reusable pattern
- Used to queue TheFoundry Milestone builds
- Designed for docker-compose-based orchestration
- Useful for Phase 24 governance builds, Wayland deployment cycles

**How to Apply:**
- Invoke skill when needing ordered build sequences
- Pair with docker-compose.yml in project root
- Can be extended to support build artifact capture, metrics recording
