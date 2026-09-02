---
name: cast-iron-charlie-design-system
description: "Design system for grave, literary, archival tone artifacts — Playfair/Baskerville/Barlow type, ember/rust/brass palette, zero border-radius, film grain"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0547e723-ba1b-434f-bf82-37e8f88c2262
---

# Cast Iron Charlie Design System

Formal, serious design system for governance, policy, historical, and archival content. Grave, literary, declarative tone as if subject deserves historical documentation.

## Voice & Tone

- **Gravity:** Treat subject seriously; documentary narration tone
- **Patterns:** Em-dash pauses ("Denmark sent him. America forgot him"), parallel construction, understatement, declarative verbs
- **Casing:** Section labels ALL CAPS with wide letter-spacing (0.2–0.4em); body sentence/title case; no emoji, no exclamation marks
- **Person:** Third person for content; second person (imperative) for CTAs; first-person plural (sparse)
- **No emoji anywhere.** Ever.

## Colors (Dark Warm Industrial Palette)

```
--black:     #0a0806    (primary background)
--forge:     #1a1410    (secondary background)
--iron:      #2c2420    (tertiary/raised surfaces)
--rust:      #8B3A1A    (hover/subtle accent)
--ember:     #C4501A    (PRIMARY accent — labels, borders, CTAs)
--brass:     #B8922A    (secondary accent — logo, italics, prestige)
--ash:       #9a9088    (secondary text, muted UI)
--bone:      #e8e0d4    (body text, primary readable)
--paper:     #f2ece2    (lightest warm white, rare)
--white:     #faf6f0    (headings on dark, hero title)
```

**Philosophy:** Ember is the only vivid accent. Brass reserved for brand/logo. Rest are desaturated browns, rust, ash — forge/iron aesthetic.

## Typography (3 Google Fonts)

1. **Playfair Display** (serif display) — Weights 400, 700, 900 + italic
   - All major headings, H1–H4, pull quotes, act titles, hero title
   - Second line of hero can be `font-style: italic + color: var(--brass)` for prestige

2. **Libre Baskerville** (serif body) — Weights 400, 700 + italic 400
   - All body copy, form inputs, serious reading
   - Grounded, readable, literary

3. **Barlow Condensed** (sans label/UI) — Weights 300, 400, 600, 700, 800
   - ALL navigation, ALL section labels/eyebrows, ALL CTAs, stat numbers, metadata
   - Always uppercase with letter-spacing: 0.2–0.4em (utility layer)

## Visual Elements

- **No border-radius anywhere.** Zero. Sharp corners only. Distinctive trait.
- **Film grain overlay:** SVG fractalNoise filter at opacity 0.4 on `body::before`
- **Ghost text backgrounds:** Section headers with oversized `::before` pseudo-elements (e.g., "ARCHIVE") at near-invisible opacity `rgba(139,58,26,0.04)`
- **Gradient rules:** Horizontal dividers fade in/out — `linear-gradient(to right, transparent, rgba(139,58,26,0.4), transparent)`
- **Image filters:** `sepia(20%) contrast(1.05) brightness(0.9)` — warm, period-appropriate
- **Photo treatment:** Object-position center 30% (crops to upper third), captions in Barlow Condensed 0.65rem uppercase

## Cards & Surfaces

- **Idle state:** `border: 1px solid rgba(154,144,136,0.12)` (barely visible)
- **Hover state:** `border-color: rgba(196,80,26,0.4)` (ember tint appears)
- **Card backgrounds:** `rgba(26,20,16,0.6)` (forge color at 60%)
- **No box-shadow.** Differentiate via border + background only.

## Spacing

- Section container: `max-width: 1100px; padding: 7rem 4rem`
- Mobile: `padding: 5rem 2rem`
- Card gaps: `1.5rem` tight grid, `5–6rem` editorial grid

## Animations

- **Entry:** fadeUp (opacity 0→1, translateY 30→0, 1s ease), staggered 0.3s
- **Scroll indicator:** scrollPulse (opacity 0.4→1→0.4, 2s infinite)
- **Hover transitions:** 0.2–0.3s ease (never spring/bounce)
- **CTA press:** `transform: translateY(-2px)` (subtle lift, not scale)
- **Image hover:** `scale(1.04–1.05)` with 0.5s ease (slow, cinematic)

## Navigation

- Fixed, full-width top with `background: linear-gradient(to bottom, rgba(10,8,6,0.95), transparent)`
- On scroll: `.scrolled` class adds `background: rgba(10,8,6,0.97)` (solid)
- Logo: Barlow Condensed 800, letter-spacing 0.25em, brass color
- Links: Barlow Condensed 400, 0.8rem, letter-spacing 0.2em, ash→white on hover
- Mobile: hamburger overlay drawer with 1.6rem links

## No Iconography

Design intentionally avoids icon fonts, SVG icons, emoji, PNG icons. Communicates via typography, color, space.

- **Bullets:** Em-dash (—) only
- **Links/CTAs:** Arrow character (→) in text
- **Scroll indicator:** Pure CSS line, no icon
- **Hamburger:** CSS morphing spans, no SVG
- **Status badges:** Bullet character (●) in color + text

This is a deliberate aesthetic choice. No substitutions needed.

## Example Classes (for new artifacts)

```css
.module-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--rust);
  font-weight: 700;
}

.scenario {
  border-left: 3px solid var(--ember);
  background: rgba(44, 36, 32, 0.4);
  border: 1px solid rgba(196, 80, 26, 0.15);
}

.alert.critical {
  border-left-color: var(--ember);
  background: rgba(196, 80, 26, 0.08);
}

code {
  background: rgba(44, 36, 32, 0.8);
  color: var(--brass);
  border-left: 2px solid var(--ember);
}
```

## Quick Checklist for New Artifacts

- [ ] Load Google Fonts (Playfair Display, Libre Baskerville, Barlow Condensed)
- [ ] Define CSS custom properties (--black, --ember, --brass, etc.)
- [ ] Apply film grain via SVG fractalNoise on body::before
- [ ] Use Playfair for all headings
- [ ] Use Barlow Condensed for labels/nav/CTAs (ALL CAPS, letter-spacing 0.2–0.4em)
- [ ] Zero border-radius everywhere
- [ ] Em-dash as bullet (::before { content: '—' })
- [ ] Arrow for CTAs (::after { content: ' →' })
- [ ] Gradient horizontal rules (not plain <hr>)
- [ ] No emoji, no exclamation marks
- [ ] Hover: color transition 0.2–0.3s ease
- [ ] Cards: subtle border + dark background, ember on hover
- [ ] Section labels: Barlow Condensed, uppercase, rust color, ::after gradient underline
