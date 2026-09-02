# run-adapter-diagnostic

Check adapter health, latency percentiles, and error rates in real time.

## Quick Start

```bash
run-adapter-diagnostic BrowserNavigate 1h
```

## What it does

- Reports success rate, latency percentiles (p50/p95/p99), and error rate
- Compares metrics against SLA targets (>99% success, p95 <100ms, <5% errors)
- Returns recent error samples and health indicators
- Supports arbitrary time windows (5m, 1h, 24h)

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
