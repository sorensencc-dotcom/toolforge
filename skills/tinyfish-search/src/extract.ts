import { getClient } from "./client.js";
import { extractBucket, withRetry } from "./limiter.js";
import type { ExtractInput, ExtractOutput, OperationResult, RuntimeOptions } from "./types.js";

export const ERR_MSG_INVALID_INPUT = "Valid http(s) URLs are required";
export const ERR_MSG_INVALID_API_RESPONSE = "TinyFish returned an invalid response";
export const ERR_MSG_EXTRACT_FAILED = "Failed to extract";

function isValidUrl(urlStr: unknown): boolean {
  try {
    const parsed = new URL(String(urlStr));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function tinyfish_extract(
  input: ExtractInput,
  options?: RuntimeOptions,
): Promise<OperationResult<ExtractOutput>> {
  if (
    !input ||
    !Array.isArray(input.urls) ||
    input.urls.length === 0 ||
    input.urls.length > 20 ||
    !input.urls.every(isValidUrl)
  ) {
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

  await extractBucket.acquire(1);

  return withRetry(async (signal) => {
    try {
      const response: any = await (client.fetch as any).getContents({ urls: input.urls }, { signal });
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
        url: String(r?.url ?? ""),
        title: r?.title ? String(r.title) : undefined,
        markdown: String(r?.markdown ?? r?.content ?? ""),
        status: typeof r?.status === "number" ? r.status : 200,
      }));

      const errors = Array.isArray(response.errors)
        ? response.errors.map((e: any) => ({
            url: String(e?.url ?? ""),
            error: String(e?.error ?? ERR_MSG_EXTRACT_FAILED),
          }))
        : [];

      return { ok: true, data: { results, errors } };
    } catch (err) {
      options?.onError?.(err);
      throw err;
    }
  }, { timeoutMs: options?.timeoutMs });
}
