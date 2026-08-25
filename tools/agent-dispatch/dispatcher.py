from __future__ import annotations

from typing import Any, Callable
from pathlib import Path
def _route_key(route):
    return (route.get("provider", ""), route.get("model", ""), route.get("execution_mode", ""))


def _validate(contract, options):
    if options.get("verification", {}).get("valid") is not True:
        return "CONTRACT_NOT_VERIFIED"
    if not options.get("operator_identity"):
        return "OPERATOR_IDENTITY_REQUIRED"
    catalog_keys = {_route_key(route) for route in options.get("catalog", [])}
    routes = [contract["recommended_route"], *contract.get("allowed_routes", [])]
    if any(_route_key(route) not in catalog_keys for route in routes):
        return "ROUTE_NOT_IN_TRUSTED_CATALOG"
    if contract.get("max_cost_usd") == 0 and any(any(value > 0 for value in route.get("cost_policy", {}).values()) for route in routes):
        return "PAID_ROUTE_IN_ZERO_COST_CONTRACT"
    worktree = options.get("worktree")
    root = options.get("workspace_root")
    if worktree is not None or root is not None:
        if not worktree or not root or not Path(worktree).resolve().is_relative_to(Path(root).resolve()):
            return "WORKTREE_OUTSIDE_APPROVED_ROOT"
    return None


def dispatch(contract: dict[str, Any], options: dict[str, Any]) -> dict[str, Any]:
    invalid = _validate(contract, options)
    if invalid:
        return {"final_status": "refused", "attempts": [], "recommendation": contract.get("recommended_route"), "override": False, "reason": invalid}
    recommendation = contract["recommended_route"]
    allowed = contract.get("allowed_routes", []) or [recommendation]
    candidates = options.get("operator_routes") if options.get("operator_override") else None
    if candidates is None:
        candidates = [recommendation] + [r for r in allowed if r != recommendation]
    if any(route not in allowed for route in candidates) or (options.get("operator_override") and not contract.get("operator_override")):
        return {"final_status": "refused", "attempts": [], "recommendation": recommendation, "override": bool(options.get("operator_override")), "reason": "ROUTE_NOT_ALLOWLISTED"}
    candidates = candidates[: min(3, contract.get("max_attempts", 1))]
    if options.get("announce"):
        options["announce"](recommendation)
    attempts = []
    for route in candidates:
        adapter = options["adapters"].get(route["provider"])
        if adapter is None:
            result = {"status": "failed", "failure_class": "CONFIGURATION"}
        else:
            result = adapter(route, contract["task"], options.get("execution_context", {}))
            result = result.__dict__ if hasattr(result, "__dict__") else result
        attempts.append({"route": route, "result": result})
        if result.get("status") == "succeeded":
            return {"final_status": "succeeded", "attempts": attempts, "recommendation": recommendation, "override": bool(options.get("operator_override")), "final_provider": route["provider"], "final_model": route["model"]}
    return {"final_status": "failed", "attempts": attempts, "recommendation": recommendation, "override": bool(options.get("operator_override")), "reason": "ATTEMPTS_EXHAUSTED"}
