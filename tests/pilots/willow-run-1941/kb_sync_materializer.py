"""Canonical knowledge materializer and audit logger."""

import json
import os
from datetime import datetime, timezone

class KBSyncMaterializer:
    def __init__(self, staging_dir: str):
        self.staging_dir = staging_dir
        os.makedirs(staging_dir, exist_ok=True)
        self.canonical_file = os.path.join(staging_dir, "canonical_knowledge.json")
        self.staged_queue_file = os.path.join(staging_dir, "staged_review_queue.json")
        self.audit_log_file = os.path.join(staging_dir, "pipeline_audit_log.json")
        
        self._init_files()

    def _init_files(self):
        for path in [self.canonical_file, self.staged_queue_file]:
            if not os.path.exists(path):
                with open(path, "w", encoding="utf-8") as f:
                    json.dump([], f, indent=2)
        if not os.path.exists(self.audit_log_file):
            with open(self.audit_log_file, "w", encoding="utf-8") as f:
                f.write("")

    def load_canonical(self) -> list:
        with open(self.canonical_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_staged_queue(self) -> list:
        with open(self.staged_queue_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def commit_record(self, candidate: dict, audit_result: dict) -> str:
        record = dict(candidate)
        record["audit"] = audit_result
        now_iso = datetime.now(timezone.utc).isoformat()
        record["provenance"]["materializedAt"] = now_iso

        if audit_result["verdict"] == "passed":
            record["status"] = "validated"
            canonical = self.load_canonical()
            # Replace if existing factKey or append
            canonical = [r for r in canonical if r["factKey"] != record["factKey"]]
            canonical.append(record)
            with open(self.canonical_file, "w", encoding="utf-8") as f:
                json.dump(canonical, f, indent=2)
            action = "COMMITTED_CANONICAL"
        else:
            record["status"] = "needs-review"
            queue = self.load_staged_queue()
            queue = [r for r in queue if r["factKey"] != record["factKey"]]
            queue.append(record)
            with open(self.staged_queue_file, "w", encoding="utf-8") as f:
                json.dump(queue, f, indent=2)
            action = "ROUTED_STAGED_QUEUE"

        # Log event to append-only pipeline audit log
        log_entry = {
            "timestamp": now_iso,
            "action": action,
            "factKey": record["factKey"],
            "taskId": record["provenance"]["taskId"],
            "status": record["status"],
            "auditVerdict": audit_result["verdict"]
        }
        with open(self.audit_log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")

        return record["status"]
