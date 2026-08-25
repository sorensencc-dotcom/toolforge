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
    if route.get("provider") != "openrouter":
        raise ValueError("route is not openrouter")
    api_key = execution_context.get("api_key") or os.environ.get("OPENROUTER_API_KEY")
    base_url = execution_context.get("base_url", "https://openrouter.ai/api/v1")
    if not api_key or not base_url:
        return ProviderResult("failed", "CONFIGURATION", "openrouter", route.get("model", ""), {}, 0)
    body = json.dumps({"model": route["model"], "messages": [{"role": "user", "content": task}]}).encode()
    req = urllib.request.Request(base_url.rstrip("/") + "/chat/completions", data=body, headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
    try:
        with request(req, timeout=float(execution_context.get("timeout_seconds", 30))) as response:
            payload = json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return ProviderResult("failed", "PROVIDER_ERROR", "openrouter", route.get("model", ""), {}, 0)
    if "error" in payload:
        return ProviderResult("failed", "PROVIDER_ERROR", "openrouter", route.get("model", ""), {}, 0)
    output = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    return ProviderResult("succeeded", None, "openrouter", route.get("model", ""), payload.get("usage", {}), 0, output)
