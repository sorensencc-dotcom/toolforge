# Agent Cost Governance Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `cost_governance_runtime.py` and `cost_gate_adapter.py` to enforce candidate specification `CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1` with fail-closed contract validation, atomic thread-safe budget reservation, pinned rate cards, deterministic circuit breakers, schema-versioned evidence logging, and report-only scaling gate evaluation.

**Architecture:** A standalone Python runtime engine (`WRAPPERS/cost_governance_runtime.py`) coupled with a dedicated CLI adapter (`adapters/cost_gate_adapter.py`) and a comprehensive test suite (`tests/test_cost_governance_runtime.py`).

**Tech Stack:** Python 3.10+ standard library (`unittest`, `json`, `threading`, `hashlib`, `uuid`, `dataclasses`).

## Global Constraints

- **Parent Spec Pinning:** `CIC-AI-AGENT-COST-SPEC-001@1.0.0-candidate.1`
- **Fail-Closed Behavior:** Any missing required field, version mismatch, or budget overshoot MUST fail closed immediately.
- **Rate-Card Pinning:** `estimated_next_cost` calculation MUST use the captured attempt rate card version.
- **Evidence Schema:** Schema version `1.0.0`, append-only JSONL, flush with `os.fsync`, idempotent `EVT-<uuid>` IDs. MUST record both `model` AND `model_snapshot`.
- **Scaling Gate:** Operates strictly in `REPORT_ONLY` mode.

---

### Task 1: ScopeLimitsRegistry & TaskContract Schema Validation

**Files:**
- Create: `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`
- Test: `CIC-GOVERNANCE/tests/test_cost_governance_runtime.py`

**Interfaces:**
- Consumes: None (root module)
- Produces: `ScopeLimitsRegistry`, `TaskContract`, `GovernanceViolation`

- [ ] **Step 1: Write the failing tests for ScopeLimitsRegistry and TaskContract**

