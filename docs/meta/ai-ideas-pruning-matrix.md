# AI-Ideas Redundancy Audit & Pruning Matrix

> **Notebook Target:** `AI-Ideas` (`39a71593-eb5b-4605-a4a4-f212ae010da2`)  
> **Policy Status:** Active Enforcement  
> **Last Audit:** 2026-09-13T20:00:00Z  

---

## 1. Tool Adoption & Pruning Disposition

The following tools and repositories have progressed from exploratory concepts into codified, production-grade components within the local workspace. In accordance with the knowledge plane partitioning invariants, exploratory bookmarks and speculative media links must be pruned from the `AI-Ideas` notebook:

| Tool / Repository | Current Status in Architecture | Action in AI-Ideas (`39a71593...`) | Canonical Destination |
|---|---|---|---|
| **Herdr** (`ogulcancelik/herdr`) | Adopted as terminal multiplexer; integrated into Toolforge (`feat/toolforge-herdr-tr...`) and ICF matrix. | **Prune / Remove** speculative video & article links. | ICF / Toolforge production specs & `Agent Harness Registry` (`359b346c-6af7-4ba3-baef-b985c9e6e1af`). |
| **Graft** (`NanoNets/Graft`, `trailhq/Graft`) | Fully adopted into local developer harnesses; CPU usage optimization specs documented in CIC-KB. | **Prune / Remove** from AI-Ideas. | `Agent Harnesses & Local Execution` (`359b346c-6af7-4ba3-baef-b985c9e6e1af`) & `graft/`. |
| **SAM** (`google/sam`) | Adopted for Sovereign Agent Mesh comparisons; referenced in central architecture guide. | **Prune / Remove** general YouTube intros. | `Agent Harnesses & Local Execution` & `docs/contracts/`. |
| **Ecosystem Architecture Guide** | Uploaded as markdown file inside AI-Ideas (`sourceId: afcbc90b...`). | **Remove Source Immediately** (eliminates circular self-reference). | `docs/Ecosystem Architecture Guide (Current).md`. |
| **ECC** (`affaan-m/ECC`) & **Claude Code Hooks** | Codified in local `.claude/` hooks and Advanced Artifact Interfaces. | **Consolidate** into technical harness docs. | `Agent Harnesses & Local Execution` & `.claude/hooks`. |
| **Repomix** (`yamadashy/repomix`) | Integrated into kb-sync and daily packaging workflows. | **Prune / Remove** intake bookmarks. | `kb-sync/` ingestion pipeline & Toolforge utilities. |

---

## 2. Operational Pruning Rule

```
                               OPERATIONAL PRUNING RULE
+-----------------------------------------------------------------------------------+
|  IF a tool or framework satisfies ANY of the following criteria:                   |
|    1. Has an active Git branch or directory under C:\dev                         |
|    2. Runs as an active service under helix/icf or local background daemons       |
|    3. Is codified in Section 1 of Ecosystem Architecture Guide (Current).md       |
|                                                                                   |
|  THEN:                                                                            |
|    - It is PERMANENTLY RETIRED and PRUNED from the AI-Ideas notebook.            |
|    - AI-Ideas is reserved STRICTLY for unvetted prototypes and conceptual intake. |
+-----------------------------------------------------------------------------------+
```

### Pruning Execution Steps
1. Query sources in `AI-Ideas` (`39a71593-eb5b-4605-a4a4-f212ae010da2`):
   ```bash
   nlm source list "39a71593-eb5b-4605-a4a4-f212ae010da2" --json
   ```
2. Identify and purge source IDs matching adopted tools (`Herdr`, `Graft`, `SAM`, `ECC`, `Repomix`, `Ecosystem Architecture Guide`).
3. Retain unvetted exploratory notes only.
