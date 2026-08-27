from __future__ import annotations

import json
import subprocess
from pathlib import Path


class ContractVerificationError(Exception):
    pass


def verify_contract(contract_path: Path, registry_path: Path, verifier_command: list[str]) -> dict:
    command = [*verifier_command, "--contract", str(contract_path), "--registry", str(registry_path)]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ContractVerificationError("SIGIL_VERIFIER_UNAVAILABLE") from exc
    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise ContractVerificationError("SIGIL_VERIFIER_BAD_RESPONSE") from exc
    if completed.returncode != 0 or result.get("valid") is not True:
        raise ContractVerificationError(result.get("reason") or "CONTRACT_SIGNATURE_INVALID")
    return result
