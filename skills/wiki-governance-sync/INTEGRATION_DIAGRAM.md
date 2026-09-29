# wiki-governance-sync Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OBSIDIAN GOVERNANCE & SYNC                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Target Repositories & Knowledge Bases                              │
│  ─────────────────────────────────────                              │
│  • C:\dev\kb-sync\obsidian\vault\wiki                               │
│  • Primary Architecture Graph [[Index]]                             │
│  • Log Audit Trail [[Log]]                                          │
│  • Active Conventions [[wiki-schema]]                                │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Toolforge Skill: wiki-governance-sync                              │
│  ─────────────────────────────────────                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ handler(action: "audit" | "sync" | "archive")                │  │
│  │                                                              │  │
│  │ ┌─ ACTION: AUDIT ────────────────────────────────────────┐  │  │
│  │ │ • Validate naming conventions (no unescaped spaces)    │  │  │
│  │ │ • Validate frontmatter tag formatting                  │  │  │
│  │ │ • Detect broken/empty wikilinks                        │  │  │
│  │ │ • Return findings list & counts                        │  │  │
│  │ └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │ ┌─ ACTION: SYNC ─────────────────────────────────────────┐  │  │
│  │ │ • Align cross-repo link anchors                        │  │  │
│  │ │ • Apply auto-remediations if enabled                   │  │  │
│  │ └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
    ┌──────────────┐                        ┌──────────────┐
    │ Audit Report │                        │ Remediated   │
    │ Log          │                        │ Vault State  │
    └──────────────┘                        └──────────────┘
```
