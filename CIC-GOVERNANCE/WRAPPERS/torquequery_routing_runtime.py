"""TorqueQuery routing policy runtime for the candidate CIC cost-governance spec."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from cost_governance_runtime import (
    AtomicBudgetGate,
    GovernanceViolation,
    PINNED_SPEC_VERSION,
    RateCard,
    ScopeLimitsRegistry,
)


ALLOWED_ESCALATION_POLICIES = {"none", "stronger_model", "human"}
ALLOWED_SIDE_EFFECT_POLICIES = {"read_only", "reversible", "approval_required"}
SIDE_EFFECT_ORDER = {
    "none": 0,
    "read_only": 0,
    "reversible": 1,
    "approval_required": 2,
    "checkpointed": 3,
}


def request_hash(payload: Dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _parse_deadline(value: str) -> str:
    normalized = value.replace("Z", "+00:00")
    try:
        datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise GovernanceViolation(400, "CONTRACT_INVALID", "deadline must be RFC-3339") from exc
    return value


@dataclass(frozen=True)
class TorqueQueryRouteContract:
    task_id: str
    scope: str
    success_criteria: List[str]
    allowed_tools: List[str]
    max_input_tokens: int
    max_output_tokens: int
    max_cost_usd: float
    max_model_calls: int
    max_tool_calls: int
    max_retries: int
    max_escalations: int
    max_wall_clock_seconds: int
    escalation_policy: str
    baseline_id: str
    provider: str
    model_snapshot: str
    rate_card_version: str
    deadline: str
    side_effect_policy: str
    exploratory: bool = False

    @classmethod
    def from_dict(
        cls,
        data: Dict[str, Any],
        registry: Optional[ScopeLimitsRegistry] = None,
    ) -> "TorqueQueryRouteContract":
        required = [
            "task_id",
            "scope",
            "success_criteria",
            "allowed_tools",
            "max_input_tokens",
            "max_output_tokens",
            "max_cost_usd",
            "max_model_calls",
            "max_tool_calls",
            "max_retries",
            "max_escalations",
            "max_wall_clock_seconds",
            "escalation_policy",
            "provider",
            "model_snapshot",
            "rate_card_version",
            "deadline",
            "side_effect_policy",
        ]
        missing = [field for field in required if field not in data]
        exploratory = bool(data.get("exploratory", False))
        if "baseline_id" not in data and not exploratory:
            missing.append("baseline_id")
        if missing:
            raise GovernanceViolation(400, "CONTRACT_INVALID", f"Missing fields: {', '.join(missing)}")

        reg = registry or ScopeLimitsRegistry(PINNED_SPEC_VERSION)
        scope = str(data["scope"])
        ceiling = reg.get_ceiling(scope)

        max_model_calls = int(data["max_model_calls"])
        max_tool_calls = int(data["max_tool_calls"])
        max_input_tokens = int(data["max_input_tokens"])
        if ceiling["max_model_calls"] is not None and max_model_calls > ceiling["max_model_calls"]:
            raise GovernanceViolation(400, "SCOPE_CEILING_EXCEEDED", "max_model_calls exceeds scope ceiling")
        if ceiling["max_tool_calls"] is not None and max_tool_calls > ceiling["max_tool_calls"]:
            raise GovernanceViolation(400, "SCOPE_CEILING_EXCEEDED", "max_tool_calls exceeds scope ceiling")
        if ceiling["max_input_tokens"] is not None and max_input_tokens > ceiling["max_input_tokens"]:
            raise GovernanceViolation(400, "SCOPE_CEILING_EXCEEDED", "max_input_tokens exceeds scope ceiling")

        side_effect_policy = str(data["side_effect_policy"])
        if side_effect_policy not in ALLOWED_SIDE_EFFECT_POLICIES:
            raise GovernanceViolation(400, "CONTRACT_INVALID", "side_effect_policy is invalid")
        ceiling_side_effect = str(ceiling["side_effects"])
        if SIDE_EFFECT_ORDER[side_effect_policy] > SIDE_EFFECT_ORDER[ceiling_side_effect]:
            raise GovernanceViolation(400, "SCOPE_CEILING_EXCEEDED", "side_effect_policy exceeds scope ceiling")

        escalation_policy = str(data["escalation_policy"])
        if escalation_policy not in ALLOWED_ESCALATION_POLICIES:
            raise GovernanceViolation(400, "CONTRACT_INVALID", "escalation_policy is invalid")

        return cls(
            task_id=str(data["task_id"]),
            scope=scope,
            success_criteria=list(data["success_criteria"]),
            allowed_tools=list(data["allowed_tools"]),
            max_input_tokens=max_input_tokens,
            max_output_tokens=int(data["max_output_tokens"]),
            max_cost_usd=float(data["max_cost_usd"]),
            max_model_calls=max_model_calls,
            max_tool_calls=max_tool_calls,
            max_retries=int(data["max_retries"]),
            max_escalations=int(data["max_escalations"]),
            max_wall_clock_seconds=int(data["max_wall_clock_seconds"]),
            escalation_policy=escalation_policy,
            baseline_id=str(data.get("baseline_id", "EXPLORATORY")),
            provider=str(data["provider"]),
            model_snapshot=str(data["model_snapshot"]),
            rate_card_version=str(data["rate_card_version"]),
            deadline=_parse_deadline(str(data["deadline"])),
            side_effect_policy=side_effect_policy,
            exploratory=exploratory,
        )


@dataclass(frozen=True)
class RetryDecision:
    action: str
    limit: int
    retry_allowed: bool


class TorqueQueryCircuitBreaker:
    def evaluate(
        self,
        budget_exhausted: bool = False,
        limit_exceeded: bool = False,
        safety_violation: bool = False,
        authorization_failure: bool = False,
        needs_approval: bool = False,
        unauthorized_side_effect: bool = False,
        repeated_failure: bool = False,
        subtask_failure: bool = False,
        no_progress_count: int = 0,
    ) -> Optional[str]:
        if budget_exhausted:
            return "budget_exhausted"
        if limit_exceeded:
            return "limit_exceeded"
        if safety_violation or authorization_failure:
            return "safety_violation"
        if needs_approval:
            return "needs_approval"
        if unauthorized_side_effect:
            return "unauthorized_side_effect"
        if repeated_failure:
            return "repeated_failure"
        if subtask_failure:
            return "subtask_failure"
        if no_progress_count >= 2:
            return "no_progress"
        return None

    def terminal_status(self, termination_reason: Optional[str]) -> str:
        if termination_reason == "budget_exhausted":
            return "budget_exhausted"
        if termination_reason == "needs_approval":
            return "needs_approval"
        if termination_reason is None:
            return "success"
        return "failed"


class TorqueQueryRoutingEngine:
    RETRY_MATRIX = {
        "rate_limit": RetryDecision("backoff_retry", 2, True),
        "timeout": RetryDecision("backoff_retry", 2, True),
        "5xx": RetryDecision("backoff_retry", 2, True),
        "schema_failure": RetryDecision("constrained_repair", 1, True),
        "tool_argument_failure": RetryDecision("deterministic_correction", 1, True),
        "substantive_answer_failure": RetryDecision("critique_revise", 1, True),
        "external_write_failure": RetryDecision("idempotent_retry", 1, True),
        "repeated_identical_failure": RetryDecision("terminal_stop", 0, False),
        "permission": RetryDecision("terminal_stop", 0, False),
        "safety": RetryDecision("terminal_stop", 0, False),
        "authorization": RetryDecision("terminal_stop", 0, False),
    }

    def __init__(self):
        self.circuit_breaker = TorqueQueryCircuitBreaker()
        self.no_progress_count = 0
        self.previous_retrieval_ids: Optional[List[str]] = None

    def choose_model(self, candidates: List[Dict[str, Any]], required_capabilities: Optional[List[str]] = None) -> Dict[str, Any]:
        capabilities = set(required_capabilities or [])
        capable = [
            candidate
            for candidate in candidates
            if capabilities.issubset(set(candidate.get("capabilities", [])))
        ]
        if not capable:
            raise GovernanceViolation(400, "NO_CAPABLE_MODEL", "No candidate model satisfies required capabilities")
        return sorted(capable, key=lambda item: (float(item.get("estimated_cost_usd", 0)), str(item.get("model", ""))))[0]

    def retry_decision(self, failure_class: str, attempts_used: int) -> RetryDecision:
        decision = self.RETRY_MATRIX.get(failure_class, RetryDecision("terminal_stop", 0, False))
        return RetryDecision(decision.action, decision.limit, decision.retry_allowed and attempts_used < decision.limit)

    def reserve_budget(
        self,
        contract: TorqueQueryRouteContract,
        gate: AtomicBudgetGate,
        attempt_id: str,
        rate_card: RateCard,
        expected_tool_cost: float = 0.0,
    ) -> str:
        return gate.reserve(
            task_id=contract.task_id,
            attempt_id=attempt_id,
            rate_card=rate_card,
            estimated_input=contract.max_input_tokens,
            estimated_output=contract.max_output_tokens,
            expected_tool_cost=expected_tool_cost,
        )

    def validate_reformulation(self, original_query: str, reformulated_query: str) -> bool:
        if len(reformulated_query) > len(original_query) * 2:
            raise GovernanceViolation(400, "REFORMULATION_LIMIT_EXCEEDED", "reformulation exceeds 2x original query length")
        if len(reformulated_query) - len(original_query) > 256:
            raise GovernanceViolation(400, "REFORMULATION_LIMIT_EXCEEDED", "reformulation adds more than 256 characters")
        return True

    def retrieval_repeated(self, previous_ids: List[str], current_ids: List[str]) -> bool:
        if previous_ids == current_ids:
            return True
        previous_set = set(previous_ids)
        current_set = set(current_ids)
        if not previous_set and not current_set:
            return True
        union = previous_set | current_set
        if not union:
            return False
        return len(previous_set & current_set) / len(union) >= 0.90

    def record_retrieval(self, retrieval_ids: List[str]) -> int:
        if self.previous_retrieval_ids is not None and self.retrieval_repeated(self.previous_retrieval_ids, retrieval_ids):
            self.no_progress_count += 1
        else:
            self.no_progress_count = 0
        self.previous_retrieval_ids = list(retrieval_ids)
        return self.no_progress_count

    def terminal_response(
        self,
        contract: TorqueQueryRouteContract,
        termination_reason: Optional[str],
        failure_class: Optional[str] = None,
        actual_cost_usd: float = 0.0,
        retry_count: int = 0,
        escalated: bool = False,
    ) -> Dict[str, Any]:
        status = self.circuit_breaker.terminal_status(termination_reason)
        return {
            "status": status,
            "task_id": contract.task_id,
            "termination_reason": termination_reason or "success",
            "failure_class": failure_class,
            "actual_cost_usd": round(float(actual_cost_usd), 6),
            "retry_count": int(retry_count),
            "escalated": bool(escalated),
        }


class TorqueQueryTraceLogger:
    SCHEMA_VERSION = "1.0.0"

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, **kwargs: Any) -> Dict[str, Any]:
        required = [
            "task_id",
            "scope_declared",
            "scope_used",
            "request_hash",
            "baseline_id",
            "provider",
            "model_snapshot",
            "rate_card_version",
            "input_tokens",
            "cached_input_tokens",
            "output_tokens",
            "reasoning_tokens",
            "tool_calls",
            "retry_count",
            "actual_cost_usd",
            "baseline_cost_usd",
            "net_savings_usd",
            "quality_score",
            "success",
            "failure_class",
            "escalation",
            "escalation_count",
            "termination_reason",
            "elapsed_ms",
            "retrieval_ids",
            "ranking_mode",
            "retrieval_timestamp",
            "currency",
        ]
        missing = [field for field in required if field not in kwargs]
        if missing:
            raise GovernanceViolation(400, "TRACE_INVALID", f"Missing fields: {', '.join(missing)}")
        if kwargs.get("side_effect_operation_id") and not kwargs.get("idempotency_key"):
            raise GovernanceViolation(400, "TRACE_INVALID", "side-effect traces require idempotency_key")

        record = {
            "event_id": kwargs.get("event_id") or f"EVT-{uuid.uuid4()}",
            "schema_version": self.SCHEMA_VERSION,
            **kwargs,
        }
        encoded = json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        return record
