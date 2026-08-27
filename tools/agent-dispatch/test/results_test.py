import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from results import write_result
from trace import append_trace

sys.path.insert(0, str(Path(__file__).parent))
from test_helpers import ManagedTempDir


class ResultsTests(unittest.TestCase):
    def test_result_and_trace_are_structured_and_redacted(self):
        with ManagedTempDir("results_") as directory:
            result = {"final_status": "succeeded", "attempts": [{"route": "ollama"}]}
            receipt = write_result(result, str(directory))
            self.assertEqual(json.loads(Path(receipt["result_path"]).read_text())["final_status"], "succeeded")
            trace = directory / "trace.jsonl"
            append_trace({"event": "attempt", "nested": {"api_key": "SECRET"}, "items": [{"token": "SECRET"}]}, trace)
            line = json.loads(trace.read_text())
            self.assertEqual(line["nested"]["api_key"], "[REDACTED]")
            self.assertEqual(line["items"][0]["token"], "[REDACTED]")



if __name__ == "__main__": unittest.main()
