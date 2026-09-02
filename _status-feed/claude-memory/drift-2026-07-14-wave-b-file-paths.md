---
name: drift-2026-07-14-wave-b-file-paths
description: Drift incident - violated absolute file path rule in Wave B development summary
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ccf05dba-5b2e-42cb-914e-45473bad602b
---

**Incident:** Wave B-2 completion summary omitted absolute file paths.

**What happened:** Summary listed development commands as:
- `npm run api:dev` (port 3000)
- `npm run ui:dev` (port 5173)
- `node src/cli/index.js list|search|install`

Only CLI had a file path (partial). API and UI examples omitted paths entirely, violating [[feedback_full_disk_paths]] rule.

**Why:** Caveman mode + brevity bias. npm scripts are "shortcuts" so I treated them as sufficient. Didn't default to full C:\dev\... paths even though CLAUDE.md feedback says "always absolute paths."

**Fix Applied:** Corrected to:
- `node C:\dev\src\api\server.js` (or `npm run api:dev`)
- `node_modules\.bin\vite C:\dev\src\ui` (or `npm run ui:dev`)
- `node C:\dev\src\cli\index.js list` (or `npm run cli -- list`)

**How to apply:** When summarizing dev setup, default to absolute paths first, then offer npm script shortcuts as alternatives. Path rule > convenience rule.

**Related:** [[feedback_full_disk_paths]] (all contexts require absolute paths)
