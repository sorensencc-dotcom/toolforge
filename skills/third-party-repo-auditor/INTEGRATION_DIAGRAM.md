# Third-Party Repository Auditor — Integration Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Third-Party Git Repository Upstream Audit Pipeline      │
└─────────────────────────────────────────────────────────┘

Workspace Checkouts             Git Network Remotes
       │                                │
       ├──[dev-sandbox/open-notebook]───┼────> git fetch origin (lfnovo/open-notebook)
       ├──[graft/context-graph-engine]──┼────> git fetch origin (NanoNets/context-graph-engine)
       ├──[kb-sync/notebooklm-mcp-cli]──┼────> git fetch origin (jacob-bd/notebooklm-mcp-cli)
       ├──[notebooklm-py]───────────────┼────> git fetch origin (teng-lin/notebooklm-py)
       └──[markitdown]──────────────────┼────> git fetch origin (microsoft/markitdown)
                                        │
                                        ▼
                               Ref Analysis Engine
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        Commit Behind/Ahead Deltas             Latest Upstream Release Tags
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                           Status Classification & Table
                                        │
                                        ▼
                            Interactive Terminal / JSON
```

## Dependencies

- Git CLI (`git`)
- PowerShell 7+ (`pwsh`)

## Inputs

- Configured repository array: `C:\dev\dev-sandbox\open-notebook`, `C:\dev\graft\context-graph-engine`, `C:\dev\kb-sync\notebooklm-mcp-cli`, etc.
- Optional `-Fetch` switch (defaults to `$true`).

## Outputs

- Terminal table report showing Repository, Status, Behind, Ahead, LatestTag, DirtyFiles, Commit SHA.
- Structured JSON output when `-Json` flag is passed.
