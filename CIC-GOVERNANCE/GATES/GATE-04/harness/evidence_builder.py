"""Build canonical Gate-04 R2 report from process-driver evidence."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
MATRIX_PATH = Path(__file__).with_name("fault_matrix.json")


def build(driver_result: Path, actor: str, output: Path) -> dict:
    result = json.loads(driver_result.read_text(encoding="utf-8"))
    matrix = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
    definitions = {case["test_id"]: case for case in matrix["cases"]}
    observed = {case["test_id"]: case for case in result["cases"]}
    if set(definitions) != set(observed):
        raise ValueError("driver evidence does not contain exactly TC-04-001 through TC-04-008")
    registry = json.loads((ROOT / "WRAPPERS" / "actor-registry.json").read_text(encoding="utf-8"))
    actor_row = registry.get(actor)
    test_cases = []
    for test_id in definitions:
        definition = definitions[test_id]
        evidence = observed[test_id]
        test_cases.append({
            "test_id": test_id,
            "description": definition["description"],
            "acceptance_criterion": definition["acceptance_criterion"],
            "expected_outcome": definition["expected"],
            "outcome": evidence["outcome"],
            "execution_time_ms": evidence["execution_time_ms"],
            "failure": evidence["failure"],
            "evidence": evidence["details"],
        })
    passed = sum(case["outcome"] == "PASS" for case in test_cases)
    report = {
        "report_id": "CIC-TEST-REPORT-GATE-04-R2",
        "supersedes": "CIC-TEST-REPORT-GATE-04",
        "gate_id": "GATE-04",
        "gate_name": "Cross-Process Lineage Locking",
        "spec_version": "2.4.0",
        "gate_closure_spec_version": "1.0.1-candidate.1",
        "gate_closure_spec_ref": "CIC-GATE-SPEC-001 section 6",
        "executed_by": actor,
        "actor_registry_state": actor_row["state"] if actor_row else "UNREGISTERED",
        "execution_timestamp": result["executed_at"],
        "test_environment": result["environment"],
        "test_cases": test_cases,
        "additional_test_cases": [],
        "total_cases": len(test_cases),
        "passed": passed,
        "failed": len(test_cases) - passed,
        "skipped": 0,
        "overall_result": "PASS" if passed == len(test_cases) else "FAIL",
        "anomalies": None,
        "submitted_for_ratification": None,
        "_amendment_target": "AMD-v2.4.0-GATE-04-CLOSED",
        "_minimum_passing_threshold": "8/8 process-level cases",
        "_submission_ready": bool(actor_row and actor_row["state"] == "ACTIVE" and passed == len(test_cases) and result["environment"]["filesystem"] == "NTFS"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, output)
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--driver-result", type=Path, required=True)
    parser.add_argument("--actor", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = build(args.driver_result, args.actor, args.output)
    print(json.dumps({"report_id": report["report_id"], "result": report["overall_result"], "submission_ready": report["_submission_ready"]}))
    return 0 if report["_submission_ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
