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


def init_trace(trace_path: str | Path) -> Path:
    """Initializes or truncates a trace file before execution, ensuring a clean single-run audit record."""
    path = Path(trace_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("", encoding="utf-8")
    return path


def reset_trace(trace_path: str | Path) -> Path:
    """Alias for init_trace."""
    return init_trace(trace_path)


def append_trace(event: dict[str, Any], trace_path: str | Path, reset: bool = False) -> None:
    """Appends an event to the trace file, optionally truncating if reset=True."""
    path = Path(trace_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    safe = _redact(event)
    mode = "w" if reset else "a"
    with path.open(mode, encoding="utf-8") as handle:
        handle.write(json.dumps(safe, sort_keys=True) + "\n")


def write_trace(events: list[dict[str, Any]], trace_path: str | Path) -> Path:
    """Writes a complete list of trace events to a run-specific trace file, replacing any existing contents."""
    path = Path(trace_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(_redact(e), sort_keys=True) + "\n" for e in events]
    path.write_text("".join(lines), encoding="utf-8")
    return path
