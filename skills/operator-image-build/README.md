# Operator Image Build

Deterministic Docker build, tag, push, verify for harness-v3 and onnx-sidecar.

## Quick Start

```bash
npm start -- --action all
npm start -- --action build --workdir /cic
npm start -- --action all --dry-run
```

## What it does

- **Build** — Multi-stage Dockerfiles with deterministic layer hashes (SOURCE_DATE_EPOCH)
- **Tag** — Apply registry prefix and version tags
- **Push** — Upload to registry with verification
- **Verify** — Curl registry catalog, confirm images present
- **Import** — Air-gapped node-local import via ctr

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For CLI usage, programmatic API, and troubleshooting:** See [docs/USAGE.md](docs/USAGE.md).
