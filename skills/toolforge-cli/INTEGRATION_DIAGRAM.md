# Toolforge CLI — Integration Diagram

**Status: IMPLEMENTED**

```
operator / agent
      |
      | pwsh src/cli.ps1 -Command list|install|submit
      v
toolforge-cli (powershell)
      |
      +-- list/install --> toolforge-registry-manager (src/registry.ps1)
      |                         |
      |                         v
      |                 docs/toolforge/registry.json
      |
      +-- submit --------> toolforge-submission-validator (src/validate.ts)
                                |
                                v
                        ConformanceReport JSON
```
