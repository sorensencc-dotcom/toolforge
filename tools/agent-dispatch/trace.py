from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def append_trace(event: dict[str, Any], trace_path: str | Path) -> None:
    path = Path(trace_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    safe = {k: v for k, v in event.items() if k not in {"api_key", "credential", "secret", "token"}}
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(safe, sort_keys=True) + "\n")
