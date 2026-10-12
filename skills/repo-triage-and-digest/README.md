# Repo Triage and Digest

Turn a GitHub repository into a diagram link and a prompt-sized text digest.

## Quick Start

```bash
node skills/repo-triage-and-digest/src/index.mjs --url https://github.com/sorensencc-dotcom/toolforge --include "skills/*,manifest.json"
node skills/repo-triage-and-digest/src/index.mjs --mcp
```

## What it does

- Stage 1 swaps `github.com` for `gitdiagram.com` and returns the diagram and explainer links.
- Stage 2 returns a `gitingest.com` URL, or reads a local checkout when you pass `--local`.
- Files outside the include list, matching the exclude list, or larger than 50 kB stay out of the digest.
- An auth token stays in the call argument. The result records only that it was discarded.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
