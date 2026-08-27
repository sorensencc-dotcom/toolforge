import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from results import write_result
from trace import append_trace, init_trace, reset_trace, write_trace


class ResultsTests(unittest.TestCase):
    def test_result_and_trace_are_structured_and_redacted(self):
        with tempfile.TemporaryDirectory() as directory:
            result = {"final_status": "succeeded", "attempts": [{"route": "ollama"}]}
            receipt = write_result(result, directory)
            self.assertEqual(json.loads(Path(receipt["result_path"]).read_text())["final_status"], "succeeded")
            trace = Path(directory) / "trace.jsonl"
            append_trace({"event": "attempt", "nested": {"api_key": "SECRET"}, "items": [{"token": "SECRET"}]}, trace)
            line = json.loads(trace.read_text())
            self.assertEqual(line["nested"]["api_key"], "[REDACTED]")
            self.assertEqual(line["items"][0]["token"], "[REDACTED]")

    def test_trace_truncation_and_single_run_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            trace = Path(directory) / "trace.jsonl"
            
            # Simulate Run 1 (failed mock attempts)
            append_trace({"run": "smoke-mock", "status": "failed"}, trace)
            append_trace({"run": "smoke-mock", "status": "failed"}, trace)
            self.assertEqual(len(trace.read_text().strip().splitlines()), 2)

            # Initialize / reset trace before Run 2 (successful live run)
            init_trace(trace)
            append_trace({"run": "smoke-live", "status": "succeeded"}, trace)
            lines = trace.read_text().strip().splitlines()
            self.assertEqual(len(lines), 1)
            self.assertEqual(json.loads(lines[0])["run"], "smoke-live")

    def test_write_trace_atomically_overwrites_stale_records(self):
        with tempfile.TemporaryDirectory() as directory:
            trace = Path(directory) / "trace.json"
            trace.write_text('{"stale": "mock-failure"}\n', encoding="utf-8")

            events = [
                {"event": "start", "contract_hash": "sha256:smoke-live"},
                {"event": "finish", "status": "succeeded"}
            ]
            write_trace(events, trace)
            lines = [json.loads(line) for line in trace.read_text().strip().splitlines()]
            self.assertEqual(len(lines), 2)
            self.assertEqual(lines[0]["contract_hash"], "sha256:smoke-live")
            self.assertEqual(lines[1]["status"], "succeeded")


if __name__ == "__main__":
    unittest.main()
