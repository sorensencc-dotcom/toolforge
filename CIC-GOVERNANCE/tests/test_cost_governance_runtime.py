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

import json
import os
import subprocess
import sys
import tempfile
from cost_governance_runtime import (
    AtomicBudgetGate,
    CircuitBreakerEngine,
    EvidenceLogger,
    GovernanceViolation,
    RateCard,
    RateCardManager,
    ScalingGateEvaluator,
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


class TestCircuitBreakerEngine(unittest.TestCase):
    def test_7_tier_precedence_order_and_tie_resolution(self):
        engine = CircuitBreakerEngine()

        # Rank 1: budget_exhausted / limit_exceeded beats Rank 2..7
        self.assertEqual(
            engine.evaluate(
                budget_exhausted=True,
                safety_violation=True,
                needs_approval=True,
                unauthorized_side_effect=True,
                repeated_failure=True,
                subtask_failure=True,
                no_progress_count=2,
            ),
            "budget_exhausted",
        )
        self.assertEqual(
            engine.evaluate(
                limit_exceeded=True,
                safety_violation=True,
                needs_approval=True,
                unauthorized_side_effect=True,
                repeated_failure=True,
                subtask_failure=True,
                no_progress_count=2,
            ),
            "limit_exceeded",
        )

        # Rank 2: safety_violation beats Rank 3..7
        self.assertEqual(
            engine.evaluate(
                safety_violation=True,
                needs_approval=True,
                unauthorized_side_effect=True,
                repeated_failure=True,
                subtask_failure=True,
                no_progress_count=2,
            ),
            "safety_violation",
        )

        # Rank 3: needs_approval beats Rank 4..7
        self.assertEqual(
            engine.evaluate(
                needs_approval=True,
                unauthorized_side_effect=True,
                repeated_failure=True,
                subtask_failure=True,
                no_progress_count=2,
            ),
            "needs_approval",
        )

        # Rank 4: unauthorized_side_effect beats Rank 5..7
        self.assertEqual(
            engine.evaluate(
                unauthorized_side_effect=True,
                repeated_failure=True,
                subtask_failure=True,
                no_progress_count=2,
            ),
            "unauthorized_side_effect",
        )

        # Rank 5: repeated_failure beats Rank 6..7
        self.assertEqual(
            engine.evaluate(
                repeated_failure=True,
                subtask_failure=True,
                no_progress_count=2,
            ),
            "repeated_failure",
        )

        # Rank 6: subtask_failure beats Rank 7
        self.assertEqual(
            engine.evaluate(
                subtask_failure=True,
                no_progress_count=2,
            ),
            "subtask_failure",
        )

        # Rank 7: no_progress_count reaches 2
        self.assertEqual(
            engine.evaluate(
                no_progress_count=2,
            ),
            "no_progress",
        )

        # Below threshold for rank 7 returns None
        self.assertIsNone(
            engine.evaluate(
                no_progress_count=1,
            )
        )

    def test_no_progress_count_increment_and_reset(self):
        engine = CircuitBreakerEngine()
        self.assertEqual(engine.no_progress_count, 0)
        self.assertIsNone(engine.evaluate())

        # Increment once
        cnt1 = engine.increment_no_progress()
        self.assertEqual(cnt1, 1)
        self.assertEqual(engine.no_progress_count, 1)
        self.assertIsNone(engine.evaluate())

        # Increment again -> reaches 2 -> triggers no_progress
        cnt2 = engine.increment_no_progress()
        self.assertEqual(cnt2, 2)
        self.assertEqual(engine.no_progress_count, 2)
        self.assertEqual(engine.evaluate(), "no_progress")

        # Reset -> count becomes 0 -> evaluate returns None again
        engine.reset_no_progress()
        self.assertEqual(engine.no_progress_count, 0)
        self.assertIsNone(engine.evaluate())


class TestEvidenceLogger(unittest.TestCase):
    def test_evidence_logger_emits_schema_1_0_0_and_25_fields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = os.path.join(tmpdir, "evidence.jsonl")
            logger = EvidenceLogger(log_path)
            record = logger.emit(
                task_id="TSK-001",
                scope_declared="S1",
                scope_used="S1",
                baseline_id="BASE-01",
                model="gemini-3.6-flash",
                model_snapshot="gemini-3.6-flash-2026-06-01",
                input_tokens=1000,
                cached_input_tokens=200,
                output_tokens=300,
                reasoning_tokens=0,
                tool_calls=1,
                retry_count=0,
                actual_cost_usd=0.005,
                baseline_cost_usd=0.010,
                net_savings_usd=0.005,
                success=True,
                quality_score=0.95,
                failure_class=None,
                escalated=False,
                escalation_count=0,
                termination_reason="completed",
                elapsed_ms=1200,
                provider="google",
                rate_card_version="v1.0.0",
                currency="USD",
            )
            self.assertEqual(record["schema_version"], "1.0.0")
            self.assertTrue(record["event_id"].startswith("EVT-"))
            self.assertEqual(record["model"], "gemini-3.6-flash")
            self.assertEqual(record["model_snapshot"], "gemini-3.6-flash-2026-06-01")
            self.assertEqual(record["currency"], "USD")
            self.assertTrue(os.path.exists(log_path))

            # Verify file content is valid JSONL with 1 line
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            self.assertEqual(len(lines), 1)
            parsed = json.loads(lines[0])
            self.assertEqual(parsed["task_id"], "TSK-001")
            self.assertEqual(parsed["schema_version"], "1.0.0")

    def test_evidence_logger_missing_required_fields_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = os.path.join(tmpdir, "evidence.jsonl")
            logger = EvidenceLogger(log_path)
            with self.assertRaises(GovernanceViolation) as ctx:
                logger.emit(
                    task_id="TSK-001",
                    # missing all other required fields
                )
            self.assertEqual(ctx.exception.code, "EVIDENCE_INVALID")


class TestScalingGateEvaluator(unittest.TestCase):
    def test_scaling_gate_under_50_tasks_returns_insufficient_data(self):
        gate = ScalingGateEvaluator()
        tasks = [{"success": True, "cost": 0.01}] * 49
        result = gate.evaluate(tasks)
        self.assertEqual(result["status"], "REPORT_ONLY")
        self.assertEqual(result["recommendation"], "INSUFFICIENT_DATA")
        self.assertEqual(result["sample_size"], 49)
        self.assertEqual(result["required_sample_size"], 50)

    def test_scaling_gate_50_tasks_pass_and_hold_recommendations(self):
        gate = ScalingGateEvaluator()
        # 46 success / 50 total = 92% >= 90% -> PASS
        pass_tasks = [{"success": True}] * 46 + [{"success": False}] * 4
        result_pass = gate.evaluate(pass_tasks)
        self.assertEqual(result_pass["status"], "REPORT_ONLY")
        self.assertEqual(result_pass["recommendation"], "PASS")
        self.assertEqual(result_pass["sample_size"], 50)
        self.assertEqual(result_pass["success_rate"], 0.92)

        # 40 success / 50 total = 80% < 90% -> HOLD
        hold_tasks = [{"success": True}] * 40 + [{"success": False}] * 10
        result_hold = gate.evaluate(hold_tasks)
        self.assertEqual(result_hold["status"], "REPORT_ONLY")
        self.assertEqual(result_hold["recommendation"], "HOLD")
        self.assertEqual(result_hold["sample_size"], 50)
        self.assertEqual(result_hold["success_rate"], 0.80)


class TestCostGateAdapter(unittest.TestCase):
    def test_cost_gate_adapter_cli_valid_contract(self):
        valid_contract_json = json.dumps({
            "task_id": "TSK-CLI-01",
            "scope": "S1",
            "success_criteria": ["ok"],
            "allowed_tools": [],
            "side_effect_policy": "read_only",
            "max_model_calls": 3,
            "max_tool_calls": 0,
            "max_input_tokens": 20000,
            "max_output_tokens": 4000,
            "max_cost_usd": 1.00,
            "max_wall_clock_seconds": 60,
            "max_retries": 1,
            "max_escalations": 0,
            "escalation_policy": "none",
            "baseline_id": "BASE-01",
            "provider": "google",
            "model_snapshot": "gemini-3.6-flash-2026-06-01",
            "rate_card_version": "v1.0.0",
        })
        adapter_path = os.path.join(ROOT, "adapters", "cost_gate_adapter.py")
        proc = subprocess.run(
            [sys.executable, adapter_path, valid_contract_json],
            capture_output=True, text=True
        )
        self.assertEqual(proc.returncode, 0)
        output = json.loads(proc.stdout.strip())
        self.assertEqual(output["status"], "PASS")
        self.assertEqual(output["task_id"], "TSK-CLI-01")
        self.assertEqual(output["scope"], "S1")
        self.assertEqual(output["spec_version"], "CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1")
        self.assertIn("message", output)

    def test_cost_gate_adapter_cli_invalid_contract(self):
        invalid_contract_json = json.dumps({
            "task_id": "TSK-CLI-02",
            "scope": "S0",  # S0 permits max 1 call
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
        })
        adapter_path = os.path.join(ROOT, "adapters", "cost_gate_adapter.py")
        proc = subprocess.run(
            [sys.executable, adapter_path, invalid_contract_json],
            capture_output=True, text=True
        )
        self.assertEqual(proc.returncode, 0)
        output = json.loads(proc.stdout.strip())
        self.assertEqual(output["status"], "FAIL")
        self.assertEqual(output["code"], "SCOPE_CEILING_EXCEEDED")
        self.assertIn("message", output)

    def test_cost_gate_adapter_cli_missing_arguments(self):
        adapter_path = os.path.join(ROOT, "adapters", "cost_gate_adapter.py")
        proc = subprocess.run(
            [sys.executable, adapter_path],
            capture_output=True, text=True
        )
        self.assertNotEqual(proc.returncode, 0)
        output = json.loads(proc.stdout.strip())
        self.assertEqual(output["status"], "ERROR")
        self.assertIn("message", output)


if __name__ == "__main__":
    unittest.main()



