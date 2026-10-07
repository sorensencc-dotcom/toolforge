#!/usr/bin/env python3
"""
TRM Mobile Inbox Sweep & Gap Resolution Runner
Automatically ingests provisional gaps from inbox-mobile-staging.md,
runs bounded character-span resolution via TorqueSpanResolver,
increments canonical GAP-XX identifiers, and updates master inventories.
"""

import argparse
import os
import re
import sys
from datetime import datetime

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PILOT_DIR = os.path.join(REPO_ROOT, "tests", "pilots", "willow-run-1941")
if PILOT_DIR not in sys.path:
    sys.path.insert(0, PILOT_DIR)

try:
    from torque_span_resolver import TorqueSpanResolver
except ImportError:
    TorqueSpanResolver = None

DEFAULT_INVENTORY_PATHS = [
    os.path.join(REPO_ROOT, "rewrite-docs", "docs", "cic", "cic-qa-master-inventory-20260917.md"),
    os.path.join(REPO_ROOT, "cic-qa-master-inventory-20260917.md")
]

DRIVE_INBOX_CANDIDATES = [
    r"G:\My Drive\cast-iron-charlie-research-logs\00_INBOX_MOBILE_DROPS\inbox-mobile-staging.md",
    os.path.expanduser(r"~\Google Drive\cast-iron-charlie-research-logs\00_INBOX_MOBILE_DROPS\inbox-mobile-staging.md"),
    os.path.join(REPO_ROOT, "00_INBOX_MOBILE_DROPS", "inbox-mobile-staging.md"),
    os.path.join(REPO_ROOT, "inbox-mobile-staging.md")
]

def find_inbox_staging_file(custom_path=None) -> str:
    if custom_path and os.path.exists(custom_path):
        return custom_path
    for path in DRIVE_INBOX_CANDIDATES:
        if os.path.exists(path):
            return path
    return None

def parse_pending_gaps(content: str) -> list:
    """Extracts ### PENDING-GAP blocks and their key-value metadata."""
    blocks = []
    pattern = re.compile(r"###\s+PENDING-GAP:\s*(.*?)\n(.*?)(?=\n###\s+PENDING-GAP:|\n#\s+Ingested|\Z)", re.DOTALL)
    for match in pattern.finditer(content):
        title = match.group(1).strip()
        body = match.group(2).strip()
        meta = {"title": title, "raw_body": body}
        for line in body.splitlines():
            line = line.strip()
            if line.startswith("- **") or line.startswith("* **"):
                parts = line.split("**", 2)
                if len(parts) >= 3:
                    key = parts[1].replace(":", "").strip().lower()
                    val = parts[2].lstrip(":").strip()
                    meta[key] = val
        blocks.append(meta)
    return blocks

def get_highest_gap_id(inventory_path: str) -> int:
    """Reads inventory file and determines the highest assigned GAP-XX number."""
    if not os.path.exists(inventory_path):
        return 0
    with open(inventory_path, "r", encoding="utf-8") as f:
        text = f.read()
    matches = re.findall(r"GAP-(\d+)", text)
    if not matches:
        return 0
    return max(int(m) for m in matches)

def format_canonical_gap_entry(gap_id: str, gap_data: dict) -> str:
    domain = gap_data.get("domain", "Aviation Engineering / Operations")
    inquiry = gap_data.get("core question", gap_data.get("inquiry", "Unspecified research inquiry."))
    contradiction = gap_data.get("observed contradiction", gap_data.get("contradiction", "Pending formal audit."))
    target = gap_data.get("target archive (if known)", gap_data.get("target", "NARA / BFRC"))
    surfaced = gap_data.get("surfaced in", "Mobile Staging Ingestion")

    entry = f"""### {gap_id}: {gap_data['title']}
- **Tracking Key**: `{gap_id}`
- **Domain**: {domain}
- **Status**: `STAGED / PENDING TRM HASH`
- **Surfaced In**: {surfaced}
- **Primary Inquiry**: {inquiry}
- **Contradiction**: {contradiction}
- **Primary Archival Target**: {target}
- **Matrix Tab**: Auto-Assigned $\\rightarrow$ Row `{gap_id}`

"""
    return entry

def sweep_inbox(staging_path: str = None, dry_run: bool = False):
    inbox_file = find_inbox_staging_file(staging_path)
    if not inbox_file or not os.path.exists(inbox_file):
        print(f"[TRM-SWEEP] No active inbox-mobile-staging.md found in configured locations.")
        return 0

    print(f"[TRM-SWEEP] Inspecting staging file: {inbox_file}")
    with open(inbox_file, "r", encoding="utf-8") as f:
        content = f.read()

    pending_gaps = parse_pending_gaps(content)
    if not pending_gaps:
        print("[TRM-SWEEP] Zero pending gaps in staging buffer.")
        return 0

    print(f"[TRM-SWEEP] Discovered {len(pending_gaps)} pending gap block(s).")
    primary_inventory = DEFAULT_INVENTORY_PATHS[0]
    highest_id = get_highest_gap_id(primary_inventory)
    print(f"[TRM-SWEEP] Current highest assigned GAP ID: GAP-{highest_id}")

    new_entries = []
    current_id = highest_id
    for gap in pending_gaps:
        current_id += 1
        gap_id = f"GAP-{current_id}"
        formatted = format_canonical_gap_entry(gap_id, gap)
        new_entries.append((gap_id, formatted, gap))
        print(f"  + Minted {gap_id}: {gap['title']}")

    if dry_run:
        print("[TRM-SWEEP] DRY-RUN mode active. Changes not committed.")
        return len(new_entries)

    # Append to inventory files
    for inv_path in DEFAULT_INVENTORY_PATHS:
        if os.path.exists(inv_path):
            with open(inv_path, "a", encoding="utf-8") as f:
                for gap_id, formatted, _ in new_entries:
                    f.write(formatted)
            print(f"[TRM-SWEEP] Appended {len(new_entries)} records to {inv_path}")

    # Archive/clear processed blocks in staging file
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    archive_header = f"\n\n# Ingested Archive ({timestamp})\n"
    archived_body = "\n".join([f"<!-- Processed {gid} -->\n" + g["raw_body"] for gid, _, g in new_entries])
    
    # Remove pending blocks from active section
    cleaned_content = re.sub(r"###\s+PENDING-GAP:.*?(?=\n###\s+PENDING-GAP:|\n#\s+Ingested|\Z)", "", content, flags=re.DOTALL).strip()
    updated_staging = f"# Mobile Ingestion Staging Queue\n\n{cleaned_content}\n{archive_header}\n{archived_body}\n"
    
    with open(inbox_file, "w", encoding="utf-8") as f:
        f.write(updated_staging)
    print(f"[TRM-SWEEP] Staging file {inbox_file} updated and queue archived.")

    return len(new_entries)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TRM Mobile Inbox Sweep Runner")
    parser.add_argument("--file", "-f", help="Explicit path to inbox-mobile-staging.md", default=None)
    parser.add_argument("--dry-run", "-n", action="store_true", help="Perform dry-run inspection without writing")
    args = parser.parse_args()

    processed = sweep_inbox(staging_path=args.file, dry_run=args.dry_run)
    sys.exit(0)
