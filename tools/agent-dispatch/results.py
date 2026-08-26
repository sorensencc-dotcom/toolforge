from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def write_result(result: dict[str, Any], output_dir: str | Path) -> dict[str, str]:
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix="result-", suffix=".json.tmp", dir=directory)
    os.close(fd)
    temp = Path(name)
    target = directory / "result.json"
    temp.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    temp.replace(target)
    summary = f"status={result.get('final_status')} attempts={len(result.get('attempts', []))}"
    return {"result_path": str(target), "summary": summary}
