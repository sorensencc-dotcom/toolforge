# scale-ingestion-service

Adjust RL ingestion service worker count based on queue backlog.

---

## Quick Start

```bash
scale-ingestion-service
```

---

## What it does

- Monitors ingestion queue depth and recommends worker scaling
- Scales workers automatically based on queue backlog (2–8 workers)
- Reports current state and deployment time

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

For detailed workflow and examples: See [SKILL.md](./SKILL.md).
