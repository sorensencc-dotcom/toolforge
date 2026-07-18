# Skill Security Auditor

Static analysis security scanner for AI agent skills before installation.

**Status**: Ready to Use  
**Version**: 1.0.0  
**Runtime**: Python 3.8+

---

## What it does

- Detects command injection, code execution, and network exfiltration
- Scans for credential harvesting and prompt injection patterns
- Checks dependency supply chain risks (typosquatting, unpinned versions)
- Produces PASS/WARN/FAIL verdict with remediation guidance

---

## Quick Start

```bash
python src/skill_security_auditor.py C:\dev\toolforge\skills\kb-sync-nightly

# JSON output with strict mode
python src/skill_security_auditor.py /path/to/skill --json --strict
```

---

## Setup & Requirements

See [Skill Operator Guide — Setup](../../docs/meta/skill-operator-guide.md#setup--installation).

This skill requires:

- Python 3.8+ (no external dependencies)
- Read access to skill directory or git repo

---

## Integration

See [SKILL.md](./SKILL.md) for input/output schema and error codes.

---

## Reference

→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md) for Setup, Requirements, Error Handling.

For scanning categories, audit workflow, advanced usage:

**→ See [docs/USAGE.md](./docs/USAGE.md)**
