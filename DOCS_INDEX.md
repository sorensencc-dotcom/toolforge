# Toolforge docs - start here

Welcome. This is the root entry point for Toolforge documentation on this machine.

## Toolforge root note

The Toolforge workspace root is **`C:\dev`**.  
`manifest.json`, `run-tool.ps1`, `Home.md`, and the other platform files live there.

**There is no root-level `toolforge` folder** (that path does not exist as the repo). You may still see a `\toolforge\` path segment inside archives, clones, or drift heuristics - those mean nested layout copies, not "cd into a root-level toolforge folder".

---

## Full documentation map

For the current hub index (tree, 18 utility docs, daemons, sync-tools, meta, reports, and honest "what's on disk" notes), use:

**[docs/DOCS_INDEX.md](docs/DOCS_INDEX.md)**

That file was refreshed **2026-09-07** and is the day-to-day map. Prefer it over any older five-tool snapshot.

---

## Key files at the repo root (`C:\dev`)

| File | What it is |
|---|---|
| [Home.md](Home.md) | Platform overview |
| [GOVERNANCE.md](GOVERNANCE.md) | Tool standards and registration rules |
| [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md) | How to run and operate tools |
| [OPERATOR-COMMANDS.md](OPERATOR-COMMANDS.md) | Quick command cheat sheet |
| [TOOL_CREATION_GUIDE.md](TOOL_CREATION_GUIDE.md) | How to add a new tool |
| [manifest.json](manifest.json) | Machine-readable skill / tool registry |
| [run-tool.ps1](run-tool.ps1) | CLI runner (`-List`, `-Inspect`, `-Run`) |
| [INDEX.md](INDEX.md) | Generated / staging index (check contents; not always a pure tool catalog) |
| [AUTOMATION-SETUP.md](AUTOMATION-SETUP.md) | CI / hooks / orchestrator notes |

Classic per-tool writeups live under [`docs/`](docs/) (`utilities/`, `daemons/`, `sync-tools/`, plus `meta/`, `gateway/`, and more).

---

## Quick discovery

```powershell
cd C:\dev
.\run-tool.ps1 -List
.\run-tool.ps1 -Inspect <toolName>
```

Skill inventory from the manifest:

```powershell
Get-Content C:\dev\manifest.json | ConvertFrom-Json | Select-Object -ExpandProperty skills
```

---

## See also

- [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md) - full local docs map
- [docs/meta/README.md](docs/meta/README.md) - governance / phases / specs / plans
- Previous root index body (pre-rewrite): [DOCS_INDEX.md.bak](DOCS_INDEX.md.bak)

---

*Root entry point rewritten 2026-09-07. Canonical detailed index: `docs/DOCS_INDEX.md`.*