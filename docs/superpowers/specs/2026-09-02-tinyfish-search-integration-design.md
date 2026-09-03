# TinyFish search integration — design specification (v1.0)

- Status: approved by user during brainstorming session 2026-09-02.
- Author: Antigravity.
- Date: 2026-09-02.
- Repository: `toolforge` (`git@github.com:sorensencc-dotcom/toolforge.git`).
- Skill: `skills/tinyfish-search/`.
- Related: `docs/meta/skill-operator-guide.md`, `skills/parallel-search/SKILL.md`.

## Overview

`skills/tinyfish-search/` provides fail-closed TypeScript wrappers around TinyFish AI search and fetch APIs (`@tiny-fish/sdk` npm package). TinyFish provides free-tier search and web extraction with high-speed response times and clean Markdown extraction. This specification locks the API contract, establishes fail-closed error handling, defines rate limiting with jittered exponential backoff, and specifies offline testability via client injection.

The integration executes across two distinct phases:
1. **Phase 1 (this specification):** Standalone Toolforge skill in `skills/tinyfish-search/`, with parity to `parallel-search`, full offline test suites, and `manifest.json` registration.
2. **Phase 2 (future consumer):** TRM (Topic Research Mining) and `trm-devops` automated CI error-resolution loop that feeds error traces into TinyFish search and drafts patch proposals.

## Goals

1. Expose a small, stable, fail-closed API surface (`{ ok: true, data } | { ok: false, error }`) over TinyFish Search and Extract.
2. Maintain drop-in interface compatibility with `parallel-search` input and output shapes to minimize integration overhead for agent callers.
3. Validate all inputs before triggering any network transport.
4. Enforce strict provider hygiene: never include upstream TinyFish error messages verbatim; sanitize all error strings and collapse exceptions into opaque, standardized error codes.
5. Never leak provider credentials, sensitive request headers, or raw provider exception text through error returns.
6. Enforce hard timeout semantics: all network operations must enforce a strict 10-second ceiling and fail closed with `TINYFISH_API_ERROR` upon expiration.
7. Provide local rate-limiting via an in-memory token bucket adhering to TinyFish free-tier ceilings (30 searches/min, 150 fetches/min).
8. Provide automatic 3-attempt exponential backoff with randomized jitter on HTTP 429 status codes.
9. Guarantee 100% offline, deterministic unit test coverage through a client factory injection pattern (`clientFactory?: (key: string) => TinyFishClient`).
10. Comply with Toolforge skill documentation standards (`README.md` under 100 lines, `SKILL.md` under 150 lines, and complete `docs/USAGE.md`).

## Non-goals and future-proofing

1. Complex browser automation, authenticated multi-step flows, or agent actions provided by the metered TinyFish Agent API.
2. Persistent distributed state storage or Redis-backed rate limiting across multiple machines.
3. Immediate wiring into TRM CI log triage pipelines (scheduled for Phase 2).
4. Modification or deprecation of the existing `parallel-search` skill.
5. Future-proofing: TinyFish may introduce batch search, batch extract, and richer metadata fields in subsequent SDK releases. Version 1.0 intentionally ignores these extended surfaces until they stabilize in upstream documentation.

## SDK and transport contract

The implementation targets `@tiny-fish/sdk` (version `^0.5.0`) with Node.js `>=24.0.0`.

### Client initialization

```typescript
import { TinyFish } from "@tiny-fish/sdk";

type TinyFishClient = Pick<TinyFish, "search" | "fetch">;

function getClient(options?: RuntimeOptions): TinyFishClient | ToolError {
  const apiKey = options?.apiKey?.trim() || process.env.TINYFISH_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: "API_KEY_MISSING",
        message: "TINYFISH_API_KEY is required",
      },
    };
  }
  return options?.clientFactory?.(apiKey) ?? new TinyFish({ apiKey });
}
```

### Search operation

- Invocation: `client.search.query({ query: string })`.
- Adapter normalization: accepts Toolforge `SearchInput` (`objective?: string`, `search_queries?: string[]`) and resolves the primary query string.
- Response normalization: maps upstream results to standard `SearchOutput`:
  ```typescript
  {
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      score?: number;
    }>;
  }
  ```

### Extract operation

- Invocation: `client.fetch.getContents({ urls: string[] })`.
- Adapter normalization: accepts Toolforge `ExtractInput` (`urls: string[]`, `objective?: string`).
- Response normalization: maps upstream clean Markdown payloads to standard `ExtractOutput`:
  ```typescript
  {
    results: Array<{
      url: string;
      title?: string;
      markdown: string;
      status: number;
    }>;
    errors: Array<{
      url: string;
      error: string;
    }>;
  }
  ```

## Public API surface

All primary functions export from `skills/tinyfish-search/src/index.ts` and return `Promise<OperationResult<T>>`.

### Type definitions

