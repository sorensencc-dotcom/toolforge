# Toolforge Registry Manager — Integration Diagram

**Status: IMPLEMENTED**

```
toolforge-cli / CI publish step
      |
      | pwsh src/registry.ps1 -Action add|get|list|quarantine
      v
toolforge-registry-manager (powershell)
      |
      +--> src/checksum.ps1 (sha256 verification, used by 'add')
      |
      +--> docs/toolforge/registry.json      (append-only, sole writer)
      |
      +--> docs/toolforge/registry-audit.log (one line per mutation)
```
