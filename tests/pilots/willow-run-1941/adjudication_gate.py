"""Adjudication gate for operator actions over staged review items."""

from datetime import datetime, timezone
import json
import os

class AdjudicationGate:
    def __init__(self, materializer):
        self.materializer = materializer

    def approve_and_validate(self, fact_key: str, notes: str) -> bool:
        staged = self.materializer.load_staged_queue()
        record = next((r for r in staged if r["factKey"] == fact_key), None)
        if not record:
            return False

        record["status"] = "validated"
        now_iso = datetime.now(timezone.utc).isoformat()
        record["provenance"]["approvedAt"] = now_iso
        record["provenance"]["approvedNotes"] = notes
        record["audit"]["overrideTag"] = "APPROVED_OVERRIDE"

        # Remove from staged queue and commit to canonical
        new_staged = [r for r in staged if r["factKey"] != fact_key]
        with open(self.materializer.staged_queue_file, "w", encoding="utf-8") as f:
            json.dump(new_staged, f, indent=2)

        canonical = self.materializer.load_canonical()
        canonical = [r for r in canonical if r["factKey"] != fact_key]
        canonical.append(record)
        with open(self.materializer.canonical_file, "w", encoding="utf-8") as f:
            json.dump(canonical, f, indent=2)

        self._log_audit_event("ADJUDICATED_APPROVE", fact_key, "validated", notes)
        return True

    def mark_contradicted(self, fact_key: str, conflicting_fact_key: str, rationale: str) -> bool:
        staged = self.materializer.load_staged_queue()
        record = next((r for r in staged if r["factKey"] == fact_key), None)
        if not record:
            return False

        now_iso = datetime.now(timezone.utc).isoformat()
        record["status"] = "contradicted"

        # Construct bidirectional contradiction edge
        edge_candidate = {
            "conflictingFactKey": conflicting_fact_key,
            "reason": rationale,
            "linkedAt": now_iso
        }
        if "contradictionGraph" not in record:
            record["contradictionGraph"] = []
        record["contradictionGraph"].append(edge_candidate)

        # Move from staged queue to canonical store
        new_staged = [r for r in staged if r["factKey"] != fact_key]
        with open(self.materializer.staged_queue_file, "w", encoding="utf-8") as f:
            json.dump(new_staged, f, indent=2)

        canonical = self.materializer.load_canonical()
        
        # Also update canonical target record with reverse edge
        target_rec = next((r for r in canonical if r["factKey"] == conflicting_fact_key), None)
        if target_rec:
            reverse_edge = {
                "conflictingFactKey": fact_key,
                "reason": rationale,
                "linkedAt": now_iso
            }
            if "contradictionGraph" not in target_rec:
                target_rec["contradictionGraph"] = []
            target_rec["contradictionGraph"].append(reverse_edge)

        canonical = [r for r in canonical if r["factKey"] != fact_key]
        canonical.append(record)
        with open(self.materializer.canonical_file, "w", encoding="utf-8") as f:
            json.dump(canonical, f, indent=2)

        self._log_audit_event("ADJUDICATED_CONTRADICTED", fact_key, "contradicted", rationale)
        return True

    def reject(self, fact_key: str, reason: str) -> bool:
        staged = self.materializer.load_staged_queue()
        record = next((r for r in staged if r["factKey"] == fact_key), None)
        if not record:
            return False

        new_staged = [r for r in staged if r["factKey"] != fact_key]
        with open(self.materializer.staged_queue_file, "w", encoding="utf-8") as f:
            json.dump(new_staged, f, indent=2)

        self._log_audit_event("ADJUDICATED_REJECT", fact_key, "rejected", reason)
        return True

    def _log_audit_event(self, action: str, fact_key: str, status: str, details: str):
        now_iso = datetime.now(timezone.utc).isoformat()
        log_entry = {
            "timestamp": now_iso,
            "action": action,
            "factKey": fact_key,
            "status": status,
            "details": details
        }
        with open(self.materializer.audit_log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
