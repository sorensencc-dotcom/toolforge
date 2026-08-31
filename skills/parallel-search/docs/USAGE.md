# Usage

Set `PARALLEL_API_KEY` in the runtime environment. Call `parallel_search` with one objective and 2–3 keyword queries. Call `parallel_extract` with 1–20 public HTTP(S) URLs. Call `parallel_task` with an input and processor such as `base`; it returns a queued Task Run and does not wait for completion.

Errors use stable codes: `API_KEY_MISSING`, `INVALID_INPUT`, `INVALID_API_RESPONSE`, and `PARALLEL_API_ERROR`. Error messages never include credentials or provider exception text.
