"""CLI/API adapter for TorqueQuery AI agent routing policy evaluation."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "WRAPPERS"))

from cost_governance_runtime import AtomicBudgetGate, GovernanceViolation, RateCardManager
from torquequery_routing_runtime import (
    TorqueQueryRouteContract,
    TorqueQueryRoutingEngine,
)


def evaluate_route_json(payload_json: str) -> dict:
    try:
        payload = json.loads(payload_json)
        contract = TorqueQueryRouteContract.from_dict(payload)
        engine = TorqueQueryRoutingEngine()

        rate_cards = RateCardManager()
        rate_card = rate_cards.get(contract.rate_card_version)
        gate = AtomicBudgetGate(contract.max_cost_usd)
        attempt_id = str(payload.get("attempt_id", "ATT-001"))
        try:
            reservation_id = engine.reserve_budget(contract, gate, attempt_id, rate_card, float(payload.get("expected_tool_cost", 0.0)))
        except GovernanceViolation as gv:
            if gv.code == "BUDGET_EXHAUSTED":
                return engine.terminal_response(contract, "budget_exhausted", "budget", 0.0, 0, False)
            raise
        gate.release_reservation(contract.task_id, reservation_id)

        reason = engine.circuit_breaker.evaluate(
            budget_exhausted=bool(payload.get("budget_exhausted", False)),
            limit_exceeded=bool(payload.get("limit_exceeded", False)),
            safety_violation=bool(payload.get("safety_violation", False)),
            authorization_failure=bool(payload.get("authorization_failure", False)),
            needs_approval=bool(payload.get("needs_approval", False)),
            unauthorized_side_effect=bool(payload.get("unauthorized_side_effect", False)),
            repeated_failure=bool(payload.get("repeated_failure", False)),
            subtask_failure=bool(payload.get("subtask_failure", False)),
            no_progress_count=int(payload.get("no_progress_count", 0)),
        )
        return engine.terminal_response(
            contract,
            reason,
            payload.get("failure_class"),
            float(payload.get("actual_cost_usd", 0.0)),
            int(payload.get("retry_count", 0)),
            bool(payload.get("escalated", False)),
        )
    except GovernanceViolation as gv:
        return {"status": "failed", "code": gv.code, "message": gv.message}
    except Exception as exc:
        return {"status": "error", "message": f"Adapter exception: {exc}"}


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        print(json.dumps({"status": "error", "message": "Missing JSON contract argument"}))
        sys.exit(1)
    result = evaluate_route_json(argv[1])
    print(json.dumps(result, sort_keys=True))
    if result.get("status") == "error":
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv)
