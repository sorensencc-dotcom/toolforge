from __future__ import annotations
import os
import sys
import unittest
from pathlib import Path

# Ensure WRAPPERS directory is in sys.path
ROOT = Path(__file__).parents[1]
WRAPPERS_DIR = ROOT / "WRAPPERS"
if str(WRAPPERS_DIR) not in sys.path:
    sys.path.insert(0, str(WRAPPERS_DIR))

from cost_governance_runtime import (
    GovernanceViolation,
    ScopeLimitsRegistry,
    TaskContract,
)


class TestScopeLimitsAndTaskContract(unittest.TestCase):
    def test_scope_limits_version_mismatch_fails_closed(self):
        with self.assertRaises(GovernanceViolation) as ctx:
            ScopeLimitsRegistry("INVALID-VERSION-1.0")
        self.assertEqual(ctx.exception.code, "SCOPE_VERSION_MISMATCH")

    def test_task_contract_validates_required_fields(self):
        valid_payload = {
            "task_id": "TSK-001",
            "scope": "S1",
            "success_criteria": ["pass_test"],
            "allowed_tools": ["search"],
            "side_effect_policy": "read_only",
            "max_model_calls": 3,
            "max_tool_calls": 5,
            "max_input_tokens": 20000,
            "max_output_tokens": 4000,
            "max_cost_usd": 1.50,
            "max_wall_clock_seconds": 60,
            "max_retries": 2,
            "max_escalations": 1,
            "escalation_policy": "stronger_model",
            "baseline_id": "BASE-001",
            "provider": "google",
            "model_snapshot": "gemini-3.6-flash-2026-06-01",
            "rate_card_version": "v1.0.0",
        }
        contract = TaskContract.from_dict(valid_payload)
        self.assertEqual(contract.task_id, "TSK-001")
        self.assertEqual(contract.scope, "S1")

    def test_task_contract_rejects_missing_field(self):
        invalid_payload = {
            "task_id": "TSK-001",
            # missing scope
            "success_criteria": ["pass_test"],
        }
        with self.assertRaises(GovernanceViolation) as ctx:
            TaskContract.from_dict(invalid_payload)
        self.assertEqual(ctx.exception.code, "CONTRACT_INVALID")

    def test_task_contract_rejects_broadening_scope(self):
        payload = {
            "task_id": "TSK-002",
            "scope": "S0",  # S0 permits max 1 call, 2000 input tokens
            "success_criteria": [],
            "allowed_tools": [],
            "side_effect_policy": "read_only",
            "max_model_calls": 5,  # Exceeds S0 ceiling of 1
            "max_tool_calls": 0,
            "max_input_tokens": 2000,
            "max_output_tokens": 1000,
            "max_cost_usd": 0.50,
            "max_wall_clock_seconds": 30,
            "max_retries": 0,
            "max_escalations": 0,
            "escalation_policy": "none",
            "baseline_id": "BASE-001",
            "provider": "google",
            "model_snapshot": "gemini-3.6-flash-2026-06-01",
            "rate_card_version": "v1.0.0",
        }
        with self.assertRaises(GovernanceViolation) as ctx:
            TaskContract.from_dict(payload)
        self.assertEqual(ctx.exception.code, "SCOPE_CEILING_EXCEEDED")


if __name__ == "__main__":
    unittest.main()
