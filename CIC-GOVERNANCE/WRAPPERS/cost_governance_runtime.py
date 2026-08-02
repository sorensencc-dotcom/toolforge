"""Agent Cost Governance Runtime implementation for CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1."""

from __future__ import annotations
import re
import threading
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

PINNED_SPEC_VERSION = "CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1"


class GovernanceViolation(ValueError):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.status_code = status_code
        self.code = code
        self.message = message


class ScopeLimitsRegistry:
    DEFAULTS = {
        "S0": {"max_model_calls": 1, "max_tool_calls": 0, "max_input_tokens": 2000, "side_effects": "none"},
        "S1": {"max_model_calls": 3, "max_tool_calls": None, "max_input_tokens": 20000, "side_effects": "none"},
        "S2": {"max_model_calls": 8, "max_tool_calls": None, "max_input_tokens": 100000, "side_effects": "reversible"},
        "S3": {"max_model_calls": 12, "max_tool_calls": None, "max_input_tokens": 250000, "side_effects": "approval_required"},
        "S4": {"max_model_calls": None, "max_tool_calls": None, "max_input_tokens": None, "side_effects": "checkpointed"},
    }

    def __init__(self, spec_version: str = PINNED_SPEC_VERSION):
        if spec_version != PINNED_SPEC_VERSION:
            raise GovernanceViolation(
                400,
                "SCOPE_VERSION_MISMATCH",
                f"Expected {PINNED_SPEC_VERSION}, got {spec_version}",
            )
        self.spec_version = spec_version

    def get_ceiling(self, scope: str) -> Dict[str, Any]:
        if scope not in self.DEFAULTS:
            raise GovernanceViolation(400, "INVALID_SCOPE", f"Unknown scope {scope}")
        return self.DEFAULTS[scope]


@dataclass
class TaskContract:
    task_id: str
    scope: str
    success_criteria: List[str]
    allowed_tools: List[str]
    side_effect_policy: str
    max_model_calls: int
    max_tool_calls: int
    max_input_tokens: int
    max_output_tokens: int
    max_cost_usd: float
    max_wall_clock_seconds: int
    max_retries: int
    max_escalations: int
    escalation_policy: str
    baseline_id: str
    provider: str
    model_snapshot: str
    rate_card_version: str

    @classmethod
    def from_dict(
        cls, data: Dict[str, Any], registry: Optional[ScopeLimitsRegistry] = None
    ) -> TaskContract:
        reg = registry or ScopeLimitsRegistry()
        required_fields = [
            "task_id",
            "scope",
            "success_criteria",
            "allowed_tools",
            "side_effect_policy",
            "max_model_calls",
            "max_tool_calls",
            "max_input_tokens",
            "max_output_tokens",
            "max_cost_usd",
            "max_wall_clock_seconds",
            "max_retries",
            "max_escalations",
            "escalation_policy",
            "baseline_id",
            "provider",
            "model_snapshot",
            "rate_card_version",
        ]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise GovernanceViolation(
                400, "CONTRACT_INVALID", f"Missing fields: {', '.join(missing)}"
            )

        scope = str(data["scope"])
        ceiling = reg.get_ceiling(scope)

        max_calls = int(data["max_model_calls"])
        if (
            ceiling["max_model_calls"] is not None
            and max_calls > ceiling["max_model_calls"]
        ):
            raise GovernanceViolation(
                400,
                "SCOPE_CEILING_EXCEEDED",
                f"Declared calls {max_calls} exceeds {scope} ceiling {ceiling['max_model_calls']}",
            )

        max_input = int(data["max_input_tokens"])
        if (
            ceiling["max_input_tokens"] is not None
            and max_input > ceiling["max_input_tokens"]
        ):
            raise GovernanceViolation(
                400,
                "SCOPE_CEILING_EXCEEDED",
                f"Declared input tokens {max_input} exceeds {scope} ceiling {ceiling['max_input_tokens']}",
            )

        max_tool = int(data["max_tool_calls"])
        if (
            ceiling["max_tool_calls"] is not None
            and max_tool > ceiling["max_tool_calls"]
        ):
            raise GovernanceViolation(
                400,
                "SCOPE_CEILING_EXCEEDED",
                f"Declared tool calls {max_tool} exceeds {scope} ceiling {ceiling['max_tool_calls']}",
            )

        return cls(
            task_id=str(data["task_id"]),
            scope=scope,
            success_criteria=list(data["success_criteria"]),
            allowed_tools=list(data["allowed_tools"]),
            side_effect_policy=str(data["side_effect_policy"]),
            max_model_calls=max_calls,
            max_tool_calls=max_tool,
            max_input_tokens=max_input,
            max_output_tokens=int(data["max_output_tokens"]),
            max_cost_usd=float(data["max_cost_usd"]),
            max_wall_clock_seconds=int(data["max_wall_clock_seconds"]),
            max_retries=int(data["max_retries"]),
            max_escalations=int(data["max_escalations"]),
            escalation_policy=str(data["escalation_policy"]),
            baseline_id=str(data["baseline_id"]),
            provider=str(data["provider"]),
            model_snapshot=str(data["model_snapshot"]),
            rate_card_version=str(data["rate_card_version"]),
        )


