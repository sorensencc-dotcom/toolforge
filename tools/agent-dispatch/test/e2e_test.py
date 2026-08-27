import json
import os
import subprocess
import sys
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).parents[1]
RUN_SCRIPT = ROOT / "run.py"
CATALOG_PATH = ROOT / "providers" / "catalog.json"

sys.path.insert(0, str(Path(__file__).parent))
from test_helpers import ManagedTempDir


class RunCliE2ETests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = ManagedTempDir("e2e_")
        self.dir_path = self.temp_dir.path
        self.workspace_root = self.dir_path / "workspace"
        self.worktree = self.workspace_root / "worktree"
        self.worktree.mkdir(parents=True, exist_ok=True)
        self.output_dir = self.dir_path / "artifacts"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Mock verifier script that outputs valid JSON
        self.mock_verifier = self.dir_path / "mock_verifier.py"
        self.mock_verifier.write_text(
            'import sys, json\n'
            'print(json.dumps({"valid": True, "contract_hash": "sha256:mock", "key_id": "test-key"}))\n'
            'sys.exit(0)\n',
            encoding="utf-8",
        )

        self.mock_bad_verifier = self.dir_path / "mock_bad_verifier.py"
        self.mock_bad_verifier.write_text(
            'import sys, json\n'
            'print(json.dumps({"valid": False, "reason": "SIGNATURE_REJECTED"}))\n'
            'sys.exit(1)\n',
            encoding="utf-8",
        )

        self.valid_contract_data = {
            "contract_version": "1.0",
            "task_id": "TASK-E2E-001",
            "task": "Test end to end execution flow",
            "recommended_route": {
                "provider": "ollama",
                "model": "configured",
                "execution_mode": "local_http",
                "cost_policy": {"input_per_1k": 0, "output_per_1k": 0},
                "credential_ref": "none",
            },
            "allowed_routes": [],
            "max_cost_usd": 0,
            "max_attempts": 3,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "operator_override": False,
            "signature": {"algorithm": "Ed25519", "key_id": "test-key", "value": "mock_sig"},
        }
        self.contract_file = self.dir_path / "contract.json"
        self.contract_file.write_text(json.dumps(self.valid_contract_data, indent=2), encoding="utf-8")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_dry_run_success_flow(self):
        cmd = [
            sys.executable,
            str(RUN_SCRIPT),
            "--contract", str(self.contract_file),
            "--registry", str(CATALOG_PATH),
            "--verifier-cmd", f"{sys.executable} {self.mock_verifier}",
            "--worktree", str(self.worktree),
            "--workspace-root", str(self.workspace_root),
            "--output-dir", str(self.output_dir),
            "--dry-run",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}")

        result_file = self.output_dir / "result.json"
        self.assertTrue(result_file.exists())
        result_json = json.loads(result_file.read_text(encoding="utf-8"))
        self.assertEqual(result_json.get("final_status"), "succeeded")
        self.assertEqual(result_json.get("termination_reason"), "completed")

        trace_file = self.output_dir / "trace.json"
        self.assertTrue(trace_file.exists())
        trace_lines = [json.loads(line) for line in trace_file.read_text(encoding="utf-8").strip().split("\n") if line]
        self.assertGreaterEqual(len(trace_lines), 1)
        self.assertEqual(trace_lines[0].get("status"), "succeeded")

    def test_worktree_containment_violation_fails_closed(self):
        outside_worktree = self.dir_path / "outside_dir"
        outside_worktree.mkdir(parents=True, exist_ok=True)

        cmd = [
            sys.executable,
            str(RUN_SCRIPT),
            "--contract", str(self.contract_file),
            "--registry", str(CATALOG_PATH),
            "--verifier-cmd", f"{sys.executable} {self.mock_verifier}",
            "--worktree", str(outside_worktree),
            "--workspace-root", str(self.workspace_root),
            "--output-dir", str(self.output_dir),
            "--dry-run",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("containment violation", result.stderr.lower())

        result_file = self.output_dir / "result.json"
        self.assertTrue(result_file.exists())
        result_json = json.loads(result_file.read_text(encoding="utf-8"))
        self.assertEqual(result_json.get("final_status"), "refused")
        self.assertEqual(result_json.get("reason"), "WORKTREE_OUTSIDE_APPROVED_ROOT")

    def test_verifier_rejection_fails_closed(self):
        cmd = [
            sys.executable,
            str(RUN_SCRIPT),
            "--contract", str(self.contract_file),
            "--registry", str(CATALOG_PATH),
            "--verifier-cmd", f"{sys.executable} {self.mock_bad_verifier}",
            "--worktree", str(self.worktree),
            "--workspace-root", str(self.workspace_root),
            "--output-dir", str(self.output_dir),
            "--dry-run",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)

        result_file = self.output_dir / "result.json"
        self.assertTrue(result_file.exists())
        result_json = json.loads(result_file.read_text(encoding="utf-8"))
        self.assertEqual(result_json.get("final_status"), "refused")
        self.assertEqual(result_json.get("reason"), "SIGNATURE_REJECTED")

    def test_missing_registry_fails_closed(self):
        missing_registry = self.dir_path / "nonexistent_registry.json"
        cmd = [
            sys.executable,
            str(RUN_SCRIPT),
            "--contract", str(self.contract_file),
            "--registry", str(missing_registry),
            "--verifier-cmd", f"{sys.executable} {self.mock_verifier}",
            "--worktree", str(self.worktree),
            "--workspace-root", str(self.workspace_root),
            "--output-dir", str(self.output_dir),
            "--dry-run",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)

        result_file = self.output_dir / "result.json"
        self.assertTrue(result_file.exists())
        result_json = json.loads(result_file.read_text(encoding="utf-8"))
        self.assertEqual(result_json.get("final_status"), "refused")
        self.assertEqual(result_json.get("reason"), "CATALOG_EMPTY_OR_UNAVAILABLE")

    def test_malformed_registry_json_fails_closed(self):
        malformed_registry = self.dir_path / "malformed_registry.json"
        malformed_registry.write_text("{not valid json", encoding="utf-8")
        cmd = [
            sys.executable,
            str(RUN_SCRIPT),
            "--contract", str(self.contract_file),
            "--registry", str(malformed_registry),
            "--verifier-cmd", f"{sys.executable} {self.mock_verifier}",
            "--worktree", str(self.worktree),
            "--workspace-root", str(self.workspace_root),
            "--output-dir", str(self.output_dir),
            "--dry-run",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)

        result_file = self.output_dir / "result.json"
        self.assertTrue(result_file.exists())
        result_json = json.loads(result_file.read_text(encoding="utf-8"))
        self.assertEqual(result_json.get("final_status"), "refused")
        self.assertEqual(result_json.get("reason"), "CATALOG_EMPTY_OR_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
