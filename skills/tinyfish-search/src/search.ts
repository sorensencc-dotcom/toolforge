import { getClient } from "./client.js";
import { searchBucket, withRetry } from "./limiter.js";
import type { OperationResult, RuntimeOptions, SearchInput, SearchOutput } from "./types.js";

export const ERR_MSG_INVALID_INPUT = "objective or search_queries is required";
export const ERR_MSG_INVALID_API_RESPONSE = "TinyFish returned an invalid response";

export async function tinyfish_search(
  input: SearchInput,
  options?: RuntimeOptions,
): Promise<OperationResult<SearchOutput>> {
  const query = input?.objective?.trim() || input?.search_queries?.find((q) => q?.trim()?.length > 0)?.trim();
  if (!query) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: ERR_MSG_INVALID_INPUT,
      },
    };
  }

  const clientOrError = getClient(options);
  if ("ok" in clientOrError) return clientOrError;
  const client = clientOrError;

  await searchBucket.acquire(1);

  return withRetry(async (signal) => {
    try {
      const response: any = await (client.search as any).query({ query }, { signal });
      if (!response || !Array.isArray(response.results)) {
        return {
          ok: false,
          error: {
            code: "INVALID_API_RESPONSE",
            message: ERR_MSG_INVALID_API_RESPONSE,
          },
        };
      }

      const results = response.results.map((r: any) => ({
        title: String(r?.title ?? ""),
        url: String(r?.url ?? ""),
        snippet: String(r?.snippet ?? r?.description ?? ""),
        score: typeof r?.score === "number" ? r.score : undefined,
      }));

      return { ok: true, data: { results } };
    } catch (err) {
      options?.onError?.(err);
      throw err;
    }
  }, { timeoutMs: options?.timeoutMs });
}
