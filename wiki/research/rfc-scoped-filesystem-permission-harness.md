---
title: "RFC: Scoped Filesystem Permission Harness for Autonomous Agent Workspaces"
category: "research"
topic: "rfc-scoped-filesystem-permission-harness"
gap_id: "act-01-scoped-filesystem-permission-harness"
status: "draft"
created_at: "2026-10-04T15:25:00.000Z"
assigned_tier: "Tier 1 (Judgment)"
routed_model: "gemini-3.7-flash"
router_confidence: 0.95
author: "sorensencc-dotcom"
source: "mobile-gemini-gdoc"
tracking_issue: null
citations:
  - "scripts/scoped-filesystem-permission-harness.mjs"
  - "scripts/worktree-safety-gate.mjs"
  - "tests/scoped-filesystem-permission-harness.test.mjs"
---

# RFC: Scoped filesystem permission harness for autonomous agent workspaces

## 1. Problem statement and threat vector analysis

Autonomous coding agents and subagents execute tool calls (e.g., file reads, code replacements, deletions, script runs) across local workspaces. Unconstrained tool execution introduces four primary threat vectors:

1. **Host root & credential exfiltration**: Agent tools reading files outside the active git repository (e.g., `C:\Windows\System32`, `~/.ssh/id_rsa`, `~/.aws/credentials`, `.env.production`).
2. **Path traversal & canonicalization bypasses**: Attackers or hallucinated commands employing null-byte truncation (`\0`), URL encoding (`%2e%2e`), relative traversals (`..\..\`), or Windows Alternate Data Streams (`file.txt::$DATA`, `file.txt:Zone.Identifier`).
3. **Privilege escalation & boundary leakage**: Read-only research agents mutating core production source files or altering `.git/config` and `.git/hooks` configurations.
4. **Temporary workspace contamination**: Uncontained scratch files polluting canonical source trees instead of ephemeral `scratch/` directories.

To establish zero-trust execution boundaries, Toolforge requires an explicit capability harness that intercepts all filesystem operations before disk I/O.

---

## 2. Capability model and permission matrix

```
+-------------------------------------------------------------------------------+
|                       Agent Tool Call / MCP Invocation                        |
|               (view_file, write_to_file, replace_file_content)                |
+---------------------------------------+---------------------------------------+
                                        | Target path & operation
                                        v
+-------------------------------------------------------------------------------+
|                  Scoped Filesystem Permission Harness (Preflight)             |
|                                                                               |
|  1. Path Canonicalizer           : Strip nulls, decode URLs, normalize drives |
|  2. Critical System Denial Check : Block C:\Windows, ~/.ssh, ~/.aws, .git/    |
|  3. Workspace Containment Jail   : Enforce target is subpath of allowedRoots  |
|  4. Capability Rule Validation   : Check operation against granted capability |
+-------------------+-------------------+-------------------+-------------------+
                    |                   |                   |
         Policy Check: ALLOWED          | Policy Check: BLOCKED
                    v                   v
+-----------------------------------+   +---------------------------------------+
|        Execute Disk Operation     |   |         Emit Fail-Closed Error        |
|  Read / Write / Delete in Sandbox |   |  Log Structured Violation Code to PR  |
+-----------------------------------+   +---------------------------------------+
```

### 2.1 Capability permission hierarchy

| Capability Level | Allowed Operations | Permitted Path Scope | Denied Path Scope |
| :--- | :--- | :--- | :--- |
| **`read-only`** | `read` | `allowedRoots` | All mutations (`write`, `delete`), host system directories |
| **`isolated-tmp`** | `read`, `write`, `delete` | `scratch/`, `.tmp/` | Source code files, configuration manifests, system directories |
| **`workspace-mutate`** | `read`, `write`, `delete` | `allowedRoots` (Workspace) | Sensitive credentials (`.ssh`, `.aws`, `.env`), system paths |
| **`system-denied`** | *None* | *None* | `C:\Windows`, `/etc`, `~/.ssh`, `~/.aws`, `.git/config` |

---

## 3. Implementation verification and benchmark results

The permission harness is implemented in [`scripts/scoped-filesystem-permission-harness.mjs`](file:///C:/dev/scripts/scoped-filesystem-permission-harness.mjs) and verified via [`tests/scoped-filesystem-permission-harness.test.mjs`](file:///C:/dev/tests/scoped-filesystem-permission-harness.test.mjs).

### Test execution summary
- **Traversal neutralization**: Detects and neutralizes relative escaping (`../../secrets.txt`), URL-encoded traversal (`%2e%2e`), and null-byte injections in $< 1\text{ ms}$.
- **Stream injection protection**: Blocks NTFS Alternate Data Streams (`::$DATA`, `:Zone.Identifier`) before path resolution.
- **Capability boundary enforcement**: Verified fail-closed behavior when `write` operations are attempted in `read-only` contexts.
- **Credential shielding**: Verified immediate blocking on access attempts to `~/.ssh/id_rsa`, `~/.aws/credentials`, and `.git/config`.

---

## 4. Operational instructions

1. To test a path against the permission harness via CLI, run:
   ```bash
   node scripts/scoped-filesystem-permission-harness.mjs "C:/dev/docs/README.md" "write" "read-only"
   ```
2. To run the automated verification suite, execute:
   ```bash
   node --test tests/scoped-filesystem-permission-harness.test.mjs
   ```
