"""Unit tests for TRM Topic Coverage Auditor."""

import os
import sys
import unittest

base_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(base_dir, ".."))
trm_dir = os.path.join(root_dir, "trm")
if trm_dir not in sys.path:
    sys.path.insert(0, trm_dir)

from topic_coverage_auditor import TopicCoverageAuditor

class TestTopicCoverageAuditor(unittest.TestCase):
    def setUp(self):
        self.topics_dir = os.path.join(root_dir, "tests", "pilots")
        self.corpus_dir = os.path.join(root_dir, "tests", "pilots", "willow-run-1941", "corpus")
        self.auditor = TopicCoverageAuditor(self.topics_dir, self.corpus_dir)

    def test_orphan_source_audit(self):
        report = self.auditor.run_audit()
        self.assertEqual(report["sourceCoverage"]["status"], "PASS")
        self.assertEqual(len(report["sourceCoverage"]["orphans"]), 0)

    def test_emergent_topic_discovery(self):
        report = self.auditor.run_audit()
        candidates = report["topicEmergence"]["candidates"]
        self.assertGreaterEqual(len(candidates), 4)
        slugs = [c["slug"] for c in candidates]
        self.assertIn("highland-park-assembly-1913", slugs)
        self.assertIn("rouge-foundry-tooling-1928", slugs)

    def test_scope_drift_audit(self):
        report = self.auditor.run_audit()
        self.assertEqual(report["scopeDrift"]["status"], "PASS")
        self.assertEqual(len(report["scopeDrift"]["driftedRecords"]), 0)

if __name__ == "__main__":
    unittest.main()
