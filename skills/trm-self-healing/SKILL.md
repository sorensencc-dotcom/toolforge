---
name: trm-self-healing
description: DevOps self-healing triage, research escalation, and Sigil biometric guard skills
runtime: javascript
---

# TRM Self Healing

DevOps diagnostic and self-healing triage skills for Herdr and TRM fleets.

## Capabilities

- **Tier-1 Triage**: Fast local signature matching and TinyFish search fallback.
- **Tier-2 Escalation**: Deep research escalation via Parallel Task API.
- **Sigil Guard**: Local biometric verification gate over loopback socket.

## Usage

```bash
node skills/trm-self-healing/src/index.mjs
```
