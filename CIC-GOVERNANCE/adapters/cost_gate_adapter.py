"""Standalone CLI & API adapter for CIC Cost Governance Spec evaluation."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure WRAPPERS directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "WRAPPERS"))

from cost_governance_runtime import (
    PINNED_SPEC_VERSION,
    GovernanceViolation,
    TaskContract,
)


def evaluate_contract_json(payload_json: str) -> dict:
    """Evaluates a JSON contract string and returns a result dict."""
    try:
        data = json.loads(payload_json)
        contract = TaskContract.from_dict(data)
        return {
            "status": "PASS",
            "task_id": contract.task_id,
            "scope": contract.scope,
            "spec_version": PINNED_SPEC_VERSION,
            "message": "Task contract passed governance cost gate",
        }
    except GovernanceViolation as gv:
        return {
            "status": "FAIL",
            "code": gv.code,
            "message": gv.message,
        }
    except Exception as exc:
        return {
            "status": "ERROR",
            "message": f"Adapter exception: {exc}",
        }


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        print(json.dumps({"status": "ERROR", "message": "Missing JSON contract argument"}))
        sys.exit(1)
    result = evaluate_contract_json(argv[1])
    print(json.dumps(result))
    if result.get("status") not in ("PASS", "FAIL"):
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv)
