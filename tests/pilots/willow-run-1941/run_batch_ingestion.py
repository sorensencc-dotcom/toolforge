"""Batch corpus ingestion runner for Willow Run B-24 pilot."""

import json
import os
import sys

base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from batch_task_generator import BatchTaskGenerator
from torque_span_resolver import TorqueSpanResolver
from ollama_bounded_extractor import OllamaBoundedExtractor
from validation_gate import ValidationGate
from staged_review_audit import StagedReviewAudit
from kb_sync_materializer import KBSyncMaterializer

def run_batch_ingestion():
    corpus_dir = os.path.join(base_dir, "corpus")
    specs_dir = os.path.join(base_dir, "specs")
    staging_dir = os.path.join(base_dir, "_kb-sync-staging")

    print("=== STEP 1: BATCH TASK GENERATION FROM CORPUS ===")
    generator = BatchTaskGenerator(corpus_dir, specs_dir)
    batch_tasks = generator.scan_and_generate_batch_tasks()
    print(f"Generated {len(batch_tasks)} batch tasks across primary corpus documents.")

    resolver = TorqueSpanResolver(corpus_dir)
    extractor = OllamaBoundedExtractor()
    validator = ValidationGate(resolver)
    materializer = KBSyncMaterializer(staging_dir)

    print("\n=== STEP 2: EXECUTING BATCH INGESTION PIPELINE ===")
    results = []

    for btask in batch_tasks:
        spec_path = btask["specPath"]
        with open(spec_path, "r", encoding="utf-8") as f:
            task_spec = json.load(f)

        task_id = task_spec["taskId"]
        target = task_spec["sourceTargets"][0]
        source_id = target["sourceId"]
        span_range = target["span"]

        print(f"\n--- Processing Batch Task {task_id} ({source_id}) ---")

        span_payload = resolver.extract_span(source_id, span_range["start"], span_range["end"])
        print(f"[TorqueQuery] Grounded {len(span_payload['spanText'])} chars, SHA-256: {span_payload['spanHash']}")

        candidate = extractor.extract(task_spec, span_payload)
        print(f"[OllamaExtractor] Extracted candidate key: {candidate['factKey']}")

        is_valid, validation_msg = validator.validate_candidate(task_spec, candidate)
        print(f"[ValidationGate] {validation_msg} (Valid: {is_valid})")

        auditor = StagedReviewAudit(materializer.load_canonical())
        audit_result = auditor.audit_candidate(candidate)
        print(f"[AuditGate] Verdict: {audit_result['verdict']}")

        status = materializer.commit_record(candidate, audit_result)
        print(f"[KBSync] Materialized record with status: {status}")

        results.append({
            "taskId": task_id,
            "factKey": candidate["factKey"],
            "status": status
        })

    final_canonical = materializer.load_canonical()
    print("\n=== BATCH INGESTION SUMMARY ===")
    print(f"Total canonical records in store: {len(final_canonical)}")
    for rec in final_canonical:
        print(f"  - Key: {rec['factKey']} | Status: {rec['status']}")

if __name__ == "__main__":
    run_batch_ingestion()
