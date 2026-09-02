import Parallel from "parallel-web";

export type ErrorCode = "API_KEY_MISSING" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "PARALLEL_API_ERROR";
export type ToolError = { ok: false; error: { code: ErrorCode; message: string } };
export type OperationResult<T> = { ok: true; data: T } | ToolError;
export type SearchInput = { objective?: string; search_queries?: string[]; mode?: "one-shot" | "agentic" | "fast" };
export type ExtractInput = { urls: string[]; objective?: string };
export type TaskInput = { input: string | Record<string, unknown>; processor: string };
export type SearchOutput = Record<string, unknown>;
export type ExtractOutput = Record<string, unknown>;
export type TaskOutput = { run_id: string; interaction_id: string; status: string; is_active: boolean; processor: string };
type Client = Pick<Parallel, "beta" | "taskRun">;
export type RuntimeOptions = { apiKey?: string; clientFactory?: (key: string) => Client; onError?: (err: unknown) => void };

const error = (code: ErrorCode, message: string): ToolError => ({ ok: false, error: { code, message } });
function reportError(options: RuntimeOptions | undefined, err: unknown, result: ToolError = error("PARALLEL_API_ERROR", "Parallel request failed")): ToolError { try { options?.onError?.(err); } catch { /* a throwing logger must not break the never-throw contract */ } if (process.env.PARALLEL_DEBUG) console.error(err); return result; }
const keyFor = (options?: RuntimeOptions) => options?.apiKey?.trim() || process.env.PARALLEL_API_KEY?.trim();
function clientFor(options?: RuntimeOptions): Client | ToolError { const key = keyFor(options); if (!key) return error("API_KEY_MISSING", "PARALLEL_API_KEY is required"); return options?.clientFactory?.(key) ?? new Parallel({ apiKey: key }); }
function validText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validUrl(value: unknown): value is string { try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol); } catch { return false; } }
function responseObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function isSearchOutput(value: unknown): value is SearchOutput { return responseObject(value) && Array.isArray(value.results); }
function isExtractOutput(value: unknown): value is ExtractOutput { return responseObject(value) && Array.isArray(value.results) && Array.isArray(value.errors); }
function isTaskOutput(value: unknown): value is TaskOutput { return responseObject(value) && validText(value.run_id) && validText(value.interaction_id) && validText(value.status) && typeof value.is_active === "boolean" && validText(value.processor); }
async function call<T>(options: RuntimeOptions | undefined, fn: (client: Client) => Promise<unknown>, check: (value: unknown) => value is T): Promise<OperationResult<T>> { let client: Client | ToolError; try { client = clientFor(options); } catch (err) { return reportError(options, err); } if (!("beta" in client)) return client; try { const value = await fn(client); if (check(value)) return { ok: true, data: value }; return reportError(options, value, error("INVALID_API_RESPONSE", "Parallel returned an invalid response")); } catch (err) { return reportError(options, err); } }

function defineOperation<TInput, TOutput>(
  validate: (input: TInput) => ToolError | undefined,
  networkFn: (client: Client, input: TInput) => Promise<unknown>,
  responseGuard: (value: unknown) => value is TOutput,
): (input: TInput, options?: RuntimeOptions) => Promise<OperationResult<TOutput>> {
  return (input, options) => {
    const invalid = validate(input);
    if (invalid) return Promise.resolve(invalid);
    return call(options, client => networkFn(client, input), responseGuard);
  };
}

export const parallel_search: (input: SearchInput, options?: RuntimeOptions) => Promise<OperationResult<SearchOutput>> =
  defineOperation<SearchInput, SearchOutput>(
    input => {
      const hasObjective = validText(input?.objective);
      const hasQueries = Array.isArray(input?.search_queries) && input.search_queries.length > 0 && input.search_queries.every(validText);
      if (!responseObject(input) || (!hasObjective && !hasQueries)) return error("INVALID_INPUT", "objective or search_queries is required");
      return undefined;
    },
    (client, input) => {
      const hasObjective = validText(input?.objective);
      const hasQueries = Array.isArray(input?.search_queries) && input.search_queries.length > 0 && input.search_queries.every(validText);
      return client.beta.search({ ...(hasObjective ? { objective: input.objective!.trim() } : {}), ...(hasQueries ? { search_queries: input.search_queries!.map(q => q.trim()) } : {}), mode: input.mode ?? "agentic" });
    },
    isSearchOutput,
  );
export const parallel_extract: (input: ExtractInput, options?: RuntimeOptions) => Promise<OperationResult<ExtractOutput>> =
  defineOperation<ExtractInput, ExtractOutput>(
    input => {
      if (!responseObject(input) || !Array.isArray(input.urls) || input.urls.length < 1 || input.urls.length > 20 || !input.urls.every(validUrl) || (input.objective !== undefined && !validText(input.objective))) return error("INVALID_INPUT", "1–20 valid http(s) urls are required");
      return undefined;
    },
    (client, input) => client.beta.extract({ urls: input.urls, ...(input.objective ? { objective: input.objective.trim() } : {}), betas: ["search-extract-2025-10-10"] }),
    isExtractOutput,
  );
export const parallel_task: (input: TaskInput, options?: RuntimeOptions) => Promise<OperationResult<TaskOutput>> =
  defineOperation<TaskInput, TaskOutput>(
    input => {
      if (!responseObject(input) || (!validText(input.input) && !responseObject(input.input)) || !validText(input.processor)) return error("INVALID_INPUT", "input and processor are required");
      return undefined;
    },
    (client, input) => client.taskRun.create({ input: input.input, processor: input.processor.trim() }),
    isTaskOutput,
  );
