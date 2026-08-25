from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class ProviderResult:
    status: str
    failure_class: str | None
    provider: str
    model: str
    usage: dict[str, Any]
    cost: float
    output: str = ""


def run_provider(route: dict[str, Any], task: str, execution_context: dict[str, Any], request: Callable = urllib.request.urlopen) -> ProviderResult:
    if route.get("provider") != "ollama":
        raise ValueError("route is not ollama")
    base_url = execution_context.get("base_url") or os.environ.get("OLLAMA_BASE_URL")
    if not base_url:
        return ProviderResult("failed", "CONFIGURATION", "ollama", route.get("model", ""), {}, 0)
    url = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps({"model": route["model"], "messages": [{"role": "user", "content": task}]}).encode()
    try:
        with request(urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=float(execution_context.get("timeout_seconds", 30))) as response:
            payload = json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return ProviderResult("failed", "PROVIDER_ERROR", "ollama", route.get("model", ""), {}, 0)
    if "error" in payload:
        return ProviderResult("failed", "PROVIDER_ERROR", "ollama", route.get("model", ""), {}, 0)
    output = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    return ProviderResult("succeeded", None, "ollama", route.get("model", ""), payload.get("usage", {}), 0, output)
