import Parallel from "parallel-web";

export type ErrorCode = "API_KEY_MISSING" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "PARALLEL_API_ERROR";
export type ToolError = { ok: false; error: { code: ErrorCode; message: string; run_id?: string } };
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

export const TASK_RESULT_TIMEOUT_DEFAULT = 300;
export const TASK_RESULT_TIMEOUT_MAX = 600;

type TaskResultWait = { status: string; output: { type: "text" | "json"; content: string | Record<string, unknown>; basis: unknown[] } };
type TaskResultOutput = TaskOutput | TaskResultWait;

function isTaskResultWait(value: unknown): value is { run: { status: string }; output: { type: "text" | "json"; content: string | Record<string, unknown>; basis: unknown[] } } {
  if (!responseObject(value) || !responseObject(value.output) || !responseObject(value.run)) return false;
  const output = value.output;
  if (output.type !== "text" && output.type !== "json") return false;
  if (output.content == null || !Array.isArray(output.basis)) return false;
  return typeof value.run.status === "string";
}

// Async task lifecycle:
//   parallel_task(create)              -> { run_id, status: 'queued', is_active: true }
//   parallel_task_result(wait:false)   -> { status: 'running' | 'queued' | 'completed' | ... }   (non-blocking poll)
//   parallel_task_result(wait:true)    -> { status: 'completed', output: { type, content, basis } }
//                                         delegates blocking to client.taskRun.result(timeout seconds)
//   timeout before settle              -> { ok:false, error:{ code:'PARALLEL_API_ERROR', run_id } }   // run NOT orphaned
//   terminal 'failed'/'cancelled'/'action_required' come back as data (ok:true), never as errors
export const parallel_task_result = async (
  input: { run_id: string; wait?: boolean; timeout_seconds?: number },
  options?: RuntimeOptions,
): Promise<OperationResult<TaskResultOutput>> => {
  const timeout = input?.timeout_seconds;
  if (
    !responseObject(input) ||
    !validText(input.run_id) ||
    (timeout !== undefined && (typeof timeout !== "number" || !(timeout > 0) || timeout > TASK_RESULT_TIMEOUT_MAX))
  ) {
    return error("INVALID_INPUT", "run_id and timeout_seconds must be valid");
  }

  let client: Client | ToolError;
  try { client = clientFor(options); } catch (err) { return reportError(options, err); }
  if (!("beta" in client)) return client;

  if (input.wait === true) {
    try {
      const value = await client.taskRun.result(input.run_id, { timeout: timeout ?? TASK_RESULT_TIMEOUT_DEFAULT });
      if (!isTaskResultWait(value)) return error("INVALID_API_RESPONSE", "Parallel returned an invalid response");
      return { ok: true, data: { status: value.run.status, output: { type: value.output.type, content: value.output.content, basis: value.output.basis } } };
    } catch (err) {
      try { options?.onError?.(err); } catch { /* a throwing logger must not break the never-throw contract */ }
      if (process.env.PARALLEL_DEBUG) console.error(err);
      if (err instanceof Parallel.APIConnectionTimeoutError) {
        return { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed", run_id: input.run_id } };
      }
      return { ok: false, error: { code: "PARALLEL_API_ERROR", message: "Parallel request failed" } };
    }
  }

  try {
    const value = await client.taskRun.retrieve(input.run_id);
    if (!isTaskOutput(value)) return error("INVALID_API_RESPONSE", "Parallel returned an invalid response");
    return { ok: true, data: { run_id: value.run_id, interaction_id: value.interaction_id, status: value.status, is_active: value.is_active, processor: value.processor } };
  } catch (err) {
    return reportError(options, err);
  }
};
