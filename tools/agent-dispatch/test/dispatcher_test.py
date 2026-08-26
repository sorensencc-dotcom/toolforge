import sys
import unittest
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from dispatcher import dispatch


class DispatcherTests(unittest.TestCase):
    def setUp(self):
        self.a = {"provider": "ollama", "model": "a"}
        self.b = {"provider": "openrouter", "model": "b"}
        self.contract = {"task": "bounded", "recommended_route": self.a, "allowed_routes": [self.a, self.b], "max_attempts": 3, "operator_override": True}
        self.base = {"verification": {"valid": True}, "operator_identity": "local-user", "catalog": [self.a, self.b]}

    def test_recommendation_precedes_first_attempt_and_fallback_stops_on_success(self):
        events = []
        def adapter(route, task, context):
            events.append(route["provider"])
            return {"status": "succeeded"}
        result = dispatch(self.contract, {**self.base, "adapters": {"ollama": adapter}, "announce": lambda route: events.append("announce")})
        self.assertEqual(events, ["announce", "ollama"])
        self.assertEqual(result["final_status"], "succeeded")
        self.assertEqual(result["operator_identity"], "local-user")
        self.assertEqual(result["termination_reason"], "completed")

    def test_result_carries_contract_hash_and_artifact_paths(self):
        result = dispatch(self.contract, {**self.base, "verification": {"valid": True, "contract_hash": "sha256:test"}, "artifact_paths": ["result.json"], "adapters": {"ollama": lambda r, t, c: {"status": "succeeded"}}})
        self.assertEqual(result["contract_hash"], "sha256:test")
        self.assertEqual(result["artifact_paths"], ["result.json"])

    def test_operator_cannot_select_out_of_contract_route(self):
        bad = {"provider": "subscription-cli", "model": "bad"}
        result = dispatch(self.contract, {**self.base, "operator_override": True, "operator_routes": [bad], "adapters": {}})
        self.assertEqual(result["final_status"], "refused")

    def test_attempts_are_bounded_at_three(self):
        routes = [{"provider": str(i), "model": str(i)} for i in range(4)]
        contract = {"task": "x", "recommended_route": routes[0], "allowed_routes": routes, "max_attempts": 3}
        result = dispatch(contract, {"verification": {"valid": True}, "operator_identity": "local-user", "catalog": routes, "adapters": {str(i): lambda r, t, c: {"status": "failed"} for i in range(4)}})
        self.assertEqual(len(result["attempts"]), 3)

    def test_worktree_must_be_contained_by_approved_root(self):
        with tempfile.TemporaryDirectory() as root_dir, tempfile.TemporaryDirectory() as outside_dir:
            result = dispatch(self.contract, {
                **self.base,
                "worktree": outside_dir,
                "workspace_root": root_dir,
                "adapters": {},
            })
        self.assertEqual(result["final_status"], "refused")
        self.assertEqual(result["reason"], "WORKTREE_OUTSIDE_APPROVED_ROOT")


if __name__ == "__main__": unittest.main()
