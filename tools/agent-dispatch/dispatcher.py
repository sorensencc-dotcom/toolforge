from __future__ import annotations

from typing import Any, Callable


def dispatch(contract: dict[str, Any], options: dict[str, Any]) -> dict[str, Any]:
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
