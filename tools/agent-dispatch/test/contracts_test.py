from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).parents[1]
CONTRACT_SCHEMA = ROOT / "contracts" / "task-contract.schema.json"
CATALOG = ROOT / "providers" / "catalog.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def valid_contract() -> dict:
    return {
        "contract_version": "1.0",
        "task_id": "TASK-001",
        "task": "Summarize the supplied bounded work item.",
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
        "expires_at": "2026-08-25T23:59:00Z",
        "operator_override": False,
        "signature": {"algorithm": "Ed25519", "key_id": "test-key", "value": "placeholder"},
    }


class ContractSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = load_json(CONTRACT_SCHEMA)
        cls.validator = Draft202012Validator(cls.schema)
        cls.catalog = load_json(CATALOG)

    def assert_contract_invalid(self, contract: dict) -> None:
        self.assertTrue(
            list(self.validator.iter_errors(contract)),
            f"contract unexpectedly validated: {contract}",
        )

    def test_contract_requires_signed_task_fields(self):
        contract = valid_contract()
        for field in (
            "contract_version",
            "task_id",
            "task",
            "recommended_route",
            "allowed_routes",
            "max_cost_usd",
            "max_attempts",
            "expires_at",
            "operator_override",
            "signature",
        ):
            missing = contract.copy()
            del missing[field]
            self.assert_contract_invalid(missing)

    def test_max_attempts_cannot_exceed_three(self):
        contract = valid_contract()
        contract["max_attempts"] = 4
        self.assert_contract_invalid(contract)

    def test_task_cannot_supply_executable_commands(self):
        contract = valid_contract()
        contract["task"] = {"prompt": "do work", "command": ["powershell", "-c", "whoami"]}
        self.assert_contract_invalid(contract)

    def test_zero_cost_route_requires_exact_metered_policy(self):
        contract = valid_contract()
        route = contract["recommended_route"]
        route["cost_policy"] = {"input_per_1k": 0, "output_per_1k": 0.0001}
        self.assert_contract_invalid(contract)

    def test_zero_cost_route_requires_exact_flat_policy(self):
        contract = valid_contract()
        route = contract["recommended_route"]
        route["cost_policy"] = {"flat": 0.01}
        self.assert_contract_invalid(contract)

    def test_expiry_requires_utc_iso_timestamp_with_skew_rule(self):
        contract = valid_contract()
        contract["expires_at"] = "2026-08-25T23:59:00+00:00"
        self.assert_contract_invalid(contract)

        now = datetime(2026, 8, 25, 23, 57, 59, tzinfo=timezone.utc)
        expiry = datetime.fromisoformat(valid_contract()["expires_at"].replace("Z", "+00:00"))
        self.assertGreater(expiry - now, timedelta(seconds=60))

    def test_catalog_routes_have_static_provider_configuration(self):
        self.assertGreaterEqual(len(self.catalog["routes"]), 3)
        for route in self.catalog["routes"]:
            self.assertNotIn("credential", route)
            self.assertIn("credential_ref", route)
            self.assertIn("executable", route.get("command", {}))
            self.assertNotIn("command", valid_contract()["task"])


if __name__ == "__main__":
    unittest.main()

