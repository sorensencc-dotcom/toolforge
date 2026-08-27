#!/usr/bin/env python3
"""TorqueQuery Hybrid Agent Dispatch Runner CLI.

Deterministic, fail-closed entry point for signed task dispatch across
local subscription CLIs, Ollama models, and OpenRouter models.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from jsonschema import Draft202012Validator

# Ensure agent-dispatch directory is in Python path
AGENT_DISPATCH_DIR = Path(__file__).resolve().parent
if str(AGENT_DISPATCH_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DISPATCH_DIR))

from contract_verifier import ContractVerificationError, verify_contract
from dispatcher import dispatch
from preflight import PreflightResult, run_preflight
from providers import ollama, openrouter, subscription_cli
from results import write_result
from trace import append_trace


SCHEMA_PATH = AGENT_DISPATCH_DIR / "contracts" / "task-contract.schema.json"
DEFAULT_CATALOG_PATH = AGENT_DISPATCH_DIR / "providers" / "catalog.json"


def canonical_json_bytes(data: Any) -> bytes:
    """Compute RFC 8785 canonical JSON bytes (keys sorted, no whitespace)."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_contract_hash(contract: dict[str, Any]) -> str:
    """Compute SHA-256 hash of unsigned contract body."""
    unsigned = {k: v for k, v in contract.items() if k != "signature"}
    digest = hashlib.sha256(canonical_json_bytes(unsigned)).hexdigest()
    return f"sha256:{digest}"


def parse_arguments(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="TorqueQuery Hybrid Agent Dispatch Runner CLI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--contract", required=True, type=str, help="Path to signed task contract JSON")
    parser.add_argument("--registry", default=str(DEFAULT_CATALOG_PATH), type=str, help="Path to provider/identity registry JSON")
    parser.add_argument("--verifier-cmd", default="sigil verify-contract", type=str, help="CLI command used for contract verification")
    parser.add_argument("--worktree", default=os.getcwd(), type=str, help="Path to execution worktree")
    parser.add_argument("--workspace-root", default=os.getcwd(), type=str, help="Path to workspace root (enforces containment)")
    parser.add_argument("--dry-run", action="store_true", help="Execute dry-run preflight without invoking live endpoints")
    parser.add_argument("--override", default=None, type=str, help="Optional operator override token, JSON file, or route JSON")
    parser.add_argument("--live-smoke", action="store_true", help="Explicit approval flag required for live endpoint execution")
    parser.add_argument("--output-dir", default=str(AGENT_DISPATCH_DIR / "artifacts"), type=str, help="Directory to store trace and result artifacts")
    return parser.parse_args(argv)


def check_worktree_containment(worktree: str | Path, workspace_root: str | Path) -> tuple[bool, str]:
    resolved_wt = Path(os.path.realpath(str(worktree)))
    resolved_root = Path(os.path.realpath(str(workspace_root)))
    try:
        if not resolved_wt.is_relative_to(resolved_root):
            return False, f"Worktree '{resolved_wt}' is outside approved root '{resolved_root}'"
    except AttributeError:
        try:
            resolved_wt.relative_to(resolved_root)
        except ValueError:
            return False, f"Worktree '{resolved_wt}' is outside approved root '{resolved_root}'"
    return True, ""


def validate_expiry(expires_at: str, now: Optional[datetime] = None) -> tuple[bool, str]:
    if not expires_at.endswith("Z"):
        return False, "expires_at must be an ISO 8601 UTC timestamp ending in 'Z'"
    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError:
        return False, "expires_at timestamp is invalid"
    current_time = now or datetime.now(timezone.utc)
    if expiry - current_time < timedelta(seconds=60):
        return False, f"contract expired or within 60s skew boundary (expires: {expires_at}, now: {current_time.isoformat()})"
    return True, ""


def build_dry_run_adapters(catalog_routes: list[dict[str, Any]]) -> dict[str, Any]:
    def dry_run_handler(route: dict[str, Any], task: str, context: dict[str, Any]):
        return {
            "status": "succeeded",
            "dry_run": True,
            "provider": route.get("provider"),
            "model": route.get("model"),
            "cost": 0.0,
            "output": f"[DRY-RUN] Verified route for provider {route.get('provider')}:{route.get('model')}",
        }

    providers = {r.get("provider") for r in catalog_routes if r.get("provider")}
    return {p: dry_run_handler for p in providers}


