import json
import tempfile
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
from contract_verifier import ContractVerificationError, verify_contract


class VerifierBoundaryTests(unittest.TestCase):
    def test_nonzero_verifier_result_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
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


if __name__ == "__main__":
    unittest.main()