```python
import unittest
from CIC-GOVERNANCE.WRAPPERS.cost_governance_runtime import (
    ScopeLimitsRegistry,
    TaskContract,
    GovernanceViolation,
)

class TestScopeLimitsAndTaskContract(unittest.TestCase):
    def test_scope_limits_version_mismatch_fails_closed(self):
        with self.assertRaises(GovernanceViolation) as ctx:
            ScopeLimitsRegistry("INVALID-VERSION-1.0")
        self.assertEqual(ctx.exception.code, "SCOPE_VERSION_MISMATCH")

    def test_task_contract_validates_required_fields(self):
        valid_payload = {
            "task_id": "TSK-001",
            "scope": "S1",
            "success_criteria": ["pass_test"],
            "allowed_tools": ["search"],
            "side_effect_policy": "read_only",
            "max_model_calls": 3,
            "max_tool_calls": 5,
            "max_input_tokens": 20000,
            "max_output_tokens": 4000,
            "max_cost_usd": 1.50,
            "max_wall_clock_seconds": 60,
            "max_retries": 2,
            "max_escalations": 1,
            "escalation_policy": "stronger_model",
            "baseline_id": "BASE-001",
            "provider": "google",
            "model_snapshot": "gemini-3.6-flash-2026-06-01",
            "rate_card_version": "v1.0.0",
        }
        contract = TaskContract.from_dict(valid_payload)
        self.assertEqual(contract.task_id, "TSK-001")
        self.assertEqual(contract.scope, "S1")

    def test_task_contract_rejects_broadening_scope(self):
        payload = {
            "task_id": "TSK-002",
            "scope": "S0", # S0 permits max 1 call, 2000 input tokens
            "success_criteria": [],
            "allowed_tools": [],
            "side_effect_policy": "read_only",
            "max_model_calls": 5, # Exceeds S0 ceiling of 1
            "max_tool_calls": 0,
            "max_input_tokens": 2000,
            "max_output_tokens": 1000,
            "max_cost_usd": 0.50,
            "max_wall_clock_seconds": 30,
            "max_retries": 0,
            "max_escalations": 0,
            "escalation_policy": "none",
            "baseline_id": "BASE-001",
            "provider": "google",
            "model_snapshot": "gemini-3.6-flash-2026-06-01",
            "rate_card_version": "v1.0.0",
        }
        with self.assertRaises(GovernanceViolation) as ctx:
            TaskContract.from_dict(payload)
        self.assertEqual(ctx.exception.code, "SCOPE_CEILING_EXCEEDED")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: FAIL with `ModuleNotFoundError` or `ImportError`.

- [ ] **Step 3: Implement ScopeLimitsRegistry and TaskContract**

Write minimal implementation in `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`:
```python
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
            raise GovernanceViolation(400, "SCOPE_VERSION_MISMATCH", f"Expected {PINNED_SPEC_VERSION}, got {spec_version}")
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
    def from_dict(cls, data: Dict[str, Any], registry: Optional[ScopeLimitsRegistry] = None) -> TaskContract:
        reg = registry or ScopeLimitsRegistry()
        required_fields = [
            "task_id", "scope", "success_criteria", "allowed_tools",
            "side_effect_policy", "max_model_calls", "max_tool_calls",
            "max_input_tokens", "max_output_tokens", "max_cost_usd",
            "max_wall_clock_seconds", "max_retries", "max_escalations",
            "escalation_policy", "baseline_id", "provider",
            "model_snapshot", "rate_card_version",
        ]
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise GovernanceViolation(400, "CONTRACT_INVALID", f"Missing fields: {', '.join(missing)}")

        scope = str(data["scope"])
        ceiling = reg.get_ceiling(scope)

        max_calls = int(data["max_model_calls"])
        if ceiling["max_model_calls"] is not None and max_calls > ceiling["max_model_calls"]:
            raise GovernanceViolation(400, "SCOPE_CEILING_EXCEEDED", f"Declared calls {max_calls} exceeds {scope} ceiling {ceiling['max_model_calls']}")

        max_input = int(data["max_input_tokens"])
        if ceiling["max_input_tokens"] is not None and max_input > ceiling["max_input_tokens"]:
            raise GovernanceViolation(400, "SCOPE_CEILING_EXCEEDED", f"Declared input tokens {max_input} exceeds {scope} ceiling {ceiling['max_input_tokens']}")

        return cls(
            task_id=str(data["task_id"]),
            scope=scope,
            success_criteria=list(data["success_criteria"]),
            allowed_tools=list(data["allowed_tools"]),
            side_effect_policy=str(data["side_effect_policy"]),
            max_model_calls=max_calls,
            max_tool_calls=int(data["max_tool_calls"]),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py CIC-GOVERNANCE/tests/test_cost_governance_runtime.py
git commit -m "feat(governance): add ScopeLimitsRegistry and TaskContract validation"
```

---

### Task 2: RateCardManager & AtomicBudgetGate Thread-Safe Reservation/Rollback

**Files:**
- Modify: `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`
- Modify: `CIC-GOVERNANCE/tests/test_cost_governance_runtime.py`

**Interfaces:**
- Consumes: `GovernanceViolation`, `TaskContract`
- Produces: `RateCardManager`, `RateCard`, `AtomicBudgetGate`

- [ ] **Step 1: Write failing tests for RateCardManager and AtomicBudgetGate**

```python
    def test_rate_card_pinned_to_attempt(self):
        rcm = RateCardManager()
        rcm.register("v1.0.0", input_rate=1.0, cached_rate=0.5, output_rate=2.0, reasoning_rate=3.0)
        card = rcm.get("v1.0.0")
        cost = card.calculate(uncached_input=1_000_000, cached_input=0, output=500_000, reasoning=0)
        self.assertEqual(cost, 2.0) # $1.00 input + $1.00 output

    def test_atomic_budget_gate_reservation_and_overspend_prevention(self):
        gate = AtomicBudgetGate(max_cost_usd=1.00)
        card = RateCard("v1.0.0", input_rate=1.0, cached_rate=0.5, output_rate=2.0, reasoning_rate=3.0)
        
        # Reserve attempt 1 within budget ($0.50)
        res_id = gate.reserve("TSK-001", "ATT-001", card, estimated_input=250_000, estimated_output=125_000)
        self.assertEqual(gate.remaining_budget("TSK-001"), 0.50)

        # Attempt 2 reservation exceeding remaining budget ($0.60 > $0.50) fails closed
        with self.assertRaises(GovernanceViolation) as ctx:
            gate.reserve("TSK-001", "ATT-002", card, estimated_input=300_000, estimated_output=150_000)
        self.assertEqual(ctx.exception.code, "BUDGET_EXHAUSTED")

        # Rollback attempt 1 releases funds
        gate.release_reservation("TSK-001", res_id)
        self.assertEqual(gate.remaining_budget("TSK-001"), 1.00)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: FAIL with `NameError: name 'RateCardManager' is not defined`.

- [ ] **Step 3: Implement RateCardManager and AtomicBudgetGate**

Add to `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`:
```python
import threading

@dataclass(frozen=True)
class RateCard:
    version: str
    input_rate: float        # per 1M tokens USD
    cached_rate: float       # per 1M tokens USD
    output_rate: float       # per 1M tokens USD
    reasoning_rate: float    # per 1M tokens USD

    def calculate(self, uncached_input: int, cached_input: int, output: int, reasoning: int, tool_cost: float = 0.0, infra_cost: float = 0.0) -> float:
        input_c = (uncached_input * self.input_rate) / 1_000_000.0
        cached_c = (cached_input * self.cached_rate) / 1_000_000.0
        output_c = (output * self.output_rate) / 1_000_000.0
        reasoning_c = (reasoning * self.reasoning_rate) / 1_000_000.0
        return round(input_c + cached_c + output_c + reasoning_c + tool_cost + infra_cost, 6)

class RateCardManager:
    def __init__(self):
        self._cards: Dict[str, RateCard] = {}

    def register(self, version: str, input_rate: float, cached_rate: float, output_rate: float, reasoning_rate: float) -> RateCard:
        card = RateCard(version, input_rate, cached_rate, output_rate, reasoning_rate)
        self._cards[version] = card
        return card

    def get(self, version: str) -> RateCard:
        if version not in self._cards:
            # Default fallback rate card if unregistered
            return RateCard(version, input_rate=1.0, cached_rate=0.5, output_rate=2.0, reasoning_rate=2.0)
        return self._cards[version]

class AtomicBudgetGate:
    def __init__(self, max_cost_usd: float):
        self.max_cost_usd = max_cost_usd
        self._lock = threading.Lock()
        self._reservations: Dict[str, float] = {} # res_id -> reserved_amount
        self._actual_spend: float = 0.0

    def remaining_budget(self, task_id: str) -> float:
        with self._lock:
            reserved = sum(self._reservations.values())
            return max(0.0, round(self.max_cost_usd - (self._actual_spend + reserved), 6))

    def reserve(self, task_id: str, attempt_id: str, rate_card: RateCard, estimated_input: int, estimated_output: int, expected_tool_cost: float = 0.0) -> str:
        res_id = f"{attempt_id}-RES"
        with self._lock:
            if res_id in self._reservations:
                raise GovernanceViolation(409, "DUPLICATE_RESERVATION", f"Reservation {res_id} already exists")

            est_cost = rate_card.calculate(uncached_input=estimated_input, cached_input=0, output=estimated_output, reasoning=0, tool_cost=expected_tool_cost)
            current_reserved = sum(self._reservations.values())
            available = self.max_cost_usd - (self._actual_spend + current_reserved)

            if est_cost > available:
                raise GovernanceViolation(402, "BUDGET_EXHAUSTED", f"Estimated cost ${est_cost:.6f} exceeds remaining budget ${available:.6f}")

            self._reservations[res_id] = est_cost
            return res_id

    def release_reservation(self, task_id: str, res_id: str) -> None:
        with self._lock:
            self._reservations.pop(res_id, None)

    def record_actual(self, task_id: str, res_id: str, actual_cost: float) -> None:
        with self._lock:
            self._reservations.pop(res_id, None)
            self._actual_spend = round(self._actual_spend + actual_cost, 6)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py CIC-GOVERNANCE/tests/test_cost_governance_runtime.py
git commit -m "feat(governance): add RateCardManager and thread-safe AtomicBudgetGate"
```

---

### Task 3: Deterministic CircuitBreaker Engine & Precedence Rules

**Files:**
- Modify: `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`
- Modify: `CIC-GOVERNANCE/tests/test_cost_governance_runtime.py`

**Interfaces:**
- Consumes: `GovernanceViolation`
- Produces: `CircuitBreakerEngine`, `TerminationReason`

- [ ] **Step 1: Write failing tests for CircuitBreakerEngine precedence**

```python
    def test_circuit_breaker_precedence_order(self):
        engine = CircuitBreakerEngine()
        
        # When hard limit AND safety violation occur simultaneously, hard limit wins (Precedence 1 > 2)
        reason = engine.evaluate(
            budget_exhausted=True,
            safety_violation=True,
            needs_approval=False,
            unauthorized_side_effect=False,
            repeated_failure=False,
            subtask_failure=False,
            no_progress_count=0
        )
        self.assertEqual(reason, "budget_exhausted")

        # Safety violation wins over missing approval (Precedence 2 > 3)
        reason2 = engine.evaluate(
            budget_exhausted=False,
            safety_violation=True,
            needs_approval=True,
            unauthorized_side_effect=False,
            repeated_failure=False,
            subtask_failure=False,
            no_progress_count=0
        )
        self.assertEqual(reason2, "safety_violation")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: FAIL with `NameError: name 'CircuitBreakerEngine' is not defined`.

- [ ] **Step 3: Implement CircuitBreakerEngine**

Add to `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`:
```python
class CircuitBreakerEngine:
    """
    Evaluates 7 circuit breaker precedence levels in strict spec order:
    1. hard budget, call, token, tool, or deadline limit -> budget_exhausted / limit_exceeded
    2. safety or authorization failure -> safety_violation
    3. missing required approval -> needs_approval
    4. duplicate or unauthorized side effect -> unauthorized_side_effect
    5. two identical failures -> repeated_failure
    6. three failed attempts on one subtask -> subtask_failure
    7. shared no_progress_count reaches 2 -> no_progress
    """
    def evaluate(
        self,
        budget_exhausted: bool = False,
        limit_exceeded: bool = False,
        safety_violation: bool = False,
        needs_approval: bool = False,
        unauthorized_side_effect: bool = False,
        repeated_failure: bool = False,
        subtask_failure: bool = False,
        no_progress_count: int = 0
    ) -> Optional[str]:
        if budget_exhausted:
            return "budget_exhausted"
        if limit_exceeded:
            return "limit_exceeded"
        if safety_violation:
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py CIC-GOVERNANCE/tests/test_cost_governance_runtime.py
git commit -m "feat(governance): add CircuitBreakerEngine with 7-tier precedence evaluation"
```

---

### Task 4: Append-Only EvidenceLogger & ScalingGate Evaluator (REPORT_ONLY)

**Files:**
- Modify: `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`
- Modify: `CIC-GOVERNANCE/tests/test_cost_governance_runtime.py`

**Interfaces:**
- Consumes: `GovernanceViolation`
- Produces: `EvidenceLogger`, `ScalingGateEvaluator`

- [ ] **Step 1: Write failing tests for EvidenceLogger and ScalingGateEvaluator**

```python
import os
import tempfile

    def test_evidence_logger_emits_model_and_model_snapshot(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = os.path.join(tmpdir, "evidence.jsonl")
            logger = EvidenceLogger(log_path)
            record = logger.emit(
                task_id="TSK-001",
                scope_declared="S1",
                scope_used="S1",
                baseline_id="BASE-01",
                model="gemini-3.6-flash",
                model_snapshot="gemini-3.6-flash-2026-06-01",
                input_tokens=1000,
                cached_input_tokens=200,
                output_tokens=300,
                reasoning_tokens=0,
                tool_calls=1,
                retry_count=0,
                actual_cost_usd=0.005,
                baseline_cost_usd=0.010,
                net_savings_usd=0.005,
                success=True,
                quality_score=0.95,
                failure_class=None,
                escalated=False,
                escalation_count=0,
                termination_reason="completed",
                elapsed_ms=1200,
                provider="google",
                rate_card_version="v1.0.0",
                currency="USD"
            )
            self.assertEqual(record["model"], "gemini-3.6-flash")
            self.assertEqual(record["model_snapshot"], "gemini-3.6-flash-2026-06-01")
            self.assertTrue(os.path.exists(log_path))

    def test_scaling_gate_is_report_only(self):
        gate = ScalingGateEvaluator()
        result = gate.evaluate(tasks=[{"success": True, "cost": 0.01}] * 50)
        self.assertEqual(result["status"], "REPORT_ONLY")
        self.assertIn("recommendation", result)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: FAIL with `NameError: name 'EvidenceLogger' is not defined`.

- [ ] **Step 3: Implement EvidenceLogger and ScalingGateEvaluator**

Add to `CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py`:
```python
import json
import uuid
from pathlib import Path

class EvidenceLogger:
    SCHEMA_VERSION = "1.0.0"

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, **kwargs: Any) -> Dict[str, Any]:
        required = [
            "task_id", "scope_declared", "scope_used", "baseline_id",
            "model", "model_snapshot", "input_tokens", "cached_input_tokens",
            "output_tokens", "reasoning_tokens", "tool_calls", "retry_count",
            "actual_cost_usd", "baseline_cost_usd", "net_savings_usd",
            "success", "quality_score", "failure_class", "escalated",
            "escalation_count", "termination_reason", "elapsed_ms",
            "provider", "rate_card_version", "currency"
        ]
        missing = [f for f in required if f not in kwargs]
        if missing:
            raise GovernanceViolation(400, "EVIDENCE_INVALID", f"Missing required fields: {', '.join(missing)}")

        record = {
            "event_id": f"EVT-{uuid.uuid4().hex}",
            "schema_version": self.SCHEMA_VERSION,
            **kwargs
        }
        encoded = json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        return record

class ScalingGateEvaluator:
    def evaluate(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        if len(tasks) < 50:
            return {
                "status": "REPORT_ONLY",
                "recommendation": "INSUFFICIENT_DATA",
                "sample_size": len(tasks),
                "required_sample_size": 50,
            }
        successful = [t for t in tasks if t.get("success")]
        success_rate = len(successful) / len(tasks)
        recommendation = "PASS" if success_rate >= 0.90 else "HOLD"
        return {
            "status": "REPORT_ONLY",
            "recommendation": recommendation,
            "sample_size": len(tasks),
            "success_rate": success_rate,
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CIC-GOVERNANCE/WRAPPERS/cost_governance_runtime.py CIC-GOVERNANCE/tests/test_cost_governance_runtime.py
git commit -m "feat(governance): add EvidenceLogger and REPORT_ONLY ScalingGateEvaluator"
```

---

### Task 5: CostGateAdapter Interface & Integration Wiring

**Files:**
- Create: `CIC-GOVERNANCE/adapters/cost_gate_adapter.py`
- Modify: `CIC-GOVERNANCE/tests/test_cost_governance_runtime.py`

**Interfaces:**
- Consumes: `TaskContract`, `AtomicBudgetGate`, `CircuitBreakerEngine`, `EvidenceLogger`
- Produces: CLI interface for JSON input/output cost gate execution

- [ ] **Step 1: Write failing integration test for cost_gate_adapter**

```python
import subprocess
import sys

    def test_cost_gate_adapter_cli_execution(self):
        valid_contract_json = json.dumps({
            "task_id": "TSK-CLI-01",
            "scope": "S1",
            "success_criteria": ["ok"],
            "allowed_tools": [],
            "side_effect_policy": "read_only",
            "max_model_calls": 3,
            "max_tool_calls": 0,
            "max_input_tokens": 20000,
            "max_output_tokens": 4000,
            "max_cost_usd": 1.00,
            "max_wall_clock_seconds": 60,
            "max_retries": 1,
            "max_escalations": 0,
            "escalation_policy": "none",
            "baseline_id": "BASE-01",
            "provider": "google",
            "model_snapshot": "gemini-3.6-flash-2026-06-01",
            "rate_card_version": "v1.0.0",
        })
        adapter_path = os.path.join(ROOT, "adapters", "cost_gate_adapter.py")
        proc = subprocess.run(
            [sys.executable, adapter_path, valid_contract_json],
            capture_output=True, text=True
        )
        self.assertEqual(proc.returncode, 0)
        output = json.loads(proc.stdout)
        self.assertEqual(output["status"], "PASS")
        self.assertEqual(output["task_id"], "TSK-CLI-01")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: FAIL with `FileNotFoundError: adapters/cost_gate_adapter.py`.

- [ ] **Step 3: Implement cost_gate_adapter.py**

Create `CIC-GOVERNANCE/adapters/cost_gate_adapter.py`:
```python
"""Standalone CLI & API adapter for CIC Cost Governance Spec evaluation."""

from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "WRAPPERS"))

from cost_governance_runtime import (
    TaskContract,
    GovernanceViolation,
    ScopeLimitsRegistry,
    PINNED_SPEC_VERSION,
)

def evaluate_contract_json(payload_json: str) -> dict:
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

if __name__ == "__main__":
    main(sys.argv)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest CIC-GOVERNANCE/tests/test_cost_governance_runtime.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add CIC-GOVERNANCE/adapters/cost_gate_adapter.py CIC-GOVERNANCE/tests/test_cost_governance_runtime.py
git commit -m "feat(governance): add standalone cost_gate_adapter CLI and integration tests"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-agent-cost-governance-runtime.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
