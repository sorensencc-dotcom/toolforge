import json
import tempfile
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
from contract_verifier import ContractVerificationError, verify_contract
from preflight import PreflightResult, run_preflight

sys.path.insert(0, str(Path(__file__).parent))
from test_helpers import ManagedTempDir


class VerifierBoundaryTests(unittest.TestCase):
    def test_nonzero_verifier_result_fails_closed(self):
        with ManagedTempDir("verifier_") as root:
            (root / "contract.json").write_text("{}")
            (root / "registry.json").write_text('{"endpoints": []}')
            completed = type("Completed", (), {"stdout": json.dumps({"valid": False, "reason": "SIGNATURE_INVALID"}), "returncode": 1})()
            with patch("subprocess.run", return_value=completed):
                with self.assertRaisesRegex(ContractVerificationError, "SIGNATURE_INVALID"):
                    verify_contract(root / "contract.json", root / "registry.json", ["sigil", "verify-contract"])



    def test_malformed_verifier_response_fails_closed(self):
        completed = type("Completed", (), {"stdout": "not-json", "returncode": 0})()
        with patch("subprocess.run", return_value=completed):
            with self.assertRaisesRegex(ContractVerificationError, "BAD_RESPONSE"):
                verify_contract(Path("contract.json"), Path("registry.json"), ["sigil", "verify-contract"])


class PreflightPolicyTests(unittest.TestCase):
    def setUp(self):
        self.zero_route = {
            "provider": "ollama",
            "model": "configured",
            "execution_mode": "local_http",
            "cost_policy": {"input_per_1k": 0, "output_per_1k": 0},
            "credential_ref": "none",
        }
        self.billable_route = {
            "provider": "openrouter",
            "model": "deepseek-r1",
            "execution_mode": "openrouter_http",
            "cost_policy": {"input_per_1k": 0.002, "output_per_1k": 0.008},
            "credential_ref": "openrouter",
        }
        self.contract = {
            "contract_version": "1.0",
            "task_id": "TASK-001",
            "task": "summarize",
            "recommended_route": self.zero_route,
            "allowed_routes": [self.zero_route, self.billable_route],
            "max_cost_usd": 0.50,
            "max_attempts": 3,
            "expires_at": "2026-08-27T23:59:59Z",
            "operator_override": True,
            "signature": {"algorithm": "Ed25519", "key_id": "k1", "value": "sig"},
        }

    def test_preflight_invokes_adapter_once_and_returns_classified_routes(self):
        invocations = []
        def adapter(payload):
            invocations.append(payload)
            return {
                "status": "success",
                "recommended_route": self.zero_route,
                "allowed_fallbacks": [self.billable_route],
                "expected_cost": 0.0,
                "reason": "policy-approved",
            }

        with patch("preflight.verify_contract", return_value={"valid": True, "contract_hash": "sha256:abc"}):
            result = run_preflight(
                self.contract,
                Path("contract.json"),
                Path("registry.json"),
                ["sigil", "verify"],
                adapter,
            )

        self.assertEqual(len(invocations), 1)
        self.assertIsInstance(result, PreflightResult)
        self.assertEqual(result.recommendation["provider"], "ollama")
        self.assertEqual(result.recommendation.get("cost_classification"), "zero-cost")
        self.assertEqual(len(result.candidate_routes), 2)
        self.assertEqual(result.candidate_routes[1].get("cost_classification"), "billable")

    def test_preflight_fails_on_policy_rejection(self):
        def adapter(payload):
            return {"status": "failed", "termination_reason": "POLICY_DENIED_UNSAFE_SCOPE"}

        with patch("preflight.verify_contract", return_value={"valid": True, "contract_hash": "sha256:abc"}):
            with self.assertRaisesRegex(RuntimeError, "POLICY_DENIED_UNSAFE_SCOPE"):
                run_preflight(
                    self.contract,
                    Path("contract.json"),
                    Path("registry.json"),
                    ["sigil", "verify"],
                    adapter,
                )

    def test_preflight_fails_on_empty_recommendation(self):
        def adapter(payload):
            return {"status": "success", "recommended_route": None, "allowed_fallbacks": []}

        contract_without_route = dict(self.contract)
        contract_without_route["recommended_route"] = None
        with patch("preflight.verify_contract", return_value={"valid": True, "contract_hash": "sha256:abc"}):
            with self.assertRaisesRegex(RuntimeError, "EMPTY_RECOMMENDATION"):
                run_preflight(
                    contract_without_route,
                    Path("contract.json"),
                    Path("registry.json"),
                    ["sigil", "verify"],
                    adapter,
                )


if __name__ == "__main__":
    unittest.main()
