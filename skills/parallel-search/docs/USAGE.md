# Usage

Set `PARALLEL_API_KEY` in the runtime environment.

Call `parallel_search` with at least one of `objective` or `search_queries` (any number of queries, no fixed count), plus an optional `mode` of `"one-shot"`, `"agentic"`, or `"fast"`. Call `parallel_extract` with 1–20 public HTTP(S) URLs. Call `parallel_task` with an input and processor such as `core`; it returns a queued Task Run and does not wait for completion.

Call `parallel_task_result({ run_id, wait?, timeout_seconds? })` to read a Task Run. With `wait: false` (the default) it polls status once and returns immediately. With `wait: true` it blocks up to `timeout_seconds` (default 300, max 600), then returns the settled output `{ status, output: { type, content, basis } }`. A timeout returns `PARALLEL_API_ERROR` with `error.run_id` set so the run stays recoverable. Terminal `failed`, `cancelled`, and `action_required` states come back as data, not errors.

Errors use stable codes: `API_KEY_MISSING`, `INVALID_INPUT`, `INVALID_API_RESPONSE`, and `PARALLEL_API_ERROR`. Error messages never include credentials or provider exception text.
