# Skill Security Auditor — Integration Diagram

**Status: IMPLEMENTED**

```
Toolforge Universal Runner (run-tool.ps1)
        |
        | invokes src/skill_security_auditor.py
        v
skill-security-auditor (python)
        |
        +---> scans .py, .js, .mjs, .ts, .sh, .ps1, .md
        |
        v
outputs findings + exit code
```
