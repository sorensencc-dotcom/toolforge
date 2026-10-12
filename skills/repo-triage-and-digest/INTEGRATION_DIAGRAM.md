# Repo Triage and Digest - Integration Diagram

**Status: IMPLEMENTED**

```
GitHub URL (owner/repo)
      |
      | gitdiagram_triage
      v
gitdiagram.com/owner/repo
gitdiagram.com/owner/repo/videos
      |
      | operator picks directories
      v
gitingest_digest
      |
      +-- remote: gitingest.com URL only (content stays null)
      |
      +-- localRoot: keep include patterns
      |       drop tests, docs, lockfiles, binaries
      |       drop files over 50 kB
      |
      v
MCP stdio JSON-RPC
gitdiagram_triage | gitingest_digest | triage_and_digest
      |
      v
Any model client
auth token counted, never stored, never returned
```
