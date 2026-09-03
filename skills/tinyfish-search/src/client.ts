import { TinyFish } from "@tiny-fish/sdk";
import type { RuntimeOptions, TinyFishClient, ToolError } from "./types.js";

export function getClient(options?: RuntimeOptions): TinyFishClient | ToolError {
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
