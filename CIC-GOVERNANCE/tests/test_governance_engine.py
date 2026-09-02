import importlib.util
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parents[1]
WRAPPER = ROOT / "WRAPPERS" / "Codex-Governance-Engine-Wrapper.py"
spec = importlib.util.spec_from_file_location("cic_governance", WRAPPER)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class GovernanceEngineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = module.LineageStore(Path(self.temp.name) / "lineage.jsonl")
        self.engine = module.GovernanceEngine(self.store, {"tier2-builder"})

    def tearDown(self): self.temp.cleanup()

    def submission(self, **overrides):
        payload = overrides.pop("payload", {"title": "candidate"})
        value = {
            "artifact_id": "ART-20260713-0001", "artifact_version": "1.0.0",
            "spec_version": "2.4.0", "source_hash": module.payload_hash(payload),
            "actor": "tier2-builder", "action": "INGEST", "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        value.update(overrides); return value

    def assert_violation(self, expected, submission):
        with self.assertRaises(module.GovernanceViolation) as caught: self.engine.ingest(submission)
        self.assertEqual(expected, caught.exception.code)

    def test_accepts_valid_submission_and_appends_lineage(self):
        result = self.engine.ingest(self.submission())
        self.assertEqual("ACCEPTED", result["code"])
        self.assertEqual(1, len(self.store.records()))

    def test_hash_is_canonical(self):
        self.assertEqual(module.payload_hash({"a": 1, "b": 2}), module.payload_hash({"b": 2, "a": 1}))

    def test_rejects_hash_mismatch(self): self.assert_violation("SCHEMA_INVALID", self.submission(source_hash="0" * 64))
    def test_rejects_unknown_actor(self): self.assert_violation("ACTOR_UNREGISTERED", self.submission(actor="unknown"))
    def test_rejects_wrong_spec(self): self.assert_violation("SCHEMA_INVALID", self.submission(spec_version="2.3.1"))
    def test_rejects_missing_field(self):
        value = self.submission(); del value["actor"]; self.assert_violation("SCHEMA_INVALID", value)
    def test_rejects_unknown_field(self): self.assert_violation("SCHEMA_INVALID", self.submission(secret=True))
    def test_deprecate_requires_parent(self): self.assert_violation("SCHEMA_INVALID", self.submission(action="DEPRECATE"))

    def test_update_requires_existing_parent(self):
        self.assert_violation("LINEAGE_CONFLICT", self.submission(action="UPDATE", parent_artifact_id="ART-20260712-9999"))

    def test_update_links_parent_lineage(self):
        self.engine.ingest(self.submission())
        update = self.submission(artifact_id="ART-20260713-0002", action="UPDATE", parent_artifact_id="ART-20260713-0001")
        self.engine.ingest(update)
        records = self.store.records()
        self.assertEqual(records[0]["lineage_id"], records[1]["parent_lineage_id"])

    def test_corrupt_lineage_halts(self):
        Path(self.store.path).write_text("not-json\n", encoding="utf-8")
        with self.assertRaises(module.GovernanceViolation) as caught: self.store.records()
        self.assertEqual("LINEAGE_CORRUPT", caught.exception.code)

    def test_schema_is_valid_json(self):
        schema = json.loads((ROOT / "SCHEMA" / "CIC-Ingestion-Schema-v2.4.0.json").read_text(encoding="utf-8"))
        self.assertEqual("2.4.0", schema["properties"]["spec_version"]["const"])


if __name__ == "__main__": unittest.main()
