# Claude API cost: prompt caching and batch checklist

Status: working draft. Supersedes the DCO-BIP spitball (Deterministic Cache Optimization
and Batch Ingestion Pipeline). The padding engine in that draft is dropped: its trigger
window is narrow, its payoff is cents per batch, and it depends on an in-batch cache-hit
rate that the API treats as best-effort, not guaranteed.

## What actually reduces cost

Prompt caching and the Message Batches API are the two levers. They stack: a batch request
that hits cache pays 50% of the base rate on top of the ~90% cache-read discount.

### Caching rules

1. Render order is `tools`, then `system`, then `messages`. Put frozen content first, place
   one `cache_control: {"type": "ephemeral"}` breakpoint after it, and keep volatile content
   (per-item question, request IDs, timestamps) after that breakpoint.
2. Keep the system prompt 100% static. Move every dynamic argument into the `messages` array.
   Never put `datetime.now()`, a UUID, an unsorted `json.dumps()`, or a varying tool set in
   the cached prefix. Any byte change in the prefix invalidates everything after it.
3. Verify with `usage.cache_read_input_tokens`. If it stays zero across repeated
   same-prefix requests, a silent invalidator is in the prefix.
4. Cache write costs ~1.25x the base input rate at the default 5-minute TTL, ~2x at the
   1-hour TTL. Cache read costs ~0.1x. The minimum cacheable prefix is model-dependent
   (roughly 512-4096 tokens); a shorter prefix silently will not cache.

### Sub-threshold prefixes

If the static prefix does not clear the model minimum, do one of:

- Fold real static content into the prefix (system instructions, few-shot examples, output
  schema, tool definitions) so it clears the threshold with tokens that earn their place.
- Accept no caching. At the batch rate, the uncached cost of a small prefix across
  thousands of items is already cents. Do not synthesize filler to cross the line.

### Batch rules

1. Use the Batches API for any workload that is not latency-sensitive. Flat 50% off all
   rates, 24-hour SLA.
2. Assert every `custom_id` matches `^[a-zA-Z0-9_-]{1,64}$` and is unique before dispatch.
3. Results arrive in any order. Key them by `custom_id`, never by position.
4. Treat in-batch cache reuse as opportunistic. Batch items can dispatch in parallel before
   the first cache write lands, which produces extra `cache_creation` charges or plain
   misses. Do not build accounting that asserts "one write plus N-1 reads".

### Prefix stability audit

Run this before enabling caching. Every item must be false for the prefix, or the cache
silently invalidates on the next request.

- No timestamps or dates rendered into the prefix.
- No UUIDs, request IDs, or trace IDs.
- No nondeterministic JSON: sort keys, fix separators, pin float formatting.
- No dynamic or reordered tool list. Freeze the tool array and its order.
- No environment-dependent strings (hostname, region, `os.environ` values, cwd).
- No whitespace drift: stable indentation, stable trailing newline, no reflowed text.
- No version drift: the system prompt string is checked in and changes only on a
  deliberate bump, not per deploy.

### Cache TTL selection

Default to the 5-minute TTL (~1.25x write cost). Move to the 1-hour TTL (~2x write cost)
only when at least one holds:

- The batch exceeds 10k items.
- The cached prefix exceeds 4k tokens.
- The workload spans more than 5 minutes of wall-clock time between reuse of the same prefix.

Below those, the 1-hour TTL's extra write cost is not recovered.

### Batch size guidance

- Fewer than 10 items: skip the Batches API. Per-request latency and setup outweigh the
  50% discount.
- 10 to 500 items: batch.
- More than 500 items: batch plus prefix caching.
- 10k items or more: batch plus prefix caching plus staggered dispatch (submit in chunks,
  or space submissions) to avoid rate-limit spikes on ingestion.

### Cache validation step

After the first real request against a new prefix:

1. Read `usage.cache_read_input_tokens` (second request onward) and
   `usage.cache_creation_input_tokens` (first request).
2. If `cache_read_input_tokens` stays zero across repeated same-prefix requests, the prefix
   is being invalidated.
3. Dump the exact serialized prefix from two consecutive requests, diff them, and fix the
   drift. Re-run the prefix stability audit above.

## Reference helpers

Current models and first-party rates (per MTok, input / output):

| Model | ID | Input | Output |
|---|---|---|---|
| Opus 5 | `claude-opus-5` | $5.00 | $25.00 |
| Sonnet 5 | `claude-sonnet-5` | $2.00 | $10.00 |
| Haiku 4.5 | `claude-haiku-4-5` | $1.00 | $5.00 |

`count_tokens` is GA; call `client.messages.count_tokens` with no beta header.

