from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))

from contract_signer import ContractSigningError, sign_contract
from contract_verifier import ContractVerificationError, verify_contract


class Completed:
    def __init__(self, stdout: str = "", returncode: int = 0) -> None:
        self.stdout = stdout
        self.returncode = returncode


class ContractToolingTests(unittest.TestCase):
    contract = Path("contract.json")
    identity = Path("identity.json")
    registry = Path("registry.json")

    @patch("contract_signer.subprocess.run")
    def test_sign_contract_returns_last_json_line(self, run):
        run.return_value = Completed("progress\n{\"signed\":true}\n")

        result = sign_contract(self.contract, self.identity, ["sigil", "sign-contract"])

        self.assertEqual(result, {"signed": True})
        run.assert_called_once_with(
            ["sigil", "sign-contract", "--contract", "contract.json", "--identity", "identity.json"],
            capture_output=True, text=True, timeout=10, check=False,
        )

    @patch("contract_signer.subprocess.run", side_effect=subprocess.TimeoutExpired("sigil", 10))
    def test_sign_contract_maps_unavailable_process(self, _run):
        with self.assertRaisesRegex(ContractSigningError, "SIGIL_SIGNER_UNAVAILABLE"):
            sign_contract(self.contract, self.identity, ["sigil", "sign-contract"])

    @patch("contract_verifier.subprocess.run")
    def test_verify_contract_accepts_valid_result(self, run):
        run.return_value = Completed(json.dumps({"valid": True, "reason": "ok"}))

        result = verify_contract(self.contract, self.registry, ["sigil", "verify-contract"])

        self.assertTrue(result["valid"])

    @patch("contract_verifier.subprocess.run")
    def test_verify_contract_rejects_invalid_signature(self, run):
        run.return_value = Completed(json.dumps({"valid": False, "reason": "expired"}))

        with self.assertRaisesRegex(ContractVerificationError, "expired"):
            verify_contract(self.contract, self.registry, ["sigil", "verify-contract"])

    @patch("contract_verifier.subprocess.run")
    def test_verify_contract_rejects_malformed_response(self, run):
        run.return_value = Completed("not-json")

        with self.assertRaisesRegex(ContractVerificationError, "SIGIL_VERIFIER_BAD_RESPONSE"):
            verify_contract(self.contract, self.registry, ["sigil", "verify-contract"])


if __name__ == "__main__":
    unittest.main()
