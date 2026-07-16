---
skill_name: toolforge-submission-validator
version: 0.1.0
name: Toolforge Submission Validator
category: governance
description: Validates skill submissions against conformance gate (manifest, tests, docs, governance, caveman review)
author: soren
tags: ["validation", "conformance", "toolforge", "marketplace"]
---
# Toolforge Submission Validator

Validates a skill submission against the Toolforge Marketplace conformance
gate before it reaches caveman review / Tier 1 approval.

## Metadata

- **ID:** toolforge-submission-validator
- **Version:** 0.1.0
- **Category:** governance
- **Runtime:** node
- **Entrypoint:** src/validate.ts

## Usage

```bash
npm run validate -- <skill-path>
```

Returns a ConformanceReport JSON (`manifest_valid`, `tests_pass`,
`docs_complete`, `governance_aligned`, `caveman_review`) with an
approve/hold/reject recommendation. See `README.md` for the full check list.
