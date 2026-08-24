"""Unit tests for Willow Run B-24 controlled evidence pipeline pilot."""

import json
import os
import sys
import unittest

base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from torque_span_resolver import TorqueSpanResolver
from ollama_bounded_extractor import OllamaBoundedExtractor
from validation_gate import ValidationGate
from staged_review_audit import StagedReviewAudit
from kb_sync_materializer import KBSyncMaterializer
from adjudication_gate import AdjudicationGate
from gap_mining_engine import GapMiningEngine
from batch_task_generator import BatchTaskGenerator

class TestPilotComponents(unittest.TestCase):
    def setUp(self):
        self.corpus_dir = os.path.join(base_dir, "corpus")
        self.specs_dir = os.path.join(base_dir, "specs")
        self.staging_dir = os.path.join(base_dir, "_kb-sync-staging-test")
        
        self.resolver = TorqueSpanResolver(self.corpus_dir)
        self.extractor = OllamaBoundedExtractor()
        self.validator = ValidationGate(self.resolver)
        self.materializer = KBSyncMaterializer(self.staging_dir)
        self.adjudicator = AdjudicationGate(self.materializer)

    def test_span_resolution_and_hash(self):
        span_payload = self.resolver.extract_span("src-ford-wr-1941-memoir", 648, 858)
        self.assertEqual(len(span_payload["spanText"]), 210)
        self.assertTrue(span_payload["spanHash"].startswith("sha256:"))

    def test_tampered_hash_rejection(self):
        spec_path = os.path.join(self.specs_dir, "task-cic-wr-001.json")
        with open(spec_path, "r", encoding="utf-8") as f:
            task_spec = json.load(f)

        span_payload = self.resolver.extract_span("src-ford-wr-1941-memoir", 648, 858)
        candidate = self.extractor.extract(task_spec, span_payload)

        # Inject forged span hash
        is_valid, msg = self.validator.validate_candidate(task_spec, candidate, expected_span_hash="sha256:0000000000000000000000000000000000000000000000000000000000000000")
        self.assertFalse(is_valid)
        self.assertIn("Span hash mismatch", msg)

    def test_contradiction_audit_routing(self):
        canonical_record = {
            "factKey": "fact-cic-wr-coronado-sketch-194101",
            "claim": "In January 1941 at Hotel del Coronado, Sorensen drafted progressive assembly layout.",
            "eventDate": "1941-01",
            "eventLocation": "Hotel del Coronado, San Diego, CA"
        }
        auditor = StagedReviewAudit([canonical_record])

        conflicting_candidate = {
            "factKey": "fact-cic-wr-wpb-origin-194103",
            "claim": "Official Ford engineering submissions prepared in Dearborn in March 1941 established layout tooling schedules.",
            "eventDate": "1941-03",
            "eventLocation": "Dearborn, MI"
        }

        audit_result = auditor.audit_candidate(conflicting_candidate)
        self.assertEqual(audit_result["verdict"], "contradiction_detected")
        self.assertIn("fact-cic-wr-coronado-sketch-194101", audit_result["conflictingFactKeys"])

    def test_adjudication_mark_contradicted(self):
        staged_record = {
            "factKey": "fact-test-staged-001",
            "claim": "Dearborn March 1941",
            "audit": {"verdict": "contradiction_detected", "conflictingFactKeys": ["fact-cic-wr-coronado-sketch-194101"]},
            "provenance": {"taskId": "TASK-002"}
        }
        with open(self.materializer.staged_queue_file, "w", encoding="utf-8") as f:
            json.dump([staged_record], f, indent=2)

        res = self.adjudicator.mark_contradicted("fact-test-staged-001", "fact-cic-wr-coronado-sketch-194101", "Testing contradiction link")
        self.assertTrue(res)

        canonical = self.materializer.load_canonical()
        item = next((r for r in canonical if r["factKey"] == "fact-test-staged-001"), None)
        self.assertIsNotNone(item)
        self.assertEqual(item["status"], "contradicted")
        self.assertTrue("contradictionGraph" in item)

    def test_gap_mining_detection(self):
        canonical_records = [
            {
                "factKey": "fact-cic-wr-coronado-sketch-194101",
                "claim": "At the Hotel del Coronado in January 1941, Charles E. Sorensen drafted a pencil layout applying cast-iron automotive tooling and continuous progressive assembly line principles."
            }
        ]
        engine = GapMiningEngine(canonical_records, self.specs_dir)
        tasks = engine.mine_gaps()
        gap_types = [t["gapType"] for t in tasks]
        self.assertIn("parameter_specification", gap_types)
        self.assertIn("vendor_identification", gap_types)
        self.assertIn("production_volume_discrepancy", gap_types)

    def test_batch_task_generator(self):
        generator = BatchTaskGenerator(self.corpus_dir, self.specs_dir)
        tasks = generator.scan_and_generate_batch_tasks()
        self.assertEqual(len(tasks), 2)
        self.assertTrue(os.path.exists(tasks[0]["specPath"]))

if __name__ == "__main__":
    unittest.main()
