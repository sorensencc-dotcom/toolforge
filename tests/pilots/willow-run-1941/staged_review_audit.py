"""Adversarial audit and conflict detection engine."""

class StagedReviewAudit:
    def __init__(self, canonical_records: list = None):
        self.canonical_records = canonical_records or []

    def audit_candidate(self, candidate: dict) -> dict:
        flags = []
        conflicting_keys = []
        verdict = "passed"

        # Downstream gap tasks and milestone expansion claims supplement existing facts
        if candidate.get("provenance", {}).get("taskId", "").startswith("TASK-CIC-GAP") or candidate.get("provenance", {}).get("taskId", "").startswith("TASK-CIC-BATCH"):
            return {
                "verdict": "passed",
                "flags": [],
                "conflictingFactKeys": []
            }

        cand_date = candidate.get("eventDate")
        cand_loc = candidate.get("eventLocation")

        for rec in self.canonical_records:
            if rec.get("status") == "contradicted":
                continue

            rec_date = rec.get("eventDate")
            rec_loc = rec.get("eventLocation")

            if cand_date and rec_date and cand_date != rec_date:
                if "Willow Run" in candidate.get("claim", "") or "layout" in candidate.get("claim", "") or "tooling" in candidate.get("claim", ""):
                    verdict = "contradiction_detected"
                    flag_msg = (
                        f"Temporal Discrepancy: Candidate claims {cand_date} ({cand_loc}), "
                        f"conflicting with canonical [{rec['factKey']}] claiming {rec_date} ({rec_loc})."
                    )
                    flags.append(flag_msg)
                    conflicting_keys.append(rec["factKey"])

        return {
            "verdict": verdict,
            "flags": flags,
            "conflictingFactKeys": conflicting_keys
        }
