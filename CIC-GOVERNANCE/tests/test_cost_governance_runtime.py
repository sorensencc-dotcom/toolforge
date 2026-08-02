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
    AtomicBudgetGate,
    GovernanceViolation,
    RateCard,
    RateCardManager,
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


class TestRateCardAndAtomicBudgetGate(unittest.TestCase):
    def test_rate_card_token_cost_calculations(self):
        card = RateCard(
            version="v1.0.0",
            input_rate=1.0,
            cached_rate=0.5,
            output_rate=2.0,
            reasoning_rate=3.0,
        )
        cost = card.calculate(
            uncached_input=1_000_000,
            cached_input=2_000_000,
            output=500_000,
            reasoning=100_000,
            tool_cost=0.50,
            infra_cost=0.20,
        )
        # 1M uncached input * $1/M = 1.00
        # 2M cached input * $0.5/M = 1.00
        # 500k output * $2/M = 1.00
        # 100k reasoning * $3/M = 0.30
        # tool_cost = 0.50
        # infra_cost = 0.20
        # Total = 4.00
        self.assertEqual(cost, 4.00)

    def test_rate_card_pinned_to_attempt(self):
        rcm = RateCardManager()
        rcm.register(
            version="v1.0.0",
            input_rate=1.0,
            cached_rate=0.5,
            output_rate=2.0,
            reasoning_rate=3.0,
        )
        rcm.register(
            version="v2.0.0",
            input_rate=2.0,
            cached_rate=1.0,
            output_rate=4.0,
            reasoning_rate=6.0,
        )
        card_v1 = rcm.get("v1.0.0")
        card_v2 = rcm.get("v2.0.0")

        cost_v1 = card_v1.calculate(
            uncached_input=1_000_000, cached_input=0, output=500_000, reasoning=0
        )
        cost_v2 = card_v2.calculate(
            uncached_input=1_000_000, cached_input=0, output=500_000, reasoning=0
        )

        self.assertEqual(cost_v1, 2.00)
        self.assertEqual(cost_v2, 4.00)

    def test_atomic_budget_gate_reservation_and_overspend_prevention(self):
        gate = AtomicBudgetGate(max_cost_usd=1.00)
        card = RateCard(
            version="v1.0.0",
            input_rate=1.0,
            cached_rate=0.5,
            output_rate=2.0,
            reasoning_rate=3.0,
        )

        # Reserve attempt 1 within budget ($0.50)
        res_id = gate.reserve(
            task_id="TSK-001",
            attempt_id="ATT-001",
            rate_card=card,
            estimated_input=250_000,
            estimated_output=125_000,
        )
        self.assertEqual(res_id, "ATT-001-RES")
        self.assertEqual(gate.remaining_budget("TSK-001"), 0.50)

        # Attempt 2 reservation exceeding remaining budget ($0.60 > $0.50) fails closed with BUDGET_EXHAUSTED
        with self.assertRaises(GovernanceViolation) as ctx:
            gate.reserve(
                task_id="TSK-001",
                attempt_id="ATT-002",
                rate_card=card,
                estimated_input=300_000,
                estimated_output=150_000,
            )
        self.assertEqual(ctx.exception.code, "BUDGET_EXHAUSTED")

    def test_duplicate_reservation_detection(self):
        gate = AtomicBudgetGate(max_cost_usd=2.00)
        card = RateCard(
            version="v1.0.0",
            input_rate=1.0,
            cached_rate=0.5,
            output_rate=2.0,
            reasoning_rate=3.0,
        )
        gate.reserve(
            task_id="TSK-001",
            attempt_id="ATT-001",
            rate_card=card,
            estimated_input=100_000,
            estimated_output=100_000,
        )

        with self.assertRaises(GovernanceViolation) as ctx:
            gate.reserve(
                task_id="TSK-001",
                attempt_id="ATT-001",
                rate_card=card,
                estimated_input=100_000,
                estimated_output=100_000,
            )
        self.assertEqual(ctx.exception.code, "DUPLICATE_RESERVATION")

    def test_reservation_release_and_rollback(self):
        gate = AtomicBudgetGate(max_cost_usd=1.00)
        card = RateCard(
            version="v1.0.0",
            input_rate=1.0,
            cached_rate=0.5,
            output_rate=2.0,
            reasoning_rate=3.0,
        )
        res_id = gate.reserve(
            task_id="TSK-001",
            attempt_id="ATT-001",
            rate_card=card,
            estimated_input=250_000,
            estimated_output=125_000,
        )
        self.assertEqual(gate.remaining_budget("TSK-001"), 0.50)

        # Rollback / release reservation
        gate.release_reservation("TSK-001", res_id)
        self.assertEqual(gate.remaining_budget("TSK-001"), 1.00)

    def test_atomic_budget_gate_thread_safety(self):
        import threading

        gate = AtomicBudgetGate(max_cost_usd=100.00)
        card = RateCard(
            version="v1.0.0",
            input_rate=1.0,
            cached_rate=0.5,
            output_rate=2.0,
            reasoning_rate=3.0,
        )
        errors = []

        def worker(i: int):
            try:
                gate.reserve(
                    task_id="TSK-001",
                    attempt_id=f"ATT-THREAD-{i}",
                    rate_card=card,
                    estimated_input=100_000,  # $0.10 cost
                    estimated_output=0,
                )
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)
        # 50 reservations * $0.10 = $5.00 reserved -> $95.00 remaining
        self.assertAlmostEqual(gate.remaining_budget("TSK-001"), 95.00, places=4)


if __name__ == "__main__":
    unittest.main()

