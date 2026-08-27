from __future__ import annotations

import getpass
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional


def _route_key(route: dict[str, Any]) -> tuple[Any, ...]:
    cost_policy = route.get("cost_policy") or {}
    cost_tuple = tuple(sorted((str(k), float(v)) for k, v in cost_policy.items()))
    return (
        str(route.get("provider", "")),
        str(route.get("model", "")),
        str(route.get("execution_mode", "")),
        str(route.get("credential_ref", "")),
        cost_tuple,
    )




def _resolve_operator_identity(options: dict[str, Any]) -> str:
    if options.get("operator_identity"):
        return str(options["operator_identity"])
    env_op = os.environ.get("TORQ_OPERATOR_ID")
    if env_op:
        return env_op
    try:
        user = getpass.getuser()
        if user:
            return user
    except Exception:
        pass
    return os.environ.get("USERNAME") or os.environ.get("USER") or ""


def _validate(contract: dict[str, Any], options: dict[str, Any], operator_identity: str) -> Optional[str]:
    if options.get("verification", {}).get("valid") is not True:
        return "CONTRACT_NOT_VERIFIED"
    if not operator_identity:
        return "OPERATOR_IDENTITY_REQUIRED"
    catalog = options.get("catalog")
    if not catalog:
        return "CATALOG_EMPTY_OR_UNAVAILABLE"
    catalog_keys = {_route_key(route) for route in catalog}
    routes = [contract["recommended_route"], *contract.get("allowed_routes", [])]
    if any(_route_key(route) not in catalog_keys for route in routes):
        return "ROUTE_NOT_IN_TRUSTED_CATALOG"
    if options.get("operator_override") and options.get("operator_routes"):
        if any(_route_key(route) not in catalog_keys for route in options["operator_routes"]):
            return "ROUTE_NOT_IN_TRUSTED_CATALOG"
    if contract.get("max_cost_usd") == 0:
        routes_to_check = [contract["recommended_route"], *contract.get("allowed_routes", [])]
        if options.get("operator_override") and options.get("operator_routes"):
            routes_to_check.extend(options["operator_routes"])
        if any(any(value > 0 for value in route.get("cost_policy", {}).values()) for route in routes_to_check):
            return "PAID_ROUTE_IN_ZERO_COST_CONTRACT"
    worktree = options.get("worktree")
    root = options.get("workspace_root")
    if worktree is not None or root is not None:
        if not worktree or not root:
            return "WORKTREE_OUTSIDE_APPROVED_ROOT"
        resolved_wt = Path(os.path.realpath(str(worktree)))
        resolved_root = Path(os.path.realpath(str(root)))
        try:
            if not resolved_wt.is_relative_to(resolved_root):
                return "WORKTREE_OUTSIDE_APPROVED_ROOT"
        except AttributeError:
            # Fallback for Python < 3.9 compatibility
            try:
                resolved_wt.relative_to(resolved_root)
            except ValueError:
                return "WORKTREE_OUTSIDE_APPROVED_ROOT"
    return None


def _refusal_receipt(
    receipt: dict[str, Any],
    reason: str,
    recommendation: Optional[dict[str, Any]] = None,
    override: bool = False,
) -> dict[str, Any]:
    return {
        **receipt,
        "final_status": "refused",
        "attempts": [],
        "recommendation": recommendation,
        "override": override,
        "reason": reason,
        "termination_reason": reason,
        "total_cost": 0.0,
    }