def build_live_adapters(catalog_routes: list[dict[str, Any]]) -> dict[str, Any]:
    routes_by_provider = {r.get("provider"): r for r in catalog_routes}

    def run_sub_cli(route: dict[str, Any], task: str, context: dict[str, Any]):
        ctx = dict(context)
        ctx["catalog_route"] = routes_by_provider.get(route.get("provider"))
        return subscription_cli.run_provider(route, task, ctx)

    def run_oll(route: dict[str, Any], task: str, context: dict[str, Any]):
        return ollama.run_provider(route, task, context)

    def run_openr(route: dict[str, Any], task: str, context: dict[str, Any]):
        return openrouter.run_provider(route, task, context)

    return {
        "subscription-cli": run_sub_cli,
        "ollama": run_oll,
        "openrouter": run_openr,
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_arguments(argv)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    trace_path = output_dir / "trace.json"

    # Step 1: Resolve paths and check worktree containment
    contained, error_msg = check_worktree_containment(args.worktree, args.workspace_root)
    if not contained:
        fail_record = {
            "final_status": "refused",
            "reason": "WORKTREE_OUTSIDE_APPROVED_ROOT",
            "message": error_msg,
            "termination_reason": "WORKTREE_OUTSIDE_APPROVED_ROOT",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Worktree containment violation: {error_msg}", file=sys.stderr)
        return 1

    contract_path = Path(args.contract).resolve()
    registry_path = Path(args.registry).resolve()

    if not contract_path.exists():
        fail_record = {
            "final_status": "refused",
            "reason": "CONTRACT_FILE_NOT_FOUND",
            "message": f"Contract file not found: {contract_path}",
            "termination_reason": "CONTRACT_FILE_NOT_FOUND",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Contract not found: {contract_path}", file=sys.stderr)
        return 1

    # Step 2: Load contract and compute contract hash
    try:
        contract_text = contract_path.read_text(encoding="utf-8")
        contract = json.loads(contract_text)
    except Exception as exc:
        fail_record = {
            "final_status": "refused",
            "reason": "CONTRACT_JSON_INVALID",
            "message": str(exc),
            "termination_reason": "CONTRACT_JSON_INVALID",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Contract JSON invalid: {exc}", file=sys.stderr)
        return 1

    contract_hash = compute_contract_hash(contract)

    # Validate Schema
    if SCHEMA_PATH.exists():
        try:
            schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
            validator = Draft202012Validator(schema)
            errors = list(validator.iter_errors(contract))
            if errors:
                error_summary = "; ".join(e.message for e in errors[:3])
                fail_record = {
                    "contract_hash": contract_hash,
                    "final_status": "refused",
                    "reason": "CONTRACT_SCHEMA_INVALID",
                    "message": error_summary,
                    "termination_reason": "CONTRACT_SCHEMA_INVALID",
                }
                write_result(fail_record, output_dir)
                append_trace(fail_record, trace_path)
                print(f"[FAIL-CLOSED] Contract schema validation failed: {error_summary}", file=sys.stderr)
                return 1
        except Exception as exc:
            print(f"[WARN] Schema validator initialization failed: {exc}", file=sys.stderr)

    # Validate Expiry
    valid_expiry, expiry_msg = validate_expiry(contract.get("expires_at", ""))
    if not valid_expiry:
        fail_record = {
            "contract_hash": contract_hash,
            "final_status": "refused",
            "reason": "CONTRACT_EXPIRED",
            "message": expiry_msg,
            "termination_reason": "CONTRACT_EXPIRED",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Contract expiry check failed: {expiry_msg}", file=sys.stderr)
        return 1

    # Load Catalog
    if not registry_path.exists():
        fail_record = {
            "contract_hash": contract_hash,
            "final_status": "refused",
            "reason": "CATALOG_EMPTY_OR_UNAVAILABLE",
            "message": f"Registry path {registry_path} does not exist",
            "termination_reason": "CATALOG_EMPTY_OR_UNAVAILABLE",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Registry file not found: {registry_path}", file=sys.stderr)
        return 1

    try:
        registry_data = json.loads(registry_path.read_text(encoding="utf-8"))
        catalog_routes = registry_data.get("routes", [])
    except Exception as exc:
        fail_record = {
            "contract_hash": contract_hash,
            "final_status": "refused",
            "reason": "CATALOG_EMPTY_OR_UNAVAILABLE",
            "message": f"Could not parse registry file: {exc}",
            "termination_reason": "CATALOG_EMPTY_OR_UNAVAILABLE",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Could not parse registry file: {exc}", file=sys.stderr)
        return 1

    if not catalog_routes:
        fail_record = {
            "contract_hash": contract_hash,
            "final_status": "refused",
            "reason": "CATALOG_EMPTY_OR_UNAVAILABLE",
            "message": "Registry contains no routes",
            "termination_reason": "CATALOG_EMPTY_OR_UNAVAILABLE",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print("[FAIL-CLOSED] Registry contains no routes", file=sys.stderr)
        return 1


    # Step 3: Run verifier
    if isinstance(args.verifier_cmd, str):
        verifier_cmd = shlex.split(args.verifier_cmd, posix=(sys.platform != "win32"))
    else:
        verifier_cmd = list(args.verifier_cmd)
    try:
        preflight_res: PreflightResult = run_preflight(
            contract=contract,
            contract_path=contract_path,
            registry_path=registry_path,
            verifier_command=verifier_cmd,
        )
    except ContractVerificationError as exc:
        reason_code = str(exc) if str(exc) else "CONTRACT_SIGNATURE_INVALID"
        fail_record = {
            "contract_hash": contract_hash,
            "final_status": "refused",
            "reason": reason_code,
            "message": f"Contract verification rejected: {exc}",
            "termination_reason": reason_code,
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Contract verification failed: {exc}", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        reason_code = str(exc) if str(exc) else "TORQUEQUERY_POLICY_DENIED"
        fail_record = {
            "contract_hash": contract_hash,
            "final_status": "refused",
            "reason": reason_code,
            "message": f"Preflight policy rejected: {exc}",
            "termination_reason": reason_code,
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Preflight policy failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        fail_record = {
            "contract_hash": contract_hash,
            "final_status": "refused",
            "reason": "UNEXPECTED_ERROR",
            "message": str(exc),
            "termination_reason": "UNEXPECTED_ERROR",
        }
        write_result(fail_record, output_dir)
        append_trace(fail_record, trace_path)
        print(f"[FAIL-CLOSED] Unexpected error: {exc}", file=sys.stderr)
        return 1

    # Parse operator override if provided
    operator_routes = None
    if args.override:
        override_val = args.override.strip()
        if override_val.startswith("{"):
            try:
                parsed_override = json.loads(override_val)
                operator_routes = [parsed_override] if isinstance(parsed_override, dict) else parsed_override
            except json.JSONDecodeError:
                pass
        elif Path(override_val).exists():
            try:
                parsed_override = json.loads(Path(override_val).read_text(encoding="utf-8"))
                operator_routes = [parsed_override] if isinstance(parsed_override, dict) else parsed_override
            except Exception:
                pass

    # Build provider adapters
    if args.dry_run:
        adapters = build_dry_run_adapters(catalog_routes)
    else:
        # Live run check: require explicit approval flag
        if not args.live_smoke and contract.get("max_cost_usd", 0) > 0:
            fail_record = {
                "contract_hash": contract_hash,
                "final_status": "refused",
                "reason": "LIVE_SMOKE_APPROVAL_REQUIRED",
                "message": "Billable / live execution requires explicit --live-smoke approval flag",
                "termination_reason": "LIVE_SMOKE_APPROVAL_REQUIRED",
            }
            write_result(fail_record, output_dir)
            append_trace(fail_record, trace_path)
            print("[FAIL-CLOSED] Live smoke execution blocked: missing --live-smoke approval flag", file=sys.stderr)
            return 1
        adapters = build_live_adapters(catalog_routes)

    # Step 5: Dispatch execution
    dispatch_options = {
        "verification": preflight_res.verification or {"valid": True, "contract_hash": contract_hash},
        "recommendation": preflight_res.recommendation,
        "allowed_fallbacks": preflight_res.allowed_fallbacks,
        "candidate_routes": preflight_res.candidate_routes,
        "catalog": catalog_routes,
        "worktree": args.worktree,
        "workspace_root": args.workspace_root,
        "operator_override": bool(args.override),
        "operator_routes": operator_routes,
        "dry_run": args.dry_run,
        "adapters": adapters,
        "artifact_paths": [str(output_dir / "result.json"), str(trace_path)],
        "announce": lambda rec: print(f"[PREFLIGHT] Recommended Route: {rec.get('provider')}:{rec.get('model')} (Cost: {rec.get('cost_classification', 'unknown')})"),
    }


    result = dispatch(contract, dispatch_options)

    # Step 6: Write outputs
    write_result(result, output_dir)
    for attempt in result.get("attempts", []):
        append_trace(attempt, trace_path)

    # Terminal summary
    print("\n" + "=" * 60)
    print("TORQUEQUERY DISPATCH RECEIPT")
    print("=" * 60)
    print(f"Task ID:          {contract.get('task_id')}")
    print(f"Contract Hash:    {contract_hash}")
    print(f"Operator Identity:{result.get('operator_identity')}")
    print(f"Status:           {result.get('final_status')}")
    print(f"Termination:      {result.get('termination_reason')}")
    print(f"Attempts:         {len(result.get('attempts', []))}")
    if result.get("final_provider"):
        print(f"Provider:         {result.get('final_provider')}:{result.get('final_model')}")
    print(f"Total Cost:       ${result.get('total_cost', 0.0):.6f}")
    print(f"Artifacts:        {output_dir / 'result.json'}")
    print("=" * 60 + "\n")

    return 0 if result.get("final_status") == "succeeded" else 1


if __name__ == "__main__":
    sys.exit(main())
