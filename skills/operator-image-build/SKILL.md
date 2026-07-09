---
skill_name: operator-image-build
version: 1.0.0
name: Operator Image Build
category: pipeline
description: Deterministic Docker image build, tag, push, and verification for harness-v3 and onnx-sidecar. Sealed layer hashes, registry validation, node-local air-gapped import support.
author: unknown
tags: []
---
# Operator Image Build — Docker Image Builder for CIC Systems

**Status: ACTIVE**  
**Version: 1.0.0**  
**Category: automation**  
**Owner: Soren**

---

## Purpose

Builds and manages Docker images for CIC ingestion, runtime, and operator environments. Multi-stage builds with deterministic layering.

## Features

- Multi-stage builds (compile, test, package)
- Deterministic layer caching
- Security scanning pre-push
- Registry push with tag management
- Rollback support

## Inputs

```
image: string           # Image name (cic-ingestion, cic-runtime, etc.)
tag: string            # Image tag (commit sha, version, etc.)
registry: string       # Registry URL
push: boolean          # Push to registry after build
verify: boolean        # Run security scan
```

## Outputs

```
{
  status: "ok" | "error",
  image: string,
  tag: string,
  digest: string,
  pushed: boolean,
  scanResults?: object
}
```

## Build Stages

1. **Builder**: Compile TypeScript, run linters
2. **Tester**: Run test suite, coverage report
3. **Packager**: Bundle runtime, copy artifacts
4. **Release**: Final image with minimal footprint

## Exit Codes

- 0: Build success
- 1: Build failure
- 2: Security scan warning

---

See README.md for CLI usage and docs/USAGE.md for workflows.


