from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
WRAPPERS_DIR = ROOT / "WRAPPERS"
if str(WRAPPERS_DIR) not in sys.path:
    sys.path.insert(0, str(WRAPPERS_DIR))

from cost_governance_runtime import AtomicBudgetGate, GovernanceViolation, RateCard
from torquequery_routing_runtime import (
    PINNED_SPEC_VERSION,
    TorqueQueryCircuitBreaker,
    TorqueQueryRouteContract,
    TorqueQueryRoutingEngine,
    TorqueQueryTraceLogger,
    request_hash,
)


def valid_payload() -> dict:
    return {
        "task_id": "TQ-001",
        "scope": "S1",
        "success_criteria": ["answer has citations"],
        "allowed_tools": ["torquequery.search"],
        "max_input_tokens": 20000,
        "max_output_tokens": 4000,
        "max_cost_usd": 1.00,
        "max_model_calls": 3,
        "max_tool_calls": 3,
        "max_retries": 2,
        "max_escalations": 1,
        "max_wall_clock_seconds": 60,
        "escalation_policy": "stronger_model",
        "baseline_id": "BASE-TQ-001",
        "provider": "openai",
        "model_snapshot": "gpt-5-mini-2026-08-01",
        "rate_card_version": "v1.0.0",
        "deadline": "2026-08-01T23:59:00Z",
        "side_effect_policy": "read_only",
    }


class TorqueQueryContractTests(unittest.TestCase):
    def test_contract_validates_pinned_parent_scope(self):
        contract = TorqueQueryRouteContract.from_dict(valid_payload())
        self.assertEqual(contract.task_id, "TQ-001")
        self.assertEqual(PINNED_SPEC_VERSION, "CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1")

    def test_missing_budget_field_fails_closed(self):
        payload = valid_payload()
        del payload["max_cost_usd"]
        with self.assertRaises(GovernanceViolation) as ctx:
            TorqueQueryRouteContract.from_dict(payload)
        self.assertEqual(ctx.exception.code, "CONTRACT_INVALID")

    def test_scope_ceiling_violation_fails_closed(self):
        payload = valid_payload()
        payload["scope"] = "S0"
        payload["max_model_calls"] = 2
        with self.assertRaises(GovernanceViolation) as ctx:
            TorqueQueryRouteContract.from_dict(payload)
        self.assertEqual(ctx.exception.code, "SCOPE_CEILING_EXCEEDED")

    def test_baseline_can_be_omitted_only_when_exploratory(self):
        payload = valid_payload()
        del payload["baseline_id"]
        with self.assertRaises(GovernanceViolation):
            TorqueQueryRouteContract.from_dict(payload)
        payload["exploratory"] = True
        self.assertEqual(TorqueQueryRouteContract.from_dict(payload).baseline_id, "EXPLORATORY")


class TorqueQueryBudgetAndRoutingTests(unittest.TestCase):
    def test_budget_gate_blocks_estimated_next_cost_over_remaining_budget(self):
        payload = valid_payload()
        payload["max_cost_usd"] = 0.01
        contract = TorqueQueryRouteContract.from_dict(payload)
        engine = TorqueQueryRoutingEngine()
        gate = AtomicBudgetGate(contract.max_cost_usd)
        card = RateCard("v1.0.0", input_rate=1.0, cached_rate=0.5, output_rate=2.0, reasoning_rate=2.0)
        with self.assertRaises(GovernanceViolation) as ctx:
            engine.reserve_budget(contract, gate, "ATT-001", card)
        self.assertEqual(ctx.exception.code, "BUDGET_EXHAUSTED")

    def test_choose_model_selects_cheapest_capable_model(self):
        engine = TorqueQueryRoutingEngine()
        selected = engine.choose_model(
            [
                {"model": "large", "estimated_cost_usd": 0.05, "capabilities": ["retrieval", "json"]},
                {"model": "small", "estimated_cost_usd": 0.01, "capabilities": ["retrieval"]},
                {"model": "medium", "estimated_cost_usd": 0.02, "capabilities": ["retrieval", "json"]},
            ],
            ["retrieval", "json"],
        )
        self.assertEqual(selected["model"], "medium")

    def test_retry_matrix_limits_are_deterministic(self):
        engine = TorqueQueryRoutingEngine()
        self.assertTrue(engine.retry_decision("timeout", 1).retry_allowed)
        self.assertFalse(engine.retry_decision("timeout", 2).retry_allowed)
        self.assertFalse(engine.retry_decision("safety", 0).retry_allowed)


