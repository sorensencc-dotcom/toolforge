from __future__ import annotations

import json
from pathlib import Path
from typing import Any


_SECRET_KEYS = {"api_key", "credential", "secret", "token", "authorization"}

def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: "[REDACTED]" if key.lower() in _SECRET_KEYS else _redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value

def append_trace(event: dict[str, Any], trace_path: str | Path) -> None:
    path = Path(trace_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    safe = _redact(event)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(safe, sort_keys=True) + "\n")
