#!/usr/bin/env python3
"""run.py

Execution runner for agent dispatch tasks.
Manages single-run trace file lifecycle (truncation/initialization at start of run),
contract loading, routing, dispatch execution, and atomic result emission.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from dispatcher import dispatch
from results import write_result
from trace import append_trace, init_trace


def execute_dispatch_run(
    contract: dict[str, Any],
    options: dict[str, Any],
    output_dir: str | Path = "./artifacts",
    trace_filename: str = "trace.json",
    truncate_trace: bool = True
) -> dict[str, Any]:
    """Executes a single dispatch run with strict trace lifecycle isolation.

    Args:
        contract: The task contract dictionary.
        options: Dispatch options including adapters, verification, operator_identity, catalog.
        output_dir: Destination directory for result.json and trace.json.
        trace_filename: Name of the trace file.
        truncate_trace: If True (default), truncates the trace file at the start of the run
                        to guarantee single-run audit isolation without stale entries.

    Returns:
        Dictionary containing dispatch result, result_path, trace_path, and summary.
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    trace_path = out_path / trace_filename

    # Trace Lifecycle: Ensure trace is cleanly initialized / truncated at run start
    if truncate_trace:
        init_trace(trace_path)

    contract_hash = options.get("verification", {}).get("contract_hash") or contract.get("contract_hash") or "unknown"
    operator_identity = options.get("operator_identity")

    # Record dispatch start event
    append_trace(
        {
            "event": "dispatch_start",
            "contract_hash": contract_hash,
            "operator_identity": operator_identity,
            "recommended_route": contract.get("recommended_route"),
            "max_cost_usd": contract.get("max_cost_usd", 0),
        },
        trace_path
    )

    # Execute Dispatch
    result = dispatch(contract, options)

    # Record all attempt events to the trace
    for i, attempt in enumerate(result.get("attempts", [])):
        append_trace(
            {
                "event": "attempt",
                "attempt_index": i + 1,
                "contract_hash": contract_hash,
                "route": attempt.get("route"),
                "result": attempt.get("result"),
            },
            trace_path
        )

    # Record dispatch completion event
    append_trace(
        {
            "event": "dispatch_end",
            "contract_hash": contract_hash,
            "final_status": result.get("final_status"),
            "termination_reason": result.get("termination_reason"),
            "final_provider": result.get("final_provider"),
            "final_model": result.get("final_model"),
        },
        trace_path
    )

    # Atomically write result.json
    receipt = write_result(result, out_path)

    return {
        "result": result,
        "result_path": receipt["result_path"],
        "trace_path": str(trace_path),
        "summary": receipt["summary"],
        "contract_hash": contract_hash
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Execute an agent task contract via hybrid dispatch.")
    parser.add_argument("contract", help="Path to contract JSON file")
    parser.add_argument("--output-dir", default="./artifacts", help="Directory to store result.json and trace.json")
    parser.add_argument("--trace-file", default="trace.json", help="Trace filename (default: trace.json)")
    parser.add_argument("--operator-identity", default="local-user", help="Authenticated operator identity")
    parser.add_argument("--no-truncate", action="store_true", help="Do not truncate trace file at start")

    args = parser.parse_args()

    contract_path = Path(args.contract)
    if not contract_path.is_file():
        sys.stderr.write(f"Error: contract file not found at '{contract_path}'\n")
        sys.exit(1)

    contract = json.loads(contract_path.read_text(encoding="utf-8"))

    # Default options for CLI run
    options = {
        "verification": {"valid": True, "contract_hash": contract.get("contract_hash", "sha256:cli")},
        "operator_identity": args.operator_identity,
        "catalog": [contract.get("recommended_route", {})] + contract.get("allowed_routes", []),
        "adapters": {}
    }

    res = execute_dispatch_run(
        contract=contract,
        options=options,
        output_dir=args.output_dir,
        trace_filename=args.trace_file,
        truncate_trace=not args.no_truncate
    )

    print(f"[Dispatch] Complete: {res['summary']}")
    print(f"[Dispatch] Result: {res['result_path']}")
    print(f"[Dispatch] Trace:  {res['trace_path']}")


if __name__ == "__main__":
    main()
