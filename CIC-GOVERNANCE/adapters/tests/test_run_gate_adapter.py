import json
import subprocess
import sys
from pathlib import Path

ADAPTER = Path(__file__).resolve().parents[1] / "run_gate_adapter.py"
CWD = Path(__file__).resolve().parents[2]  # CIC-GOVERNANCE/


def run_adapter(gate_id: str) -> dict:
    proc = subprocess.run(
        [sys.executable, str(ADAPTER), gate_id],
        cwd=CWD,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, f"adapter exited {proc.returncode}, stderr: {proc.stderr}"
    lines = [l for l in proc.stdout.splitlines() if l.strip()]
    assert len(lines) == 1, f"expected exactly one stdout line, got: {proc.stdout!r}"
    return json.loads(lines[0])


def test_gate01_returns_pass_or_fail_shape():
    payload = run_adapter("GATE-01")
    assert payload["status"] in ("PASS", "FAIL", "ERROR")
    assert isinstance(payload["violations"], list)
    assert isinstance(payload["message"], str)
    for v in payload["violations"]:
        assert set(v.keys()) == {"testId", "description", "outcome"}
        assert v["outcome"] in ("FAIL", "ERROR")


def test_unknown_gate_returns_structured_error():
    payload = run_adapter("GATE-99")
    assert payload == {
        "status": "ERROR",
        "violations": [],
        "message": "gate not wired",
    }
