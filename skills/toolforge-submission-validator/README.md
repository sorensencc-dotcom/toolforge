# Toolforge Submission Validator

Validates skill submissions against marketplace conformance gate.

## Quick Start

```bash
npm run validate -- ./skills/my-plugin
```

## What it does

- Validates SKILL.json manifest (required fields, enum values, semver)
- Checks tests directory and test script presence
- Verifies documentation completeness (Purpose, Usage, Permissions sections)
- Scans governance alignment (naming, owner, no unsafe code patterns)
- Returns ConformanceReport with blockers and approve/hold/reject recommendation
- Flags all submissions for manual Tier 1 caveman review

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For conformance check details, recommendation logic:** See [docs/USAGE.md](docs/USAGE.md).
