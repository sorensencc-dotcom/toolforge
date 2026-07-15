# Skill Security Auditor — Quick Reference

**Status:** Ready to Use  
**Version:** 1.0.0  
**Location:** `C:\dev\toolforge\skills\skill-security-auditor`

---

## One-Minute Start

Execute a static analysis security scan on any Toolforge skill directory:

```bash
# Run using the python interpreter directly
python src/skill_security_auditor.py C:\dev\toolforge\skills\kb-sync-nightly
```

Or execute globally from `C:\dev`:
```bash
python C:\dev\skill-security-auditor.py C:\dev\toolforge
```

---

## What It Does

The scanner analyzes Python, Shell, Javascript, TypeScript, and Markdown files looking for security vulnerabilities across 5 vectors:
1. **Command Injection**: Detects `os.system`, `subprocess` with `shell=True`, and unescaped inputs.
2. **Code Execution**: Detects dynamic code execution via `eval()`, `exec()`, or `new Function()`.
3. **Data Exfiltration**: Detects outbound HTTP requests (`requests`, `socket`, `fetch`, `axios`) that could leak credentials.
4. **Privilege Escalation**: Detects attempts to adjust file system permissions (`chmod 777`) or use `sudo`.
5. **Prompt Injection**: Detects system instructions hijack patterns in Markdown files.

---

## Verdict Categories

- **✅ PASS**: Safe to deploy.
- **⚠️ WARN**: Potential issues (like hardcoded URLs or external dependencies) that should be manually verified.
- **❌ FAIL**: Critical security vulnerability detected. Intentionally exits with status 1.

---

## Troubleshooting

### Error: "python3 not found"
Ensure Python 3.8+ is installed on your host system and is available in your PATH environment.