def dispatch(contract: dict[str, Any], options: dict[str, Any]) -> dict[str, Any]:
    operator_identity = _resolve_operator_identity(options)
    contract_hash = options.get("verification", {}).get("contract_hash")
    receipt = {
        "contract_hash": contract_hash,
        "operator_identity": operator_identity,
        "artifact_paths": options.get("artifact_paths", []),
    }

    catalog = options.get("catalog", [])
    catalog_map = {_route_key(r): r for r in catalog}

    # Normalize contract recommended route if trusted, else None
    safe_contract_rec = None
    contract_rec = contract.get("recommended_route")
    if contract_rec and _route_key(contract_rec) in catalog_map:
        safe_contract_rec = dict(catalog_map[_route_key(contract_rec)])

    invalid = _validate(contract, options, operator_identity)
    if invalid:
        return _refusal_receipt(receipt, reason=invalid, recommendation=safe_contract_rec)

    # 1. Base signed contract allowlist (keyed by canonical route key)
    contract_allowed = [contract["recommended_route"]] + [r for r in contract.get("allowed_routes", []) if r != contract["recommended_route"]]
    contract_allowed_keys = {_route_key(r) for r in contract_allowed}

    # 2. Determine and normalize recommendation through trusted catalog
    proposed_recommendation = options.get("recommendation") or contract.get("recommended_route")
    proposed_key = _route_key(proposed_recommendation)
    if proposed_key not in contract_allowed_keys:
        return _refusal_receipt(receipt, "ROUTE_NOT_ALLOWLISTED", safe_contract_rec, bool(options.get("operator_override")))
    if proposed_key not in catalog_map:
        return _refusal_receipt(receipt, "ROUTE_NOT_IN_TRUSTED_CATALOG", safe_contract_rec, bool(options.get("operator_override")))

    # Discard untrusted object; use trusted catalog definition directly
    recommendation = dict(catalog_map[proposed_key])

    # 3. Determine candidate routes
    if options.get("operator_override"):
        if not contract.get("operator_override"):
            return _refusal_receipt(receipt, "ROUTE_NOT_ALLOWLISTED", recommendation, override=True)
        raw_candidates = options.get("operator_routes") or [recommendation]
    else:
        raw_candidates = options.get("candidate_routes")
        if raw_candidates is None:
            allowed_fallbacks = options.get("allowed_fallbacks")
            if allowed_fallbacks is None:
                allowed_fallbacks = [r for r in contract_allowed if _route_key(r) != proposed_key]
            raw_candidates = [recommendation] + [r for r in allowed_fallbacks if _route_key(r) != proposed_key]

    # 4. Strictly validate every candidate against contract allowlist and catalog, and normalize
    seen_keys = set()
    candidates = []
    for route in raw_candidates:
        r_key = _route_key(route)
        if r_key not in contract_allowed_keys:
            return _refusal_receipt(receipt, "ROUTE_NOT_ALLOWLISTED", recommendation, bool(options.get("operator_override")))
        if r_key not in catalog_map:
            return _refusal_receipt(receipt, "ROUTE_NOT_IN_TRUSTED_CATALOG", recommendation, bool(options.get("operator_override")))
        if r_key in seen_keys:
            continue
        seen_keys.add(r_key)
        # Discard untrusted proposed route object; use trusted catalog definition directly
        normalized_route = dict(catalog_map[r_key])
        candidates.append(normalized_route)

    if not candidates:
        return _refusal_receipt(receipt, "ROUTE_NOT_ALLOWLISTED", recommendation, bool(options.get("operator_override")))

    max_attempts = min(3, int(contract.get("max_attempts", 3)))
    candidates = candidates[:max_attempts]

    if options.get("announce") and callable(options["announce"]):
        options["announce"](recommendation)


    attempts: list[dict[str, Any]] = []
    total_cost = 0.0

    for i, route in enumerate(candidates):
        attempt_index = i + 1
        ts_start = datetime.now(timezone.utc).isoformat()
        adapter = options.get("adapters", {}).get(route.get("provider"))
        if adapter is None:
            result = {"status": "failed", "failure_class": "CONFIGURATION", "cost": 0.0}
        else:
            try:
                res = adapter(route, contract["task"], options.get("execution_context", {}))
                result = res.__dict__ if hasattr(res, "__dict__") else res
            except Exception as exc:
                result = {"status": "failed", "failure_class": "PROVIDER_EXCEPTION", "message": str(exc), "cost": 0.0}

        ts_end = datetime.now(timezone.utc).isoformat()
        cost = float(result.get("cost", 0.0))
        total_cost += cost

        attempt_record = {
            "attempt_index": attempt_index,
            "route": route,
            "contract_hash": contract_hash,
            "operator_identity": operator_identity,
            "status": result.get("status"),
            "failure_class": result.get("failure_class"),
            "timestamp_start": ts_start,
            "timestamp_end": ts_end,
            "result": result,
        }
        attempts.append(attempt_record)

        if result.get("status") == "succeeded":
            return {
                **receipt,
                "final_status": "succeeded",
                "attempts": attempts,
                "recommendation": recommendation,
                "override": bool(options.get("operator_override")),
                "final_provider": route.get("provider"),
                "final_model": route.get("model"),
                "total_cost": total_cost,
                "termination_reason": "completed",
            }

    reason = "ATTEMPTS_EXHAUSTED"
    return {
        **receipt,
        "final_status": "failed",
        "attempts": attempts,
        "recommendation": recommendation,
        "override": bool(options.get("operator_override")),
        "total_cost": total_cost,
        "reason": reason,
        "termination_reason": reason,
    }
