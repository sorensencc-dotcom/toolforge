#!/usr/bin/env python3
"""
last30days-skill.py - Adapter from the TRM DevOps Triage pipeline to the last30days engine.

Runs the real last30days engine (scripts/last30days.py --emit=json) and maps its
results onto the stage output contract used by trend-intelligence-sweep.json:
  topic, summary, scoredSignals, sourcesChecked

Engine location, in order of precedence:
  1. LAST30DAYS_SCRIPT env var (path to last30days.py)
  2. ~/.claude/skills/last30days/scripts/last30days.py, then
     ~/.claude/skills/synced/*/last30days/scripts/last30days.py

Headless note: the engine refuses to run its internal planner under an agent host
unless LAST30DAYS_ALLOW_ENGINE_PLAN=1 is set. This adapter sets it because the
pipeline runs unattended and has no host model to produce a --plan.

Failures exit non-zero (so the pipeline retryPolicy applies) and never fall back
to invented data.
"""

import glob
import json
import os
import subprocess
import sys

ENGINE_TIMEOUT_SECONDS = 50  # pipeline stage timeout is 60s; leave headroom
DEFAULT_TOPIC = "AI coding agents, harness engineering, token reduction"
MAX_SIGNALS = 10

SOURCE_LABELS = {
    "hackernews": "HackerNews",
    "reddit": "Reddit",
    "github": "GitHub",
    "x": "X/Twitter",
    "youtube": "YouTube",
    "polymarket": "Polymarket",
    "web": "Web",
    "digg": "Digg",
    "arxiv": "arXiv",
    "devto": "dev.to",
    "tiktok": "TikTok",
    "instagram": "Instagram",
    "bluesky": "Bluesky",
    "techmeme": "Techmeme",
    "linkedin": "LinkedIn",
    "grounding": "Web (grounding)",
}


def resolve_engine_path() -> str:
    env_path = os.environ.get("LAST30DAYS_SCRIPT", "").strip()
    if env_path:
        return env_path
    home = os.path.expanduser("~")
    candidates = [os.path.join(home, ".claude", "skills", "last30days", "scripts", "last30days.py")]
    candidates += sorted(
        glob.glob(os.path.join(home, ".claude", "skills", "synced", "*", "last30days", "scripts", "last30days.py"))
    )
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return candidates[0]


def label_for(source: str) -> str:
    return SOURCE_LABELS.get(source, source.replace("_", " ").title())


def format_metric(engagement: dict, relevance) -> str:
    parts = []
    for key, value in (engagement or {}).items():
        if isinstance(value, (int, float)) and value:
            parts.append(f"{value} {key}")
    if parts:
        return ", ".join(parts)
    return f"relevance {relevance}" if relevance is not None else "no engagement reported"


def run_engine(topic: str) -> dict:
    engine = resolve_engine_path()
    if not os.path.isfile(engine):
        raise RuntimeError(f"last30days engine not found at {engine}")

    env = dict(os.environ)
    env["LAST30DAYS_ALLOW_ENGINE_PLAN"] = "1"

    proc = subprocess.run(
        [sys.executable, engine, topic, "--emit=json", "--quick"],
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
        timeout=ENGINE_TIMEOUT_SECONDS,
        env=env,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-500:]
        raise RuntimeError(f"engine exited {proc.returncode}: {tail}")

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"engine output was not JSON: {exc}") from exc


def run_discovery(inputs: dict) -> dict:
    topic = (inputs.get("topic") or DEFAULT_TOPIC).strip()
    engine_out = run_engine(topic)

    results = sorted(
        engine_out.get("results") or [],
        key=lambda r: r.get("relevance_score") or 0,
        reverse=True,
    )[:MAX_SIGNALS]

    scored_signals = [
        {
            "platform": label_for(r.get("source", "")),
            "title": r.get("title") or r.get("summary") or "(untitled)",
            "metric": format_metric(r.get("engagement"), r.get("relevance_score")),
            "url": r.get("url") or "",
        }
        for r in results
    ]

    source_status = engine_out.get("source_status") or {}
    sources_checked = [label_for(src) for src, status in source_status.items() if status == "ok"]

    if scored_signals:
        top_titles = "; ".join(s["title"] for s in scored_signals[:3])
        summary = f"Top {len(scored_signals)} results for {topic}: {top_titles}."
    else:
        summary = f"No results found for {topic} in the last {engine_out.get('window_days', 30)} days."

    return {
        "topic": topic,
        "summary": summary,
        "scoredSignals": scored_signals,
        "sourcesChecked": sources_checked,
        "sourceStatus": source_status,
        "windowDays": engine_out.get("window_days"),
        "generatedAt": engine_out.get("generated_at"),
    }


def parse_inputs(argv: list, stdin_is_tty: bool, stdin_text: str) -> dict:
    if len(argv) > 1 and argv[1].strip():
        try:
            return json.loads(argv[1])
        except json.JSONDecodeError:
            return {"topic": argv[1]}
    if not stdin_is_tty and stdin_text.strip():
        return json.loads(stdin_text)
    return {"topic": DEFAULT_TOPIC}


def main() -> int:
    stdin_is_tty = sys.stdin.isatty()
    stdin_text = "" if stdin_is_tty else sys.stdin.read()
    try:
        inputs = parse_inputs(sys.argv, stdin_is_tty, stdin_text)
        result = run_discovery(inputs)
    except Exception as exc:  # noqa: BLE001 - surfaced to the pipeline as a failed stage
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