@dataclass(frozen=True)
class RateCard:
    version: str
    input_rate: float  # USD per 1M tokens
    cached_rate: float  # USD per 1M tokens
    output_rate: float  # USD per 1M tokens
    reasoning_rate: float  # USD per 1M tokens

    def calculate(
        self,
        uncached_input: int,
        cached_input: int,
        output: int,
        reasoning: int,
        tool_cost: float = 0.0,
        infra_cost: float = 0.0,
    ) -> float:
        input_c = (uncached_input * self.input_rate) / 1_000_000.0
        cached_c = (cached_input * self.cached_rate) / 1_000_000.0
        output_c = (output * self.output_rate) / 1_000_000.0
        reasoning_c = (reasoning * self.reasoning_rate) / 1_000_000.0
        return round(input_c + cached_c + output_c + reasoning_c + tool_cost + infra_cost, 6)


class RateCardManager:
    def __init__(self):
        self._cards: Dict[str, RateCard] = {}

    def register(
        self,
        version: str,
        input_rate: float,
        cached_rate: float,
        output_rate: float,
        reasoning_rate: float,
    ) -> RateCard:
        card = RateCard(version, input_rate, cached_rate, output_rate, reasoning_rate)
        self._cards[version] = card
        return card

    def get(self, version: str) -> RateCard:
        if version not in self._cards:
            return RateCard(
                version=version,
                input_rate=1.0,
                cached_rate=0.5,
                output_rate=2.0,
                reasoning_rate=2.0,
            )
        return self._cards[version]


class AtomicBudgetGate:
    def __init__(self, max_cost_usd: float):
        self.max_cost_usd = float(max_cost_usd)
        self._lock = threading.Lock()
        self._reservations: Dict[str, float] = {}
        self._actual_spend: float = 0.0

    def remaining_budget(self, task_id: str = "") -> float:
        with self._lock:
            reserved = sum(self._reservations.values())
            return max(0.0, round(self.max_cost_usd - (self._actual_spend + reserved), 6))

    def reserve(
        self,
        task_id: str,
        attempt_id: str,
        rate_card: RateCard,
        estimated_input: int,
        estimated_output: int,
        expected_tool_cost: float = 0.0,
    ) -> str:
        res_id = f"{attempt_id}-RES"
        with self._lock:
            if res_id in self._reservations:
                raise GovernanceViolation(
                    409, "DUPLICATE_RESERVATION", f"Reservation {res_id} already exists"
                )

            est_cost = rate_card.calculate(
                uncached_input=estimated_input,
                cached_input=0,
                output=estimated_output,
                reasoning=0,
                tool_cost=expected_tool_cost,
            )
            current_reserved = sum(self._reservations.values())
            available = self.max_cost_usd - (self._actual_spend + current_reserved)

            if round(available - est_cost, 6) < 0:
                raise GovernanceViolation(
                    402,
                    "BUDGET_EXHAUSTED",
                    f"Estimated cost ${est_cost:.6f} exceeds remaining budget ${available:.6f}",
                )

            self._reservations[res_id] = est_cost
            return res_id

    def release_reservation(self, task_id: str, res_id: str) -> None:
        with self._lock:
            self._reservations.pop(res_id, None)

    def record_actual(self, task_id: str, res_id: str, actual_cost: float) -> None:
        with self._lock:
            self._reservations.pop(res_id, None)
            self._actual_spend = round(self._actual_spend + actual_cost, 6)


class CircuitBreakerEngine:
    """
    Evaluates 7 circuit breaker precedence levels in strict spec order:
    1. Hard limits (cost, calls, tokens, tools, deadline) -> "budget_exhausted" / "limit_exceeded"
    2. Safety or authorization failure -> "safety_violation"
    3. Missing required approval -> "needs_approval"
    4. Duplicate or unauthorized side effect -> "unauthorized_side_effect"
    5. Two identical failures -> "repeated_failure"
    6. Three subtask failures -> "subtask_failure"
    7. Shared no_progress_count reaches 2 -> "no_progress"
    """

    def __init__(self, initial_no_progress_count: int = 0):
        self._no_progress_count = initial_no_progress_count

    @property
    def no_progress_count(self) -> int:
        return self._no_progress_count

    def increment_no_progress(self) -> int:
        self._no_progress_count += 1
        return self._no_progress_count

    def reset_no_progress(self) -> None:
        self._no_progress_count = 0

    def evaluate(
        self,
        budget_exhausted: bool = False,
        limit_exceeded: bool = False,
        safety_violation: bool = False,
        needs_approval: bool = False,
        unauthorized_side_effect: bool = False,
        repeated_failure: bool = False,
        subtask_failure: bool = False,
        no_progress_count: Optional[int] = None,
    ) -> Optional[str]:
        np_count = (
            self._no_progress_count if no_progress_count is None else no_progress_count
        )

        # Rank 1: Hard limits (cost, calls, tokens, tools, deadline)
        if budget_exhausted:
            return "budget_exhausted"
        if limit_exceeded:
            return "limit_exceeded"

        # Rank 2: Safety or authorization failure
        if safety_violation:
            return "safety_violation"

        # Rank 3: Missing required approval
        if needs_approval:
            return "needs_approval"

        # Rank 4: Duplicate or unauthorized side effect
        if unauthorized_side_effect:
            return "unauthorized_side_effect"

        # Rank 5: Two identical failures
        if repeated_failure:
            return "repeated_failure"

        # Rank 6: Three subtask failures
        if subtask_failure:
            return "subtask_failure"

        # Rank 7: Shared no_progress_count reaches 2
        if np_count >= 2:
            return "no_progress"

        return None

