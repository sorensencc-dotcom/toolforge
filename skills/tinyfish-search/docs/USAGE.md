# TinyFish Search usage and operator guide

## Overview
`skills/tinyfish-search` wraps TinyFish AI's high-speed search and clean Markdown extraction endpoints.

## Configuration and authentication
To configure the API key via environment variables, set:
```bash
export TINYFISH_API_KEY="your-api-key"
```
To pass the key per-request, specify `apiKey` in `RuntimeOptions`:
```typescript
const result = await tinyfish_search({ objective: "test" }, { apiKey: process.env.TINYFISH_API_KEY });
```

## Rate limits and concurrency
- **Search:** 30 requests / minute (token bucket refill rate: 0.5/sec).
- **Extract:** 150 requests / minute (token bucket refill rate: 2.5/sec).
- Rate limits are process-isolated. Concurrent independent processes must budget their dispatch volume.

## Timeouts and retries
- Each HTTP attempt enforces a 10-second timeout ceiling (`AbortSignal.timeout(10_000)`).
- HTTP 429 errors trigger up to 3 retries with exponential backoff and randomized jitter.
- The cumulative execution duration across all attempts is capped at 45 seconds.

## Error codes
- `API_KEY_MISSING`: API key is absent.
- `INVALID_INPUT`: Inputs failed validation.
- `INVALID_API_RESPONSE`: TinyFish returned malformed response.
- `RATE_LIMITED`: Rate limit was exceeded after all retries.
- `TINYFISH_API_ERROR`: Network or transport failure occurred.
