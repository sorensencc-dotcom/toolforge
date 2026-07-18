# Roadmap Validator

Validates ROADMAP.md files for sync markers, format, and content integrity.

## Quick Start

```bash
./run-tool.ps1 -Run roadmap-validator -Input '{"roadmapPath":"C:\\dev\\cic\\ROADMAP.md"}'
```

## What it does

- Verifies sync marker presence (`<!-- SYNC:TOOLFORGE -->` / `<!-- END:SYNC -->`)
- Checks markdown structure and content integrity
- Supports permissive (pass with warnings) and strict modes
- Detailed findings with error codes and remediation hints

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).

**For complete usage guide:** See [docs/USAGE.md](docs/USAGE.md).
