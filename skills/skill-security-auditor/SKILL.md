---
name: skill-security-auditor
description: Security audit and vulnerability scanner for AI agent skills before installation. Scans for code injection, credential harvesting, network exfiltration, prompt injection, and supply chain risks. Produces PASS/WARN/FAIL verdict with remediation guidance.
compatibility: |
  - Runtime: Python 3.8+
  - Dependencies: Standard library (no external deps)
  - Permissions: read:repo, read:security-advisories
---

# Skill Security Auditor

Scan and audit AI agent skills for security risks before installation.

## Trigger

```bash
python src/skill_security_auditor.py /path/to/skill-name
python src/skill_security_auditor.py /path/to/skill-name --json --strict
```

## Input Schema

```typescript
interface SkillInput {
  skillPath: string;           // Required. Directory or git URL to audit
  strict?: boolean;            // Optional. Treat WARN as FAIL (default: false)
  json?: boolean;              // Optional. Output JSON (default: false)
  cleanup?: boolean;           // Optional. Remove temp clone after audit
}
```

## Output Schema

```typescript
interface SkillOutput {
  status: "ok" | "error";
  verdict: "PASS" | "WARN" | "FAIL";
  critical_count: number;
  high_count: number;
  info_count: number;
  findings: Array<{
    severity: "CRITICAL" | "HIGH" | "INFO";
    code: string;
    file: string;
    pattern: string;
    risk: string;
    fix: string;
  }>;
}
```

## Verdict Categories

- **✅ PASS** — No critical/high findings. Safe to deploy.
- **⚠️ WARN** — High/medium findings. Review manually before installing.
- **❌ FAIL** — Critical findings. Do NOT install without remediation.

## Scans

Analyzes Python, Shell, JavaScript, TypeScript, and Markdown files for:

- Command injection (`os.system`, `subprocess` with `shell=True`)
- Code execution (`eval()`, `exec()`)
- Network exfiltration (`requests`, `socket`, `fetch`)
- Credential harvesting (`~/.ssh`, `~/.aws`, env vars)
- Prompt injection in SKILL.md (system prompt override, role hijacking)
- File system abuse (writes outside skill dir, symlinks)
- Dependency supply chain risks (typosquatting, unpinned versions)

---

## Full Reference

For scanning details, threat model, audit workflow, advanced usage, and limitations:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**

For detailed scan categories, report interpretation, exemption policy, and CI/CD integration:

**→ See [docs/USAGE.md](./docs/USAGE.md)**
