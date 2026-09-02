---
name: drift-incident-2026-07-13-dashboard
description: "DRIFT-2026-07-13-001: Dashboard design system violation — built with cool blue palette instead of Cast Iron Charlie ember/brass/iron. Skipped pre-publish checklist."
metadata: 
  node_type: memory
  type: project
  date: 2026-07-13
  severity: high
  status: fixed
  originSessionId: f069dbee-d913-47fe-a7cd-a60531c75062
---

# DRIFT-2026-07-13-001: Dashboard Design System Violation

**Incident:** Built v1.5.0 dashboard with cool blue palette (slate/sky), system fonts, border-radius, emoji — violating Cast Iron Charlie design system.

**Root Cause:** Skipped design compliance check before implementation. Did not reference `cast-iron-charlie-design-system.md` before writing CSS.

**Impact:** Published dashboard (v1.5.0 tag) non-compliant with organizational design system. User caught it immediately ("cool looking but you drifted and broke color guidelines").

**Fix Applied:** Rewrote dashboard CSS to conform to Cast Iron Charlie:
- **Colors:** Warm palette (#0a0806 black, #1a1410 forge, #C4501A ember, #B8922A brass, #8B3A1A rust)
- **Typography:** Playfair Display (headings), Libre Baskerville (body), Barlow Condensed (labels/UI)
- **Visual:** No border-radius (sharp corners), no emoji, film grain overlay, gradient dividers, em-dash labels
- **Code:** Removed inline styles, added CSS classes, proper `type="button"` attributes
- **Commit:** 3f71447 (design system fixes), tagged v1.5.1 (patch)

**Prevention:** Use Pre-Artifact Checklist before any visual artifact:
- [ ] Design system required? (yes for all CIC artifacts)
- [ ] System documented? (reference cast-iron-charlie-design-system.md)
- [ ] All visual choices conform? (palette, typography, spacing, icons, borders)
- [ ] Fonts loaded? (Google Fonts or inline)
- [ ] Film grain + gradient rules? (if applicable to artifact type)

**Lesson:** Design systems are not optional. Check memory for `cast-iron-charlie-design-system.md` BEFORE writing visual code, not after.
