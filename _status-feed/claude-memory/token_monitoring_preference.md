---
name: token-monitoring-preference
description: Proactively monitor context/token usage during long sessions; suggest /compact or new chat when approaching limits
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 890da49b-cba7-494d-9800-b729a5070d04
---

## Token Budget Monitoring

**Rule:** During long coding sessions, monitor context length and token usage. Proactively suggest `/compact` or starting a new chat when limits approach.

**Triggers:**
- Context > 80% of window
- Session > 2 hours
- Token cost trending high (> $0.50/session)
- User hasn't been reminded yet in current session

**Action:**
- Flag cost/context status briefly
- Recommend `/compact` to compress memory/context files
- OR suggest starting fresh chat if better fit

**Why:** Long sessions drift, get expensive, slow down response. Compact is 40-50% token savings. New chat resets and stays snappy.

**How to apply:** Integrate into session monitoring loop. Check status at major phase boundaries (task complete, switching domains, long gap between messages).
