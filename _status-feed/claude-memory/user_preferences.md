---
name: full_file_paths_in_commands
description: User prefers all file paths in commands to be full/absolute paths
metadata: 
  node_type: memory
  type: feedback
  originSessionId: de5328ec-1d8f-4151-8365-e3397df5904a
---

User preference: Always provide full file paths in command examples. Don't use relative paths or shortened versions. Full paths are clearer and easier to copy-paste.

Example:
- ✅ `docker-compose -f C:\dev\monitoring\docker-compose.yml up -d`
- ❌ `docker-compose -f monitoring/docker-compose.yml up -d`
