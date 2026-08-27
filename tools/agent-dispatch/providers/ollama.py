from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import urlparse

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
    base_url = route.get("endpoint") or os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"localhost", "127.0.0.1", "::1", "host.docker.internal", "ollama"}:
        return ProviderResult("failed", "CONFIGURATION", "ollama", route.get("model", ""), {}, 0)
    model_name = route.get("model", "")
    if model_name == "configured":
        model_name = os.environ.get("OLLAMA_MODEL", "llama3.2:latest")
    body = json.dumps({"model": model_name, "messages": [{"role": "user", "content": task}]}).encode()
    try:
        with request(urllib.request.Request(base_url.rstrip("/") + "/chat/completions", data=body, headers={"Content-Type": "application/json"}), timeout=float(execution_context.get("timeout_seconds", 30))) as response:
            payload = json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return ProviderResult("failed", "PROVIDER_ERROR", "ollama", route.get("model", ""), {}, 0)
    if "error" in payload:
        return ProviderResult("failed", "PROVIDER_ERROR", "ollama", route.get("model", ""), {}, 0)
    output = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    return ProviderResult("succeeded", None, "ollama", route.get("model", ""), payload.get("usage", {}), 0, output)
