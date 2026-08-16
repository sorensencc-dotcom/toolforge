---
name: feedback_docker_wsl_approach
description: "Docker on Windows — Use PowerShell directly, not bash in WSL, due to socket connectivity"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: af9b13d6-bfea-4543-9aa6-409d0298c2a8
---

## Docker Commands on Windows: PowerShell > WSL Bash

**Rule:** When running docker commands on Windows, invoke from PowerShell directly. Do not rely on bash inside WSL.

**Why:** WSL bash cannot reach Docker Desktop's socket (`/var/run/docker.sock`). Even with proper configuration, PowerShell is more reliable and has native docker support. Bash scripts that call docker fail on Windows with "failed to connect to docker API" errors.

**How to Apply:**
- In Phase 0.9, switched from bash script (`phase-0-9-milestone-1.sh`) to inline PowerShell `docker build` commands
- When scripting docker on Windows, use PowerShell exclusively or use docker-compose from cmd/PowerShell
- If bash scripts are needed, run them inside a Docker container where the daemon is available
- For cross-platform scripts, embed docker commands in PowerShell wrapper on Windows, bash wrapper on Linux

**Related patterns:**
- Don't use `grep` in PowerShell — use `Where-Object` or `Select-String` instead
- Docker Desktop runs natively on Windows; no WSL socket exposure needed for interactive commands
