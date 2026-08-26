from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from contract_verifier import verify_contract


@dataclass(frozen=True)
class PreflightResult:
    verification: dict
    recommendation: dict
    allowed_fallbacks: list[dict]
    expected_cost: float
    reason: str


def run_preflight(contract: dict, contract_path: Path, registry_path: Path, verifier_command: list[str], torquequery) -> PreflightResult:
    verification = verify_contract(contract_path, registry_path, verifier_command)
    decision = torquequery(contract)
    if decision.get("status") in {"failed", "error", "blocked"}:
        raise RuntimeError(decision.get("termination_reason") or decision.get("message") or "TORQUEQUERY_POLICY_DENIED")
    route = decision.get("recommended_route") or contract["recommended_route"]
    fallbacks = decision.get("allowed_fallbacks") or contract.get("allowed_routes", [])
    return PreflightResult(verification, route, list(fallbacks), float(decision.get("expected_cost", 0)), decision.get("reason", "policy-approved"))

