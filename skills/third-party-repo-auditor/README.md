# Third-Party Repository Auditor

Audits external third-party Git repositories within the workspace against upstream remotes.

## Quick Start

Run an interactive audit across all workspace third-party checkouts:

```powershell
pwsh -NoProfile -File C:\dev\skills\third-party-repo-auditor\src\audit.ps1
```

Or output structured JSON for automated pipelines:

```powershell
pwsh -NoProfile -File C:\dev\skills\third-party-repo-auditor\src\audit.ps1 -Json
```

## Features

- **Automated Upstream Fetch**: Pulls remote heads and tags without mutating the local working tree.
- **Commit Delta Calculation**: Computes commits ahead and behind upstream tracking branches (`origin/main`, `origin/master`).
- **Release Tag Tracking**: Identifies the latest available upstream release tags.
- **Working Tree Integrity**: Reports uncommitted or dirty file modifications.

---

For Setup, Configuration, and Testing standards:

**→ See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md)**
