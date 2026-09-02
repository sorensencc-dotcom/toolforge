import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from run import execute_dispatch_run


class RunLifecycleTests(unittest.TestCase):
    def test_runner_truncates_trace_at_start_of_each_run_purging_stale_events(self):
        with tempfile.TemporaryDirectory() as directory:
            out_dir = Path(directory)
            route = {"provider": "ollama", "model": "llama3", "execution_mode": "cli"}
            
            # --- RUN 1: Failed Smoke Mock ---
            contract_mock = {
                "task": "mock failed attempt",
                "recommended_route": route,
                "allowed_routes": [route],
                "max_attempts": 2,
                "max_cost_usd": 0,
                "contract_hash": "sha256:smoke-mock"
            }
            options_mock = {
                "verification": {"valid": True, "contract_hash": "sha256:smoke-mock"},
                "operator_identity": "local-operator",
                "catalog": [route],
                "adapters": {
                    "ollama": lambda r, t, ctx: {"status": "failed", "failure_class": "NETWORK_TIMEOUT"}
                }
            }

            res1 = execute_dispatch_run(
                contract=contract_mock,
                options=options_mock,
                output_dir=out_dir,
                trace_filename="trace.json",
                truncate_trace=True
            )
            self.assertEqual(res1["result"]["final_status"], "failed")

            # Verify Run 1 trace contains sha256:smoke-mock
            trace_lines_run1 = [json.loads(line) for line in Path(res1["trace_path"]).read_text(encoding="utf-8").strip().splitlines()]
            self.assertTrue(all(event.get("contract_hash") == "sha256:smoke-mock" for event in trace_lines_run1))
            self.assertTrue(any(event.get("event") == "attempt" for event in trace_lines_run1))

            # --- RUN 2: Successful Live Smoke ---
            contract_live = {
                "task": "live successful attempt",
                "recommended_route": route,
                "allowed_routes": [route],
                "max_attempts": 1,
                "max_cost_usd": 0,
                "contract_hash": "sha256:smoke-live"
            }
            options_live = {
                "verification": {"valid": True, "contract_hash": "sha256:smoke-live"},
                "operator_identity": "local-operator",
                "catalog": [route],
                "adapters": {
                    "ollama": lambda r, t, ctx: {"status": "succeeded", "output": "ok", "cost": 0.0}
                }
            }

            res2 = execute_dispatch_run(
                contract=contract_live,
                options=options_live,
                output_dir=out_dir,
                trace_filename="trace.json",
                truncate_trace=True
            )
            self.assertEqual(res2["result"]["final_status"], "succeeded")

            # Verify Run 2 trace ONLY contains sha256:smoke-live and ZERO sha256:smoke-mock entries
            trace_content = Path(res2["trace_path"]).read_text(encoding="utf-8")
            self.assertNotIn("sha256:smoke-mock", trace_content, "Stale sha256:smoke-mock events must be purged on run start")
            
            trace_lines_run2 = [json.loads(line) for line in trace_content.strip().splitlines()]
            self.assertTrue(len(trace_lines_run2) >= 3)  # dispatch_start, attempt, dispatch_end
            self.assertTrue(all(event.get("contract_hash") == "sha256:smoke-live" for event in trace_lines_run2))
            
            events = [e.get("event") for e in trace_lines_run2]
            self.assertEqual(events[0], "dispatch_start")
            self.assertEqual(events[1], "attempt")
            self.assertEqual(events[2], "dispatch_end")

    def test_runner_supports_namespaced_run_specific_trace_files(self):
        with tempfile.TemporaryDirectory() as directory:
            out_dir = Path(directory)
            route = {"provider": "ollama", "model": "llama3", "execution_mode": "cli"}
            contract = {
                "task": "namespaced run",
                "recommended_route": route,
                "allowed_routes": [route],
                "max_attempts": 1,
                "max_cost_usd": 0
            }
            options = {
                "verification": {"valid": True, "contract_hash": "sha256:run-abc"},
                "operator_identity": "local-operator",
                "catalog": [route],
                "adapters": {
                    "ollama": lambda r, t, ctx: {"status": "succeeded"}
                }
            }

            res = execute_dispatch_run(
                contract=contract,
                options=options,
                output_dir=out_dir,
                trace_filename="trace-run-abc.json"
            )
            self.assertTrue(Path(out_dir / "trace-run-abc.json").is_file())
            trace_lines = [json.loads(l) for l in (out_dir / "trace-run-abc.json").read_text().strip().splitlines()]
            self.assertEqual(trace_lines[0]["contract_hash"], "sha256:run-abc")


if __name__ == "__main__":
    unittest.main()