```typescript
export type ErrorCode =
  | "API_KEY_MISSING"
  | "INVALID_INPUT"
  | "INVALID_API_RESPONSE"
  | "RATE_LIMITED"
  | "TINYFISH_API_ERROR";

export type ToolError = {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    retry_after_ms?: number;
  };
};

export type OperationResult<T> = { ok: true; data: T } | ToolError;

export type SearchInput = {
  objective?: string;
  search_queries?: string[];
};

export type ExtractInput = {
  urls: string[];
  objective?: string;
};

export type RuntimeOptions = {
  apiKey?: string;
  clientFactory?: (key: string) => TinyFishClient;
  onError?: (err: unknown) => void;
};
```

### Exported functions

```typescript
export function tinyfish_search(
  input: SearchInput,
  options?: RuntimeOptions,
): Promise<OperationResult<SearchOutput>>;

export function tinyfish_extract(
  input: ExtractInput,
  options?: RuntimeOptions,
): Promise<OperationResult<ExtractOutput>>;
```

## Rate limiting and resilience

To prevent dropping requests during bursts and respect TinyFish free-tier quotas:
1. **Token bucket limiter:**
   - Search: maximum capacity 30 tokens, replenishment rate 0.5 tokens/sec (1 every 2 seconds).
   - Fetch: maximum capacity 150 tokens, replenishment rate 2.5 tokens/sec (1 every 400 milliseconds).
2. **Process isolation constraint:**
   - The token bucket limiter operates entirely in-memory and is scoped to the active Node.js process.
   - Independent CLI invocations, background daemons, or separate subagent processes do not share bucket state. Operators running concurrent worker pipelines must throttle dispatch cadence to prevent exceeding upstream quotas.
3. **HTTP 429 retry policy:**
   - Maximum retries: 3 attempts.
   - Base delay: 1000 milliseconds.
   - Formula: `delay = (base * (2 ** attempt)) + Math.floor(Math.random() * 250)`.
   - On exhaustion of all 3 retries, return `{ ok: false, error: { code: "RATE_LIMITED", message: "Rate limit exceeded after retries" } }`.

## Provider hygiene and timeout semantics

1. **Provider hygiene:**
   - Never include upstream TinyFish error messages or stack traces verbatim in returned results; sanitize all strings.
   - Any raw provider error or unexpected exception must be collapsed into an opaque, sanitized message (e.g., `"TinyFish request failed"` or `"TinyFish returned an invalid response"`).
   - Raw exceptions and error objects may only pass to the optional `options.onError` debug handler and never escape the wrapper boundary.
2. **Timeout semantics:**
   - TinyFish free-tier endpoints occasionally encounter transient latency spikes.
   - **Per-attempt timeout:** All network requests enforce a strict 10-second ceiling per HTTP attempt (`AbortSignal.timeout(10_000)`).
   - **Cumulative timeout:** The overall operation across all retry attempts and backoff delays is capped by a 45-second deadline.
   - If an individual attempt or the cumulative operation exceeds its deadline, the call immediately aborts and returns:
     ```typescript
     {
       ok: false,
       error: {
         code: "TINYFISH_API_ERROR",
         message: "TinyFish request timed out after 10000ms"
       }
     }
     ```

## Testing strategy

All tests run locally and offline via Node.js native test runner (`node:test` and `node:assert/strict`).

1. **`tests/search.test.ts`:**
   - Rejection when `TINYFISH_API_KEY` is missing.
   - Rejection when both `objective` and `search_queries` are missing or empty.
   - Successful parsing and normalization of search results using mock `clientFactory`.
2. **`tests/extract.test.ts`:**
   - Rejection on invalid or empty URL lists.
   - Handling of partial failures (valid URLs in `results`, invalid in `errors`).
   - Clean Markdown payload preservation.
3. **`tests/limiter.test.ts`:**
   - Verification that requests wait when token buckets deplete.
   - Verification of 3-attempt exponential backoff behavior on mock 429 responses.
   - Verification of fail-closed error return when backoff limit expires.

## Manifest registration

Register the skill in `manifest.json` under `skills`:

```json
{
  "id": "tinyfish-search",
  "name": "tinyfish-search",
  "category": "sync-tools",
  "description": "TinyFish AI high-speed search and clean Markdown fetch integration",
  "entrypoint": "skills/tinyfish-search/dist/index.js",
  "status": "active",
  "version": "1.0.0",
  "capabilities": ["web_search", "structured_extract", "clean_markdown_fetch"],
  "requires_api_key": "TINYFISH_API_KEY"
}
```

## Documentation compliance

The skill will follow `docs/meta/skill-operator-guide.md`:
- `skills/tinyfish-search/README.md`: Under 100 lines, containing project overview, features, and quickstart.
- `skills/tinyfish-search/SKILL.md`: Under 150 lines, containing frontmatter, triggers, and I/O references.
- `skills/tinyfish-search/docs/USAGE.md`: Detailed operational guide covering configuration, rate limits, and failure handling.
