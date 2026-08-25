from __future__ import annotations

import subprocess
from dataclasses import dataclass
from typing import Any


@dataclass
class ProviderResult:
    status: str
    failure_class: str | None
    provider: str
    model: str
    usage: dict[str, Any]
    cost: float
    stdout: str = ""
    stderr: str = ""


def run_provider(route: dict[str, Any], task: str, execution_context: dict[str, Any]) -> ProviderResult:
    if route.get("provider") != "subscription-cli":
        raise ValueError("route is not subscription-cli")
    catalog_route = execution_context.get("catalog_route")
    if not isinstance(catalog_route, dict) or catalog_route.get("provider") != route.get("provider"):
        return ProviderResult("failed", "CONFIGURATION", route["provider"], route["model"], {}, 0)
    executable = catalog_route.get("command", {}).get("executable")
    if not isinstance(executable, str) or not executable:
        return ProviderResult("failed", "CONFIGURATION", route["provider"], route["model"], {}, 0)
    timeout = float(execution_context.get("timeout_seconds", 30))
    try:
        completed = subprocess.run([executable], input=task, text=True, capture_output=True, timeout=timeout, check=False)
    except FileNotFoundError:
        return ProviderResult("failed", "CONFIGURATION", route["provider"], route["model"], {}, 0)
    except subprocess.TimeoutExpired:
        return ProviderResult("failed", "TIMEOUT", route["provider"], route["model"], {}, 0)
    if completed.returncode != 0:
        return ProviderResult("failed", "PROVIDER_ERROR", route["provider"], route["model"], {}, 0, completed.stdout, completed.stderr)
    return ProviderResult("succeeded", None, route["provider"], route["model"], {}, 0, completed.stdout, completed.stderr)
