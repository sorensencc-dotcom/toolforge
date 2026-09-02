"""End-to-end orchestrator for Willow Run B-24 controlled evidence pipeline pilot."""

import json
import os
import sys

# Ensure local imports resolve
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from torque_span_resolver import TorqueSpanResolver
from ollama_bounded_extractor import OllamaBoundedExtractor
from validation_gate import ValidationGate
from staged_review_audit import StagedReviewAudit
from kb_sync_materializer import KBSyncMaterializer

def run_pilot():
    corpus_dir = os.path.join(base_dir, "corpus")
    specs_dir = os.path.join(base_dir, "specs")
    staging_dir = os.path.join(base_dir, "_kb-sync-staging")

    resolver = TorqueSpanResolver(corpus_dir)
    extractor = OllamaBoundedExtractor()
    validator = ValidationGate(resolver)
    materializer = KBSyncMaterializer(staging_dir)

    task_files = ["task-cic-wr-001.json", "task-cic-wr-002.json", "task-cic-wr-003.json"]
    results = []

    print("=== STARTING CONTROLLED EVIDENCE PIPELINE PILOT ===")
    for task_filename in task_files:
        spec_path = os.path.join(specs_dir, task_filename)
        with open(spec_path, "r", encoding="utf-8") as f:
            task_spec = json.load(f)

        task_id = task_spec["taskId"]
        target = task_spec["sourceTargets"][0]
        source_id = target["sourceId"]
        span_range = target["span"]

        print(f"\n--- Processing {task_id} ({source_id}) ---")

        # 1. Span resolution
        span_payload = resolver.extract_span(source_id, span_range["start"], span_range["end"])
        print(f"[SpanResolver] Extracted {len(span_payload['spanText'])} chars, SHA-256: {span_payload['spanHash']}")

        # 2. Bounded Extraction
        candidate = extractor.extract(task_spec, span_payload)
        print(f"[OllamaExtractor] Extracted claim key: {candidate['factKey']}")

        # 3. Validation Gate
        is_valid, validation_msg = validator.validate_candidate(task_spec, candidate)
        print(f"[ValidationGate] {validation_msg} (Valid: {is_valid})")
        if not is_valid:
            print(f"HARD REJECT: Dropping candidate {candidate['factKey']}")
            continue

        # 4. Adversarial Audit
        canonical_records = materializer.load_canonical()
        auditor = StagedReviewAudit(canonical_records)
        audit_result = auditor.audit_candidate(candidate)
        print(f"[AuditGate] Verdict: {audit_result['verdict']}")
        if audit_result["flags"]:
            for flag in audit_result["flags"]:
                print(f"  - FLAG: {flag}")

        # 5. kb-sync Commit
        status = materializer.commit_record(candidate, audit_result)
        print(f"[KBSync] Materialized record with status: {status}")

        results.append({
            "taskId": task_id,
            "factKey": candidate["factKey"],
            "status": status,
            "auditVerdict": audit_result["verdict"]
        })

    print("\n=== PILOT EXECUTION SUMMARY ===")
    print(f"Total tasks processed: {len(results)}")
    print(f"Canonical records committed: {sum(1 for r in results if r['status'] == 'validated')}")
    print(f"Staged queue conflicts routed: {sum(1 for r in results if r['status'] == 'needs-review')}")
    print("All tasks completed successfully.")

if __name__ == "__main__":
    run_pilot()
