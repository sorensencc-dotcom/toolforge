# trm-status — Integration Diagram

```
User / Claude ("what are all our trms")
        |
        | npx ts-node src/index.ts <vaultRoot>
        v
trm-status (node)
        |
        |-- findAllTopics(vaultRoot)        -> fs walk of trm-vault/topics/**
        |-- scanTopicDir(dir) x N           -> per-topic counts, staging dirs
        |-- deriveStatus(stats)             -> state classification
        |-- attachGitInfo(vaultRoot, ...)   -> git status --porcelain per topic
        v
renderTable(statuses) -> tab-separated status table (stdout)
```
