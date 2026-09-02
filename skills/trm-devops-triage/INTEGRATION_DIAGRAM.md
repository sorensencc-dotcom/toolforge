# trm-devops-triage — Integration Diagram

```
User / Claude / Agent ("trm triage" / "status")
        |
        | npx trm-devops <sync|prune|status>
        v
trm-devops-triage (node/typescript)
        |
        |-- sync     -> drains .cache/pending-sync/ & reconciles dev/triage/queue.md
        |-- status   -> parses queue.md and reports active vs resolved counts
        |-- prune    -> moves RESOLVED to archive/ & deletes remote NotebookLM sources
        v
dev/triage/queue.md + dev/triage/archive/
```
