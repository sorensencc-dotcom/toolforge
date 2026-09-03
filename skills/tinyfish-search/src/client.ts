import { TinyFish } from "@tiny-fish/sdk";
import type { RuntimeOptions, TinyFishClient, ToolError } from "./types.js";

export const ERR_MSG_API_KEY_MISSING = "TINYFISH_API_KEY is required";

export function getClient(options?: RuntimeOptions): TinyFishClient | ToolError {
  const apiKey = options?.apiKey?.trim() || process.env.TINYFISH_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: "API_KEY_MISSING",
        message: ERR_MSG_API_KEY_MISSING,
      },
    };
  }
  return options?.clientFactory?.(apiKey) ?? new TinyFish({ apiKey });
}
