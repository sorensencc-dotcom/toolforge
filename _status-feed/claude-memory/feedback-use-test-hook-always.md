---
name: use-test-hook-always
description: "Always use npm test via test-setup.js hook, never bypass with npx jest directly"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 14519ca5-b461-493b-8a5a-2c2b55ecc80a
---

Always use `npm test` (invokes test-setup.js batch approval hook). Never `npx jest` directly.

**Why:** Test hook provides batch approval context, eliminating per-call prompts. Direct npx jest loses hook context and triggers individual permission prompts for each test tool call.

**How to apply:** When running tests locally or in scripts, always run `npm test` from service root. This ensures test-setup.js batch approval fires before Jest runs, making all subsequent test operations zero-prompt.
