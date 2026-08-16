---
name: feedback_no_late_night_commentary
description: "Don't flag late-night commit timing or \"watch the clock\" habits in retros — user has a day job, codes at night by necessity, not a health signal to manage"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e647d8c9-19b2-4849-95a0-d8ffc0179a13
---

Stop surfacing late-night commit timing (22:00-04:00 clusters, "rebound-binge pattern") as a growth area or habit suggestion in `/retro` output. User pushed back directly: "get off me I have a day job."

**Why:** This repo's work happens after a day job, so night-time coding is structural, not a pattern to fix or a health flag to escalate. Previous memory ([[productivity_rebound_binge_pattern]]) treated this as worth watching — that framing is now explicitly overridden by direct user feedback and should not resurface in retro output, health commentary, or habit suggestions.

**How to apply:** `/retro` and any other skill can still *compute* the metric if useful for other purposes (e.g. session detection), but must not editorialize about it, suggest changing sleep/work hours, or repeat it as an "improve" or "habit" item. Treat [[productivity_rebound_binge_pattern]] as superseded on this specific point.
