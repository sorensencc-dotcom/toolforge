import sys
import unittest
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from dispatcher import dispatch

sys.path.insert(0, str(Path(__file__).parent))
from test_helpers import ManagedTempDir


class DispatcherTests(unittest.TestCase):
    def setUp(self):
        self.a = {"provider": "ollama", "model": "a", "execution_mode": "local_http", "credential_ref": "none", "cost_policy": {"input_per_1k": 0, "output_per_1k": 0}}
        self.b = {"provider": "openrouter", "model": "b", "execution_mode": "openrouter_http", "credential_ref": "openrouter", "cost_policy": {"input_per_1k": 0.001, "output_per_1k": 0.002}}
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

    def test_preflight_recommendation_overrides_contract_default(self):
        events = []
        def adapter(route, task, context):
            events.append(f"{route['provider']}:{route['model']}")
            return {"status": "succeeded"}
        # Contract recommends 'a' (ollama), but preflight recommends 'b' (openrouter)
        result = dispatch(
            self.contract,
            {
                **self.base,
                "recommendation": self.b,
                "allowed_fallbacks": [self.b, self.a],
                "adapters": {"ollama": adapter, "openrouter": adapter},
            },
        )
        self.assertEqual(events, ["openrouter:b"])
        self.assertEqual(result["final_status"], "succeeded")
        self.assertEqual(result["final_provider"], "openrouter")
        self.assertEqual(result["final_model"], "b")

    def test_preflight_out_of_contract_route_is_rejected(self):
        evil = {"provider": "openrouter", "model": "evil", "execution_mode": "openrouter_http", "credential_ref": "openrouter", "cost_policy": {"input_per_1k": 0.001, "output_per_1k": 0.002}}
        # Contract only allows self.a and self.b, evil is not allowed
        opts = {
            **self.base,
            "catalog": [self.a, self.b, evil],
            "recommendation": evil,
            "candidate_routes": [evil],
            "adapters": {"openrouter": lambda r, t, c: {"status": "succeeded"}},
        }
        result = dispatch(self.contract, opts)
        self.assertEqual(result["final_status"], "refused")
        self.assertEqual(result["reason"], "ROUTE_NOT_ALLOWLISTED")

    def test_untrusted_fields_injected_in_route_are_discarded(self):
        # A route in preflight recommendation adds untrusted execution settings not present in catalog
        injected_route = dict(self.a)
        injected_route["untrusted_injected_param"] = "malicious_payload"
        contract = {"task": "bounded", "recommended_route": self.a, "allowed_routes": [self.a], "max_attempts": 3}
        executed_routes = []
        announced_routes = []
        def adapter(route, task, context):
            executed_routes.append(route)
            return {"status": "succeeded"}
        opts = {
            **self.base,
            "catalog": [self.a],
            "recommendation": injected_route,
            "candidate_routes": [injected_route],
            "announce": lambda route: announced_routes.append(route),
            "adapters": {"ollama": adapter},
        }
        result = dispatch(contract, opts)
        self.assertEqual(result["final_status"], "succeeded")
        # 1. Executed route discarded untrusted param
        self.assertEqual(len(executed_routes), 1)
        self.assertNotIn("untrusted_injected_param", executed_routes[0])
        self.assertEqual(executed_routes[0], self.a)
        # 2. Receipt recommendation discarded untrusted param
        self.assertNotIn("untrusted_injected_param", result["recommendation"])
        self.assertEqual(result["recommendation"], self.a)
        # 3. Announcement discarded untrusted param
        self.assertEqual(len(announced_routes), 1)
        self.assertNotIn("untrusted_injected_param", announced_routes[0])
        self.assertEqual(announced_routes[0], self.a)



    def test_refusal_receipt_never_exposes_untrusted_recommendation(self):
        # Contract has an untrusted recommended route not in catalog
        untrusted_route = {"provider": "untrusted_prov", "model": "bad"}
        contract = {"task": "test", "recommended_route": untrusted_route, "allowed_routes": []}
        result = dispatch(contract, {**self.base, "verification": {"valid": False}})
        self.assertEqual(result["final_status"], "refused")
        self.assertIsNone(result["recommendation"])

    def test_fallback_deduplication_by_canonical_route_key(self):
        # Contract includes duplicates of self.a with different non-key metadata in allowed_routes
        duplicate_a = dict(self.a)
        duplicate_a["extra_non_key_metadata"] = "custom_value"
        contract = {
            "task": "bounded",
            "recommended_route": self.a,
            "allowed_routes": [duplicate_a, self.b],
            "max_attempts": 3,
        }
        attempted_routes = []
        def fail_adapter(route, task, context):
            attempted_routes.append(route)
            return {"status": "failed"}
        opts = {
            **self.base,
            "adapters": {"ollama": fail_adapter, "openrouter": fail_adapter},
        }
        result = dispatch(contract, opts)
        # Should attempt self.a and self.b only once each, NOT self.a twice
        self.assertEqual(len(attempted_routes), 2)
        self.assertEqual(attempted_routes[0], self.a)
    def test_missing_or_empty_catalog_fails_closed(self):
        result = dispatch(self.contract, {**self.base, "catalog": []})
        self.assertEqual(result["final_status"], "refused")
        self.assertEqual(result["reason"], "CATALOG_EMPTY_OR_UNAVAILABLE")

    def test_route_not_in_catalog_fails_closed(self):
        # Contract allows self.a and self.b, but catalog only has self.a
        result = dispatch(self.contract, {**self.base, "catalog": [self.a]})
        self.assertEqual(result["final_status"], "refused")
        self.assertEqual(result["reason"], "ROUTE_NOT_IN_TRUSTED_CATALOG")

    def test_operator_cannot_select_out_of_contract_route(self):
        bad = {"provider": "subscription-cli", "model": "bad", "execution_mode": "local_cli", "credential_ref": "none", "cost_policy": {}}
        result = dispatch(self.contract, {**self.base, "operator_override": True, "operator_routes": [bad], "adapters": {}})
        self.assertEqual(result["final_status"], "refused")

    def test_attempts_are_bounded_at_three(self):

        routes = [{"provider": str(i), "model": str(i), "execution_mode": "local_cli", "credential_ref": "none", "cost_policy": {}} for i in range(4)]
        contract = {"task": "x", "recommended_route": routes[0], "allowed_routes": routes, "max_attempts": 3}
        result = dispatch(contract, {"verification": {"valid": True}, "operator_identity": "local-user", "catalog": routes, "adapters": {str(i): lambda r, t, c: {"status": "failed"} for i in range(4)}})
        self.assertEqual(len(result["attempts"]), 3)

    def test_worktree_must_be_contained_by_approved_root(self):
        with ManagedTempDir("root_") as root_dir, ManagedTempDir("out_") as outside_dir:
            result = dispatch(self.contract, {
                **self.base,
                "worktree": outside_dir,
                "workspace_root": root_dir,
                "adapters": {},
            })
        self.assertEqual(result["final_status"], "refused")
        self.assertEqual(result["reason"], "WORKTREE_OUTSIDE_APPROVED_ROOT")



    def test_sequential_fallback_stops_on_second_route_success(self):
        def fail_adapter(route, task, ctx):
            return {"status": "failed", "failure_class": "TIMEOUT"}
        def succ_adapter(route, task, ctx):
            return {"status": "succeeded", "output": "ok"}

        result = dispatch(
            self.contract,
            {
                **self.base,
                "verification": {"valid": True, "contract_hash": "sha256:contract123"},
                "adapters": {"ollama": fail_adapter, "openrouter": succ_adapter},
            },
        )
        self.assertEqual(result["final_status"], "succeeded")
        self.assertEqual(len(result["attempts"]), 2)
        self.assertEqual(result["attempts"][0]["attempt_index"], 1)
        self.assertEqual(result["attempts"][0]["contract_hash"], "sha256:contract123")
        self.assertEqual(result["attempts"][0]["result"]["status"], "failed")
        self.assertEqual(result["attempts"][1]["attempt_index"], 2)
        self.assertEqual(result["attempts"][1]["contract_hash"], "sha256:contract123")
        self.assertEqual(result["attempts"][1]["result"]["status"], "succeeded")

    def test_operator_identity_from_environment_when_not_in_options(self):
        import os
        from unittest.mock import patch
        with patch.dict(os.environ, {"TORQ_OPERATOR_ID": "env-operator-99"}):
            opts = {**self.base, "adapters": {"ollama": lambda r, t, c: {"status": "succeeded"}}}
            del opts["operator_identity"]
            result = dispatch(self.contract, opts)
            self.assertEqual(result["operator_identity"], "env-operator-99")

    def test_zero_cost_contract_rejects_billable_override(self):
        zero_contract = dict(self.contract)
        zero_contract["max_cost_usd"] = 0
        paid_route = {
            "provider": "openrouter",
            "model": "paid",
            "cost_policy": {"input_per_1k": 0.005, "output_per_1k": 0.01},
        }
        zero_contract["allowed_routes"] = [self.a, paid_route]
        opts = {
            **self.base,
            "catalog": [self.a, paid_route],
            "operator_override": True,
            "operator_routes": [paid_route],
            "adapters": {},
        }
        result = dispatch(zero_contract, opts)
        self.assertEqual(result["final_status"], "refused")
        self.assertEqual(result["reason"], "PAID_ROUTE_IN_ZERO_COST_CONTRACT")



if __name__ == "__main__":
    unittest.main()
