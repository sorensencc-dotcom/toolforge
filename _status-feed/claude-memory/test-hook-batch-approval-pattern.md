---
name: test-hook-batch-approval
description: Tests require batch approval hook (scripts/test-setup.js) before Jest runs
metadata: 
  node_type: memory
  type: feedback
  project: cic-ingestion
  originSessionId: a9deac7d-e868-4c54-938d-571b7e9264a3
---

**Pattern:** Test execution MUST invoke `scripts/test-setup.js` before running Jest.

**Why:** Test suite makes filesystem calls (Read, Write, mkdir, rmdir). Without batch approval, each tool call prompts. Script sets `~/.ijfw/.test-batch-approval` marker to signal single approval context.

**How to apply:** Never run `npx jest` directly. Always use:
```
npm test
# NOT: npx jest
# NOT: npx jest src/
```

The `npm test` script runs `node scripts/test-setup.js && npx jest` (defined in package.json).

**In Docker:** Run tests inside container via:
```
docker run --rm -v ${PWD}:/app cic-ingestion npm test
```

NOT via `npm test` on host (host approvals won't carry into container).
