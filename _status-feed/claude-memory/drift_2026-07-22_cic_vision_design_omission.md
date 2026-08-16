---
name: drift-2026-07-22-cic-vision-design-omission
description: Generated CIC Vision setup artifacts skipped Cast Iron Charlie design system; applied after user flag
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b5f70a8f-ea63-4a04-9ca8-40f1085773e2
  modified: 2026-07-22T17:40:30.310Z
---

## Drift: CIC Artifact Design System Omission

**Pattern:** Generated setup guide + cheat sheet for CIC Vision Subsystem both shipped without Cast Iron Charlie design application.

**Why:** Treated as functional/reference doc, not branded artifact. Missed that all CIC outputs require design system conformance.

**How to apply:** Before shipping any CIC-prefixed artifact (CIC-Vision, CIC-Ingestion, CIC-Governance output), verify:
- Markdown files in docs/cic-*/ inherit grave tone + clear hierarchy
- HTML/Artifact versions apply Cast Iron Charlie palette (ember/rust/brass)
- Contrast + typography follow CIC Design System Preference

**Related:** [[cic-design-system-preference]], [[drift-2026-07-14-cic-design-enforcement]]
