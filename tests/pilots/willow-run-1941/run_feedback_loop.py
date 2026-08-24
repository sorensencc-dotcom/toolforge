"""Feedback loop and recursive re-ingestion orchestrator for Willow Run B-24 pilot."""

import json
import os
import sys

base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from run_vertical_pilot import run_pilot
from torque_span_resolver import TorqueSpanResolver
from ollama_bounded_extractor import OllamaBoundedExtractor
from validation_gate import ValidationGate
from staged_review_audit import StagedReviewAudit
from kb_sync_materializer import KBSyncMaterializer
from adjudication_gate import AdjudicationGate
from gap_mining_engine import GapMiningEngine

def run_feedback_loop():
    print("=== STEP 1: EXECUTING INITIAL VERTICAL PILOT ===")
    run_pilot()

    corpus_dir = os.path.join(base_dir, "corpus")
    specs_dir = os.path.join(base_dir, "specs")
    staging_dir = os.path.join(base_dir, "_kb-sync-staging")

    materializer = KBSyncMaterializer(staging_dir)
    adjudicator = AdjudicationGate(materializer)

    print("\n=== STEP 2: OPERATOR ADJUDICATION GATE ===")
    staged = materializer.load_staged_queue()
    print(f"Staged review queue items: {len(staged)}")

    for item in staged:
        fact_key = item["factKey"]
        conflicting_keys = item["audit"].get("conflictingFactKeys", [])
        if fact_key == "fact-cic-wr-wpb-origin-194103" and conflicting_keys:
            target_key = conflicting_keys[0]
            rationale = (
                "WPB report records Dearborn March 1941 for formal Ford engineering submissions; "
                "Sorensen memoir records the initial pencil concept at Coronado in January 1941."
            )
            success = adjudicator.mark_contradicted(fact_key, target_key, rationale)
            print(f"[AdjudicationGate] Marked {fact_key} as CONTRADICTED vs {target_key} (Success: {success})")

    canonical_after_adj = materializer.load_canonical()
    print(f"Canonical knowledge records post-adjudication: {len(canonical_after_adj)}")

    print("\n=== STEP 3: RECURSIVE GAP MINING ===")
    gap_engine = GapMiningEngine(canonical_after_adj, specs_dir)
    gap_tasks = gap_engine.mine_gaps()
    print(f"Discovered and generated {len(gap_tasks)} downstream gap tasks.")

    resolver = TorqueSpanResolver(corpus_dir)
    extractor = OllamaBoundedExtractor()
    validator = ValidationGate(resolver)

    print("\n=== STEP 4: DOWNSTREAM RE-INGESTION EXECUTION ===")
    for gtask in gap_tasks:
        spec_path = gtask["specPath"]
        with open(spec_path, "r", encoding="utf-8") as f:
            task_spec = json.load(f)

        task_id = task_spec["taskId"]
        target = task_spec["sourceTargets"][0]
        source_id = target["sourceId"]
        span_range = target["span"]

        print(f"\n--- Processing Downstream Gap Task {task_id} ---")
        
        start = span_range["start"]
        end = span_range["end"]

        span_payload = resolver.extract_span(source_id, start, end)
        print(f"[TorqueQuery] Grounded {len(span_payload['spanText'])} chars, SHA-256: {span_payload['spanHash']}")

        candidate = extractor.extract(task_spec, span_payload)
        print(f"[OllamaExtractor] Extracted gap fact key: {candidate['factKey']}")

        is_valid, validation_msg = validator.validate_candidate(task_spec, candidate)
        print(f"[ValidationGate] {validation_msg} (Valid: {is_valid})")
        if not is_valid:
            print(f"HARD REJECT: Dropping invalid candidate {candidate['factKey']}")
            continue

        auditor = StagedReviewAudit(materializer.load_canonical())
        audit_result = auditor.audit_candidate(candidate)
        print(f"[AuditGate] Verdict: {audit_result['verdict']}")

        status = materializer.commit_record(candidate, audit_result)
        print(f"[KBSync] Materialized gap record with status: {status}")

    final_canonical = materializer.load_canonical()
    print("\n=== FEEDBACK LOOP EXECUTION VERIFIED ===")
    print(f"Final Canonical Knowledge Store Total Records: {len(final_canonical)}")
    for rec in final_canonical:
        print(f"  - Key: {rec['factKey']} | Status: {rec['status']}")

if __name__ == "__main__":
    run_feedback_loop()
