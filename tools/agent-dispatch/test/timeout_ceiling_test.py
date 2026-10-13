#!/usr/bin/env python3
"""timeout_ceiling_test.py

Validates timeout fault recovery and the strict 3-attempt ceiling
in Toolforge's agent-dispatch subsystem.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any

DISPATCH_ROOT = Path("C:/dev/tools/agent-dispatch")
if str(DISPATCH_ROOT) not in sys.path:
    sys.path.insert(0, str(DISPATCH_ROOT))

from dispatcher import dispatch


class DispatcherTimeoutCeilingTests(unittest.TestCase):
    """Enforces timeout retry behavior and the maximum attempt boundary."""

    def setUp(self) -> None:
        self.routes = [
            {"provider": "subscription-cli", "model": "claude-3-7-sonnet", "execution_mode": "local"},
            {"provider": "ollama", "model": "qwen2.5-coder:32b", "execution_mode": "local"},
            {"provider": "openrouter", "model": "anthropic/claude-3.5-sonnet", "execution_mode": "cloud"},
            {"provider": "spare-fallback", "model": "mistral-large", "execution_mode": "cloud"},
        ]
        self.contract = {
            "task": "task-triage-kb-sync-trm-001",
            "recommended_route": self.routes[0],
            "allowed_routes": self.routes,
            "max_attempts": 4,  # Over ceiling
            "operator_override": False,
        }
        self.options = {
            "verification": {"valid": True, "contract_hash": "sha256:contract-kb-sync-trm"},
            "operator_identity": "operator@toolforge.local",
            "catalog": self.routes,
            "execution_context": {"timeout_seconds": 45},
        }

    def test_timeout_exhaustion_terminates_at_three_attempts(self) -> None:
        """Verifies that 4 sequential timeouts stop at attempt 3 with ATTEMPTS_EXHAUSTED."""
        invoked_providers: list[str] = []

        def timeout_adapter(route: dict[str, Any], task: str, ctx: dict[str, Any]) -> dict[str, Any]:
            invoked_providers.append(route["provider"])
            return {
                "status": "failed",
                "failure_class": "TIMEOUT",
                "provider": route["provider"],
                "model": route["model"],
                "cost": 0.0,
                "stderr": f"Execution timed out after {ctx.get('timeout_seconds', 45)}s",
            }

        adapters = {route["provider"]: timeout_adapter for route in self.routes}
        options = {**self.options, "adapters": adapters}

        result = dispatch(self.contract, options)

        self.assertEqual(len(result["attempts"]), 3)
        self.assertEqual(len(invoked_providers), 3)
        self.assertEqual(
            invoked_providers,
            ["subscription-cli", "ollama", "openrouter"],
        )
        self.assertNotIn("spare-fallback", invoked_providers)
        self.assertEqual(result["final_status"], "failed")
        self.assertEqual(result["termination_reason"], "ATTEMPTS_EXHAUSTED")
        self.assertEqual(result["reason"], "ATTEMPTS_EXHAUSTED")
        self.assertEqual(result["contract_hash"], "sha256:contract-kb-sync-trm")

        for attempt in result["attempts"]:
            self.assertEqual(attempt["result"]["status"], "failed")
            self.assertEqual(attempt["result"]["failure_class"], "TIMEOUT")

    def test_recovery_on_second_attempt_stops_dispatch(self) -> None:
        """Verifies that success after a timeout stops execution before attempt 3."""
        invoked_providers: list[str] = []

        def provider_one(route: dict[str, Any], task: str, ctx: dict[str, Any]) -> dict[str, Any]:
            invoked_providers.append(route["provider"])
            return {"status": "failed", "failure_class": "TIMEOUT", "cost": 0.0}

        def provider_two(route: dict[str, Any], task: str, ctx: dict[str, Any]) -> dict[str, Any]:
            invoked_providers.append(route["provider"])
            return {"status": "succeeded", "cost": 0.002, "failure_class": None}

        adapters = {
            "subscription-cli": provider_one,
            "ollama": provider_two,
            "openrouter": lambda r, t, c: {"status": "failed"},
        }
        options = {**self.options, "adapters": adapters}

        result = dispatch(self.contract, options)

        self.assertEqual(len(result["attempts"]), 2)
        self.assertEqual(invoked_providers, ["subscription-cli", "ollama"])
        self.assertEqual(result["final_status"], "succeeded")
        self.assertEqual(result["final_provider"], "ollama")
        self.assertEqual(result["termination_reason"], "completed")
        self.assertEqual(result["total_cost"], 0.002)

    def test_end_to_end_trace_records_timeout_and_ceiling(self) -> None:
        """Verifies execute_dispatch_run writes trace.json and result.json correctly."""
        import tempfile
        import json
        from run import execute_dispatch_run

        def timeout_adapter(route: dict[str, Any], task: str, ctx: dict[str, Any]) -> dict[str, Any]:
            return {
                "status": "failed",
                "failure_class": "TIMEOUT",
                "provider": route["provider"],
                "model": route["model"],
                "cost": 0.0,
            }

        adapters = {route["provider"]: timeout_adapter for route in self.routes}
        options = {**self.options, "adapters": adapters}

        with tempfile.TemporaryDirectory() as tmpdir:
            run_output = execute_dispatch_run(
                contract=self.contract,
                options=options,
                output_dir=tmpdir,
                trace_filename="trace.json",
                truncate_trace=True,
            )

            result_file = Path(run_output["result_path"])
            trace_file = Path(run_output["trace_path"])

            self.assertTrue(result_file.is_file())
            self.assertTrue(trace_file.is_file())

            result_data = json.loads(result_file.read_text(encoding="utf-8"))
            self.assertEqual(result_data["final_status"], "failed")
            self.assertEqual(result_data["termination_reason"], "ATTEMPTS_EXHAUSTED")
            self.assertEqual(len(result_data["attempts"]), 3)

            trace_lines = [
                json.loads(line)
                for line in trace_file.read_text(encoding="utf-8").strip().splitlines()
                if line.strip()
            ]
            events = [entry["event"] for entry in trace_lines]
            self.assertEqual(events, ["dispatch_start", "attempt", "attempt", "attempt", "dispatch_end"])


if __name__ == "__main__":
    unittest.main()
