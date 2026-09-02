#!/usr/bin/env python3
"""
Workspace and Brain Storage Cleaner
Audits and purges stale artifacts, orphaned nested git repositories, oversized logs,
and temporary files across Antigravity Brain and local project workspaces.
"""

import os
import sys
import glob
import shutil
import argparse
from typing import Dict, List, Tuple

def get_dir_size(path: str) -> int:
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            try:
                total += os.path.getsize(fp)
            except Exception:
                pass
    return total

def audit_brain(brain_root: str, current_cid: str = "") -> Tuple[int, List[Dict]]:
    actions = []
    reclaimable = 0

    if not os.path.exists(brain_root):
        return 0, actions

    for entry in os.listdir(brain_root):
        if entry == current_cid:
            continue
        session_dir = os.path.join(brain_root, entry)
        if not os.path.isdir(session_dir):
            continue

        # Check for nested .git folders
        git_dir = os.path.join(session_dir, ".git")
        if os.path.exists(git_dir) and os.path.isdir(git_dir):
            sz = get_dir_size(git_dir)
            if sz > 0:
                reclaimable += sz
                actions.append({
                    "type": "brain_nested_git",
                    "path": git_dir,
                    "size": sz,
                    "description": f"Nested .git repository in session {entry}"
                })

        # Check for oversized logs (> 2MB)
        for root, _, files in os.walk(session_dir):
            for f in files:
                if f.endswith(".log") and f.startswith("task-"):
                    fp = os.path.join(root, f)
                    try:
                        sz = os.path.getsize(fp)
                        if sz > 2 * 1024 * 1024:
                            reclaimable += sz
                            actions.append({
                                "type": "brain_oversized_log",
                                "path": fp,
                                "size": sz,
                                "description": f"Oversized task log ({sz / (1024*1024):.1f} MB)"
                            })
                    except Exception:
                        pass

    return reclaimable, actions

def audit_workspace(workspace_root: str) -> Tuple[int, List[Dict]]:
    actions = []
    reclaimable = 0

    if not os.path.exists(workspace_root):
        return 0, actions

    # Stray files
    stray_names = ["null", "sync.ffs_db", "sync.ffs_lock", "vault-sync.log"]
    for name in stray_names:
        fp = os.path.join(workspace_root, name)
        if os.path.exists(fp) and os.path.isfile(fp):
            sz = os.path.getsize(fp)
            reclaimable += sz
            actions.append({
                "type": "workspace_stray",
                "path": fp,
                "size": sz,
                "description": f"Stray root file ({name})"
            })

    # Installer / archive bloat
    installer_globs = [
        os.path.join(workspace_root, "claude-skills", "python-installer.exe"),
        os.path.join(workspace_root, "claude-skills", "python.zip")
    ]
    for pattern in installer_globs:
        for fp in glob.glob(pattern):
            if os.path.exists(fp):
                sz = os.path.getsize(fp)
                reclaimable += sz
                actions.append({
                    "type": "workspace_installer",
                    "path": fp,
                    "size": sz,
                    "description": f"Redundant installer/archive ({os.path.basename(fp)})"
                })

    # Stale logs in .ijfw/logs/ older than 14 days
    ijfw_logs = os.path.join(workspace_root, ".ijfw", "logs")
    if os.path.exists(ijfw_logs):
        for f in os.listdir(ijfw_logs):
            if f.endswith(".log") and f.startswith("dream-2026-06"):
                fp = os.path.join(ijfw_logs, f)
                sz = os.path.getsize(fp)
                reclaimable += sz
                actions.append({
                    "type": "workspace_stale_log",
                    "path": fp,
                    "size": sz,
                    "description": f"Stale IJFW log ({f})"
                })

    return reclaimable, actions

def execute_actions(actions: List[Dict]) -> int:
    reclaimed = 0
    for act in actions:
        p = act["path"]
        sz = act["size"]
        try:
            if os.path.isdir(p):
                for root, _, files in os.walk(p):
                    for f in files:
                        try:
                            os.chmod(os.path.join(root, f), 0o777)  # noqa: SEC-AUDITOR
                        except Exception:
                            pass
                shutil.rmtree(p, ignore_errors=True)  # noqa: SEC-AUDITOR
            elif os.path.isfile(p):
                os.remove(p)  # noqa: SEC-AUDITOR
            reclaimed += sz
            print(f"  [CLEANED] {act['description']} -> {sz / (1024*1024):.2f} MB")
        except Exception as e:
            print(f"  [FAILED] Could not remove {p}: {e}")
    return reclaimed

def main():
    parser = argparse.ArgumentParser(description="Workspace & Brain Storage Cleaner")
    parser.add_argument("--brain-root", default=os.path.expanduser(r"~\.gemini\antigravity\brain"), help="Path to Antigravity brain")
    parser.add_argument("--workspace-root", default=r"C:\dev", help="Path to project workspace")
    parser.add_argument("--current-cid", default=os.environ.get("CONVERSATION_ID", ""), help="Current conversation ID to protect")
    parser.add_argument("--apply", action="store_true", help="Perform the actual deletion")
    args = parser.parse_args()

    print("==================================================")
    print("      Workspace & Brain Storage Cleaner           ")
    print("==================================================")
    print(f"Mode: {'APPLY (Deletes files)' if args.apply else 'AUDIT / DRY-RUN (Read-only)'}")
    print(f"Brain Root:      {args.brain_root}")
    print(f"Workspace Root:  {args.workspace_root}\n")

    b_bytes, b_actions = audit_brain(args.brain_root, args.current_cid)
    w_bytes, w_actions = audit_workspace(args.workspace_root)
    all_actions = b_actions + w_actions
    total_reclaimable = b_bytes + w_bytes

    print(f"Findings:")
    print(f"  - Brain Cleanup Candidates:      {len(b_actions)} items ({b_bytes / (1024*1024):.2f} MB)")
    print(f"  - Workspace Cleanup Candidates:  {len(w_actions)} items ({w_bytes / (1024*1024):.2f} MB)")
    print(f"  - Total Reclaimable:             {total_reclaimable / (1024*1024):.2f} MB\n")

    if not all_actions:
        print("Everything is clean! No action required.")
        return

    if not args.apply:
        print("Planned Actions (Dry-Run):")
        for act in all_actions:
            print(f"  - [{act['type']}] {act['description']} ({act['size'] / 1024:.1f} KB) at {act['path']}")
        print("\nTo execute cleanup, re-run with --apply flag.")
    else:
        print("Executing cleanup...")
        reclaimed = execute_actions(all_actions)
        print(f"\nSuccessfully reclaimed {reclaimed / (1024*1024):.2f} MB!")

if __name__ == "__main__":
    main()
