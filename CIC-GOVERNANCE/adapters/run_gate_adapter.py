"""Phase 1 CIC gate adapter. Wraps GATE-01 unittest mechanics as one JSON line on stdout."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tests"))

from test_gate_runtime import Gate01TransactionTests  # noqa: E402


class JsonCollectingResult(unittest.TestResult):
    def __init__(self) -> None:
        super().__init__()
        self._outcomes: list[dict] = []

    def addSuccess(self, test) -> None:
        super().addSuccess(test)
        self._outcomes.append(
            {"testId": test.id(), "description": test.shortDescription() or "", "outcome": "PASS"}
        )

    def addFailure(self, test, err) -> None:
        super().addFailure(test, err)
        self._outcomes.append(
            {"testId": test.id(), "description": test.shortDescription() or "", "outcome": "FAIL"}
        )

    def addError(self, test, err) -> None:
        super().addError(test, err)
        self._outcomes.append(
            {"testId": test.id(), "description": test.shortDescription() or "", "outcome": "ERROR"}
        )

    def violations_as_json(self) -> list[dict]:
        return [o for o in self._outcomes if o["outcome"] != "PASS"]


def run_unittest_case(case_cls) -> dict:
    result = JsonCollectingResult()
    unittest.TestLoader().loadTestsFromTestCase(case_cls).run(result)
    violations = result.violations_as_json()
    any_error = any(v["outcome"] == "ERROR" for v in violations)
    if any_error:
        status = "ERROR"
        message = "one or more tests errored (harness fault, not a confirmed violation)"
    elif violations:
        status = "FAIL"
        message = "violations present"
    else:
        status = "PASS"
        message = "all tests passed"
    return {"status": status, "violations": violations, "message": message}


GATE_HANDLERS: dict[str, Callable[[], dict]] = {
    "GATE-01": lambda: run_unittest_case(Gate01TransactionTests),
}


def main(gate_id: str) -> None:
    handler = GATE_HANDLERS.get(gate_id)
    if handler is None:
        payload = {"status": "ERROR", "violations": [], "message": "gate not wired"}
    else:
        try:
            payload = handler()
        except Exception as exc:  # adapter-level failure, still one JSON line, exit 0
            payload = {"status": "ERROR", "violations": [], "message": f"adapter exception: {exc}"}
    print(json.dumps(payload))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
