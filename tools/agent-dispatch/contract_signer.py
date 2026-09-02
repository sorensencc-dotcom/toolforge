from __future__ import annotations

import json
import subprocess
from pathlib import Path

class ContractSigningError(Exception):
    pass

def sign_contract(contract_path: Path, identity_path: Path, signer_command: list[str]) -> dict:
    command = [*signer_command, "--contract", str(contract_path), "--identity", str(identity_path)]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ContractSigningError("SIGIL_SIGNER_UNAVAILABLE") from exc
    if completed.returncode != 0:
        raise ContractSigningError("CONTRACT_SIGNING_FAILED")
    try:
        return json.loads(completed.stdout.splitlines()[-1])
    except (IndexError, json.JSONDecodeError) as exc:
        raise ContractSigningError("SIGIL_SIGNER_BAD_RESPONSE") from exc


