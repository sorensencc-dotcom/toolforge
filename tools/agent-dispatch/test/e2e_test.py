import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from dispatcher import dispatch


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


if __name__ == "__main__":
    unittest.main()
