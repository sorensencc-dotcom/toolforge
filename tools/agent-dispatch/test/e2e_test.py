import sys
import unittest
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from dispatcher import dispatch
from run import execute_dispatch_run


class DryRunE2ETests(unittest.TestCase):
    def test_zero_cost_dry_run_recommends_before_execution_without_live_provider(self):
        events = []
        route = {"provider": "ollama", "model": "configured"}
        contract = {"task": "return a one-line summary", "recommended_route": route, "allowed_routes": [route], "max_attempts": 3, "max_cost_usd": 0}
        def dry_run(route, task, context):
            events.append((route["provider"], task))
            return {"status": "succeeded", "dry_run": True, "cost": 0}
        result = dispatch(contract, {"verification": {"valid": True}, "operator_identity": "local-user", "catalog": [route], "adapters": {"ollama": dry_run}, "announce": lambda recommendation: events.append(("recommendation", recommendation))})
        self.assertEqual(events[0][0], "recommendation")
        self.assertEqual(result["final_status"], "succeeded")
        self.assertEqual(result["attempts"][0]["result"]["cost"], 0)


    def test_forced_failover_records_three_failures_and_total_cost(self):
        with tempfile.TemporaryDirectory() as directory:
            routes = [{"provider": p, "model": m} for p, m in (("ollama", "primary"), ("openrouter", "fallback-1"), ("subscription-cli", "fallback-2"), ("ignored", "fourth"))]
            contract = {"task": "bounded failover verification", "recommended_route": routes[0], "allowed_routes": routes, "max_attempts": 3, "max_cost_usd": 1.0, "operator_override": True}
            def fail(route, task, context):
                return {"status": "failed", "failure_class": "FORCED_TEST_FAILURE", "cost": 0.10}
            result = execute_dispatch_run(contract, {"verification": {"valid": True, "contract_hash": "sha256:forced-fallback"}, "operator_identity": "test-operator", "catalog": routes, "adapters": {route["provider"]: fail for route in routes}}, output_dir=directory, trace_filename="single-run-trace.json")
            self.assertEqual(result["result"]["final_status"], "failed")
            self.assertEqual(len(result["result"]["attempts"]), 3)
            self.assertAlmostEqual(result["result"]["total_cost"], 0.30)
            saved = __import__("json").loads(Path(result["result_path"]).read_text())
            trace = [__import__("json").loads(line) for line in Path(result["trace_path"]).read_text().splitlines()]
            self.assertAlmostEqual(saved["total_cost"], 0.30)
            self.assertEqual(trace[-1]["termination_reason"], "ATTEMPTS_EXHAUSTED")

    def test_operator_override_must_use_allowlisted_routes_end_to_end(self):
        route = {"provider": "ollama", "model": "configured"}
        forbidden = {"provider": "openrouter", "model": "unapproved"}
        contract = {"task": "bounded override verification", "recommended_route": route, "allowed_routes": [route], "max_attempts": 3, "operator_override": True}
        result = dispatch(contract, {"verification": {"valid": True}, "operator_identity": "test-operator", "catalog": [route, forbidden], "operator_override": True, "operator_routes": [forbidden], "adapters": {"openrouter": lambda *_: {"status": "succeeded"}}})
        self.assertEqual(result["final_status"], "refused")
        self.assertEqual(result["reason"], "ROUTE_NOT_ALLOWLISTED")
if __name__ == "__main__":
    unittest.main()
