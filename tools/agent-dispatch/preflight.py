from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

from contract_verifier import verify_contract


def classify_cost(route: dict[str, Any]) -> str:
    cost_policy = route.get("cost_policy", {})
    if "flat" in cost_policy:
        return "zero-cost" if cost_policy["flat"] == 0 else "billable"
    input_cost = cost_policy.get("input_per_1k", 0)
    output_cost = cost_policy.get("output_per_1k", 0)
    if input_cost == 0 and output_cost == 0:
        return "zero-cost"
    return "billable"


def determine_policy_tags(route: dict[str, Any], contract: dict[str, Any]) -> list[str]:
    tags = []
    cost_class = classify_cost(route)
    tags.append(cost_class)
    if contract.get("max_cost_usd", 0) == 0 and cost_class == "billable":
        tags.append("disallowed-in-zero-cost")
    return tags


@dataclass(frozen=True)
class PreflightResult:
    verification: dict[str, Any]
    recommendation: dict[str, Any]
    allowed_fallbacks: list[dict[str, Any]]
    candidate_routes: list[dict[str, Any]]
    expected_cost: float
    reason: str


def _to_governance_payload(contract: dict[str, Any]) -> dict[str, Any]:
    rec = contract.get("recommended_route") or {}
    scope = contract.get("scope", "S1")
    return {
        "task_id": contract.get("task_id", "TASK-001"),
        "scope": scope,
        "success_criteria": contract.get("success_criteria", ["complete_task"]),
        "allowed_tools": contract.get("allowed_tools", ["read_file", "write_file", "run_command"]),
        "max_input_tokens": int(contract.get("max_input_tokens", 8000)),
        "max_output_tokens": int(contract.get("max_output_tokens", 4000)),
        "max_cost_usd": float(contract.get("max_cost_usd", 0.0)),
        "max_model_calls": int(contract.get("max_attempts", 3)),
        "max_tool_calls": 0 if scope == "S0" else 10,
        "max_retries": int(contract.get("max_attempts", 3)),
        "max_escalations": 0,
        "max_wall_clock_seconds": 60,
        "escalation_policy": "none",
        "baseline_id": "EXPLORATORY",
        "provider": rec.get("provider", "ollama"),
        "model_snapshot": rec.get("model", "configured"),
        "rate_card_version": "1.0.0",
        "deadline": contract.get("expires_at", "2026-12-31T23:59:59Z"),
        "side_effect_policy": "read_only",
        "exploratory": True,
    }



def run_preflight(
    contract: dict[str, Any],
    contract_path: Path,
    registry_path: Path,
    verifier_command: list[str],
    torquequery: Optional[Callable[[dict[str, Any]], dict[str, Any]]] = None,
) -> PreflightResult:
    verification = verify_contract(contract_path, registry_path, verifier_command)

    if torquequery is None:
        import sys
        cic_adapter_path = Path(__file__).resolve().parents[2] / "CIC-GOVERNANCE" / "adapters"
        if str(cic_adapter_path) not in sys.path:
            sys.path.insert(0, str(cic_adapter_path))
        try:
            from torquequery_routing_adapter import evaluate_route_json
        except ImportError as exc:
            raise RuntimeError("TORQUEQUERY_ADAPTER_UNAVAILABLE") from exc

        gov_payload = _to_governance_payload(contract)
        tq_result = evaluate_route_json(json.dumps(gov_payload))
        if tq_result.get("status") in {"failed", "error", "blocked"}:
            raise RuntimeError(tq_result.get("termination_reason") or tq_result.get("message") or "TORQUEQUERY_POLICY_DENIED")
        decision = {
            "status": "success",
            "recommended_route": contract.get("recommended_route"),
            "allowed_fallbacks": contract.get("allowed_routes", []),
            "expected_cost": float(contract.get("max_cost_usd", 0.0)),
            "reason": tq_result.get("reason", "policy-approved"),
        }
    else:
        decision = torquequery(contract)

    if decision.get("status") in {"failed", "error", "blocked"}:
        raise RuntimeError(decision.get("termination_reason") or decision.get("message") or "TORQUEQUERY_POLICY_DENIED")

    route = decision.get("recommended_route") or contract.get("recommended_route")
    if not route:
        raise RuntimeError("EMPTY_RECOMMENDATION")



    fallbacks = decision.get("allowed_fallbacks")
    if fallbacks is None:
        fallbacks = [r for r in contract.get("allowed_routes", []) if r != route]

    route_classified = dict(route)
    route_classified["cost_classification"] = classify_cost(route)
    route_classified["policy_tags"] = determine_policy_tags(route, contract)

    fallbacks_classified = []
    for fb in fallbacks:
        fb_c = dict(fb)
        fb_c["cost_classification"] = classify_cost(fb)
        fb_c["policy_tags"] = determine_policy_tags(fb, contract)
        fallbacks_classified.append(fb_c)

    candidate_routes = [route_classified] + [fb for fb in fallbacks_classified if fb != route_classified]

    return PreflightResult(
        verification=verification,
        recommendation=route_classified,
        allowed_fallbacks=fallbacks_classified,
        candidate_routes=candidate_routes,
        expected_cost=float(decision.get("expected_cost", 0.0)),
        reason=decision.get("reason", "policy-approved"),
    )