```python
"""
Preflight token check and batch dispatcher for Claude cost-optimized ingestion.
No padding, no ROI gate. Reports whether the assembled prefix will cache, then
dispatches and reconciles the batch.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming

CUSTOM_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

# Model minimum cacheable prefix, in tokens. Confirm against current docs before relying on it.
MIN_CACHE_PREFIX = {
    "claude-opus-5": 1024,
    "claude-sonnet-5": 1024,
    "claude-haiku-4-5": 2048,
}


class SchemaValidationError(Exception):
    """Raised when batch records violate protocol constraints."""


@dataclass(frozen=True)
class PrefixReport:
    prefix_tokens_upper_bound: int
    model_minimum: int
    clears_minimum: bool


def check_prefix_caching(
    client: anthropic.Anthropic,
    model: str,
    system_prompt: str,
    tools: list[dict[str, Any]] | None = None,
) -> PrefixReport:
    """Estimate the cacheable prefix and report whether it clears the cache minimum.

    `count_tokens` requires a non-empty `messages` array, so the count includes a
    one-character user turn plus per-message framing (~3-4 tokens). The returned figure
    therefore over-estimates the true prefix. Treat `clears_minimum` as reliable only
    when the prefix clears the threshold with margin; a near-threshold prefix needs a
    live check against `usage.cache_read_input_tokens` on a real request.
    """
    count = client.messages.count_tokens(
        model=model,
        system=system_prompt,
        tools=tools or [],
        messages=[{"role": "user", "content": "x"}],
    )
    upper_bound = count.input_tokens
    minimum = MIN_CACHE_PREFIX.get(model, 1024)
    return PrefixReport(
        prefix_tokens_upper_bound=upper_bound,
        model_minimum=minimum,
        clears_minimum=upper_bound >= minimum,
    )


def dispatch_batch(
    client: anthropic.Anthropic,
    model: str,
    system_prompt: str,
    records: list[dict[str, str]],
    *,
    cache: bool,
    max_output_tokens: int = 512,
) -> str:
    """Validate custom_ids, build the batch, dispatch. Caches the system prefix when `cache` is True."""
    if not records:
        raise SchemaValidationError("Batch payload cannot be empty.")

    seen: set[str] = set()
    for item in records:
        cid = item.get("custom_id", "")
        if not CUSTOM_ID_REGEX.match(cid):
            raise SchemaValidationError(f"Invalid custom_id: {cid!r}")
        if cid in seen:
            raise SchemaValidationError(f"Duplicate custom_id: {cid!r}")
        seen.add(cid)

    if cache:
        system_blocks: Any = [
            {"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}
        ]
    else:
        system_blocks = system_prompt

    requests = [
        {
            "custom_id": r["custom_id"],
            "params": MessageCreateParamsNonStreaming(
                model=model,
                max_tokens=max_output_tokens,
                system=system_blocks,
                messages=[{"role": "user", "content": r["content"]}],
            ),
        }
        for r in records
    ]

    batch = client.messages.batches.create(requests=requests)
    return batch.id


def _cache_creation_tokens(usage: Any) -> int:
    """Flat field on older SDKs; a breakdown object on newer ones. Handle both."""
    flat = getattr(usage, "cache_creation_input_tokens", None)
    if flat is not None:
        return flat
    breakdown = getattr(usage, "cache_creation", None)
    if breakdown is None:
        return 0
    return sum(
        getattr(breakdown, f, 0) or 0
        for f in ("ephemeral_5m_input_tokens", "ephemeral_1h_input_tokens")
    )


def poll_and_reconcile(
    client: anthropic.Anthropic,
    batch_id: str,
    poll_interval_seconds: int = 15,
    max_wait_seconds: int = 26 * 3600,
) -> dict[str, Any]:
    """Poll to terminal status, then total the token accounting across all results.

    Raises TimeoutError if the batch has not reached `ended` within `max_wait_seconds`
    (default just past the 24-hour SLA).
    """
    deadline = time.monotonic() + max_wait_seconds
    while True:
        job = client.messages.batches.retrieve(batch_id)
        if job.processing_status == "ended":
            break
        if time.monotonic() >= deadline:
            raise TimeoutError(f"batch {batch_id} still {job.processing_status} after {max_wait_seconds}s")
        time.sleep(poll_interval_seconds)

    # A batch that ended with nothing processed has no results_url; results() would raise.
    counts = job.request_counts
    if (counts.succeeded + counts.errored + counts.canceled + counts.expired) == 0:
        return {
            "batch_id": batch_id, "succeeded": 0, "failures": {},
            "input_tokens": 0, "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0, "output_tokens": 0,
        }

    input_tokens = cache_writes = cache_reads = output_tokens = 0
    succeeded = 0
    failures: dict[str, int] = {}
    for item in client.messages.batches.results(batch_id):
        result_type = item.result.type
        if result_type == "succeeded":
            succeeded += 1
            usage = item.result.message.usage
            input_tokens += usage.input_tokens or 0
            cache_writes += _cache_creation_tokens(usage)
            cache_reads += getattr(usage, "cache_read_input_tokens", 0) or 0
            output_tokens += usage.output_tokens
        else:
            failures[result_type] = failures.get(result_type, 0) + 1

    return {
        "batch_id": batch_id,
        "succeeded": succeeded,
        "failures": failures,  # e.g. {"errored": 3, "expired": 1}
        "input_tokens": input_tokens,
        "cache_creation_input_tokens": cache_writes,
        "cache_read_input_tokens": cache_reads,
        "output_tokens": output_tokens,
    }
```

## What was cut from DCO-BIP and why

| Cut | Reason |
|---|---|
| Economic Heuristic Gate | Elaborate math to recover cents; trigger needs prefix 775-1024 tokens and batch >= 25. |
| Deterministic Padding Engine | Pays cache write (1.25x) plus N-1 cache reads (0.1x) on zero-entropy filler the model still processes. Marginal even in the ideal case. |
| `PADDED_CACHE` strategy and its state-machine branch | Follows from the two cuts above. |
| Reconciler assertion `cache_read == target * (N-1)` | In-batch cache hits are best-effort; this assertion fails in normal operation. |
| Claude 3.5 / 3 Opus model registry and pricing | Legacy generation. Replaced with Opus 5 / Sonnet 5 / Haiku 4.5. |
| `input_tokens - 2` isolation hack | Guessed message-wrapper cost. Replaced with a stated estimate on the real assembled request. |
| `client.beta.messages.count_tokens` | `count_tokens` is GA. |
| Terminal-state list `["ended", "canceled", "expired"]` | Real terminal status is `ended`; per-request `canceled` / `expired` / `errored` live in `request_counts`. |
