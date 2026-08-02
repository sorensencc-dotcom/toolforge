"""Agent Cost Governance Runtime implementation for CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1."""

from __future__ import annotations
import re
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
