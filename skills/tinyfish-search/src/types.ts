import type { TinyFish } from "@tiny-fish/sdk";

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

export type SearchOutput = {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    score?: number;
  }>;
};

export type ExtractInput = {
  urls: string[];
  objective?: string;
};

export type ExtractOutput = {
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
};

export type TinyFishClient = Pick<TinyFish, "search" | "fetch">;

export type RuntimeOptions = {
  apiKey?: string;
  clientFactory?: (key: string) => TinyFishClient;
  onError?: (err: unknown) => void;
  timeoutMs?: number;
};
