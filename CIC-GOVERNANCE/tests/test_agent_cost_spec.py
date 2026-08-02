import re
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
CIC_SPEC = ROOT / "SPEC" / "CIC-AI-AGENT-COST-SPEC-001.md"
TORQUE_POLICY = ROOT.parent / "docs" / "meta" / "specs" / "torquequery-ai-agent-routing-policy.md"


class AgentCostSpecificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cic = CIC_SPEC.read_text(encoding="utf-8")
        cls.torque = TORQUE_POLICY.read_text(encoding="utf-8")

    def test_documents_exist_and_are_candidates(self):
        self.assertIn('status: "candidate"', self.cic)
        self.assertIn("status: CANDIDATE", self.torque)
        self.assertIn("CANDIDATE — NOT RATIFIED", self.cic)

    def test_cic_task_contract_has_independent_limits(self):
        required = (
            "max_model_calls", "max_tool_calls", "max_input_tokens",
            "max_output_tokens", "max_cost_usd", "max_retries",
            "max_escalations", "scope", "baseline_id",
        )
        for field in required:
            self.assertRegex(self.cic, rf"(?m)^{re.escape(field)}:", msg=field)

    def test_torque_pins_parent_scope_contract(self):
        self.assertIn(
            'parent_spec: "CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1"',
            self.torque,
        )
        self.assertIn("caller-declared scope against the pinned parent ceiling", self.torque)
        self.assertIn('"max_escalations": 0', self.torque)

    def test_budget_gate_checks_before_reserving(self):
        gate = self.torque.split("## Fail-fast circuit breakers", 1)[0]
        check = gate.index("if estimated_next_cost > remaining_budget:")
        reserve = gate.index("reserve estimated_next_cost")
        self.assertLess(check, reserve)
        self.assertIn("terminate budget_exhausted", gate)

    def test_progress_and_precedence_are_deterministic(self):
        section = self.torque.split("## Fail-fast circuit breakers", 1)[1].split(
            "## TorqueQuery-specific behavior", 1
        )[0]
        self.assertIn("shared `no_progress_count` reaches 2", section)
        self.assertLess(section.index("hard budget"), section.index("safety or authorization"))
        self.assertLess(section.index("safety or authorization"), section.index("two identical failures"))
        self.assertIn("increment the same `no_progress_count`", section)

    def test_retrieval_reformulation_and_deduplication_are_bounded(self):
        self.assertIn("no more than 2x the original query", self.torque)
        self.assertIn("no more than 256 characters", self.torque)
        self.assertIn("Jaccard similarity is at least 0.90", self.torque)
        self.assertIn("shared `max_escalations` budget", self.torque)

    def test_evidence_and_terminal_response_are_aligned(self):
        self.assertIn("scope_declared, scope_used", self.cic)
        self.assertIn("scope_declared, scope_used", self.torque)
        self.assertIn("model, input_tokens", self.cic)
        self.assertIn('"failure_class": "string|null"', self.torque)
        for field in ("actual_cost_usd", "retry_count", "termination_reason"):
            self.assertIn(f'"{field}"', self.torque)

    def test_scaling_exception_requires_tier1_and_evidence(self):
        self.assertIn("at least 50 completed tasks", self.torque)
        self.assertIn("Tier 1 approval", self.torque)
        self.assertIn("confidence level, sample size, and acceptance thresholds", self.torque)


if __name__ == "__main__":
    unittest.main()
