# TRM Status

Instant status table across every TRM research topic in `trm-vault` — no manual directory crawl.

## Usage

```bash
npm test
npx ts-node src/index.ts C:\Users\soren\trm-vault
```

## Overview

- Walks `trm-vault/topics/**` for leaf topics (has `topic.json` + `sources/`)
- Counts sources/extracts, detects unfinished `_staging-batch*` dirs, flags extract lag and staleness
- Flags uncommitted files per topic via `git status --porcelain`
- New topics with zero sources report as `stub` — expected placeholder state, not a problem

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For detailed workflow:** See [docs/USAGE.md](docs/USAGE.md).