class TorqueQueryBreakerAndRetrievalTests(unittest.TestCase):
    def test_circuit_breaker_precedence(self):
        breaker = TorqueQueryCircuitBreaker()
        self.assertEqual(
            breaker.evaluate(
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
        self.assertEqual(
            breaker.evaluate(needs_approval=True, unauthorized_side_effect=True),
            "needs_approval",
        )
        self.assertEqual(breaker.terminal_status("needs_approval"), "needs_approval")

    def test_bounded_reformulation_constraints(self):
        engine = TorqueQueryRoutingEngine()
        self.assertTrue(engine.validate_reformulation("abc", "abcdef"))
        with self.assertRaises(GovernanceViolation):
            engine.validate_reformulation("abc", "abcdefg")
        with self.assertRaises(GovernanceViolation):
            engine.validate_reformulation("a" * 300, "a" * 557)

    def test_retrieval_dedup_exact_and_jaccard(self):
        engine = TorqueQueryRoutingEngine()
        self.assertTrue(engine.retrieval_repeated(["A", "B"], ["A", "B"]))
        previous = [f"R{i}" for i in range(10)]
        current = [f"R{i}" for i in range(9)] + ["R-extra"]
        self.assertFalse(engine.retrieval_repeated(previous, current))
        current = [f"R{i}" for i in range(9)]
        self.assertTrue(engine.retrieval_repeated(previous, current))

    def test_repeated_retrieval_increments_no_progress_count(self):
        engine = TorqueQueryRoutingEngine()
        self.assertEqual(engine.record_retrieval(["A", "B"]), 0)
        self.assertEqual(engine.record_retrieval(["A", "B"]), 1)
        self.assertEqual(engine.record_retrieval(["A", "B"]), 2)
        self.assertEqual(engine.circuit_breaker.evaluate(no_progress_count=engine.no_progress_count), "no_progress")


class TorqueQueryTraceAndAdapterTests(unittest.TestCase):
    def test_trace_logger_emits_required_retrieval_metadata(self):
        payload = valid_payload()
        contract = TorqueQueryRouteContract.from_dict(payload)
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "trace.jsonl")
            record = TorqueQueryTraceLogger(path).emit(
                task_id=contract.task_id,
                scope_declared=contract.scope,
                scope_used=contract.scope,
                request_hash=request_hash(payload),
                baseline_id=contract.baseline_id,
                provider=contract.provider,
                model_snapshot=contract.model_snapshot,
                rate_card_version=contract.rate_card_version,
                input_tokens=100,
                cached_input_tokens=20,
                output_tokens=50,
                reasoning_tokens=0,
                tool_calls=1,
                retry_count=0,
                actual_cost_usd=0.001,
                baseline_cost_usd=0.010,
                net_savings_usd=0.009,
                quality_score=0.95,
                success=True,
                failure_class=None,
                escalation=False,
                escalation_count=0,
                termination_reason="success",
                elapsed_ms=123,
                retrieval_ids=["DOC-1", "DOC-2"],
                ranking_mode="hybrid",
                retrieval_timestamp="2026-08-01T23:00:00Z",
                currency="USD",
            )
            self.assertTrue(record["event_id"].startswith("EVT-"))
            self.assertEqual(record["retrieval_ids"], ["DOC-1", "DOC-2"])
            self.assertEqual(len(Path(path).read_text(encoding="utf-8").splitlines()), 1)

    def test_terminal_response_contract(self):
        contract = TorqueQueryRouteContract.from_dict(valid_payload())
        result = TorqueQueryRoutingEngine().terminal_response(
            contract,
            "needs_approval",
            failure_class="empty_retrieval",
            actual_cost_usd=0.0123456,
            retry_count=1,
            escalated=True,
        )
        self.assertEqual(
            set(result),
            {"status", "task_id", "termination_reason", "failure_class", "actual_cost_usd", "retry_count", "escalated"},
        )
        self.assertEqual(result["status"], "needs_approval")
        self.assertEqual(result["actual_cost_usd"], 0.012346)

    def test_adapter_valid_and_invalid_payloads(self):
        adapter = ROOT / "adapters" / "torquequery_routing_adapter.py"
        valid = subprocess.run(
            [sys.executable, str(adapter), json.dumps(valid_payload())],
            capture_output=True,
            text=True,
        )
        self.assertEqual(valid.returncode, 0, valid.stderr)
        self.assertEqual(json.loads(valid.stdout)["status"], "success")

        invalid_payload = valid_payload()
        invalid_payload["scope"] = "BAD"
        invalid = subprocess.run(
            [sys.executable, str(adapter), json.dumps(invalid_payload)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(invalid.returncode, 0)
        self.assertEqual(json.loads(invalid.stdout)["status"], "failed")


if __name__ == "__main__":
    unittest.main()
