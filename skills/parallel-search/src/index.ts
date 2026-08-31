import Parallel from "parallel-web";

export type ErrorCode = "API_KEY_MISSING" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "PARALLEL_API_ERROR";
export type ToolError = { ok: false; error: { code: ErrorCode; message: string } };
export type OperationResult<T> = { ok: true; data: T } | ToolError;
export type SearchInput = { objective: string; search_queries: string[] };
export type ExtractInput = { urls: string[]; objective?: string };
export type TaskInput = { input: string | Record<string, unknown>; processor: string };
export type SearchOutput = Record<string, unknown>;
export type ExtractOutput = Record<string, unknown>;
export type TaskOutput = { run_id: string; interaction_id: string; status: string; is_active: boolean; processor: string };
type Client = { search(input: SearchInput): Promise<unknown>; extract(input: ExtractInput): Promise<unknown>; taskRun: { create(input: TaskInput): Promise<unknown> } };
export type RuntimeOptions = { apiKey?: string; clientFactory?: (key: string) => Client };

const error = (code: ErrorCode, message: string): ToolError => ({ ok: false, error: { code, message } });
const keyFor = (options?: RuntimeOptions) => options?.apiKey?.trim() || process.env.PARALLEL_API_KEY?.trim();
function clientFor(options?: RuntimeOptions): Client | ToolError { const key = keyFor(options); if (!key) return error("API_KEY_MISSING", "PARALLEL_API_KEY is required"); return options?.clientFactory?.(key) ?? new Parallel({ apiKey: key }) as unknown as Client; }
function validText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function validUrl(value: unknown): value is string { try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol); } catch { return false; } }
function responseObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
async function call<T>(options: RuntimeOptions | undefined, fn: (client: Client) => Promise<unknown>, check: (value: unknown) => value is T): Promise<OperationResult<T>> { const client = clientFor(options); if (!("search" in client)) return client; try { const value = await fn(client); return check(value) ? { ok: true, data: value } : error("INVALID_API_RESPONSE", "Parallel returned an invalid response"); } catch { return error("PARALLEL_API_ERROR", "Parallel request failed"); } }

export const parallel_search = (input: SearchInput, options?: RuntimeOptions): Promise<OperationResult<SearchOutput>> => {
  if (!responseObject(input) || !validText(input.objective) || !Array.isArray(input.search_queries) || input.search_queries.length < 2 || input.search_queries.length > 3 || !input.search_queries.every(validText)) return Promise.resolve(error("INVALID_INPUT", "objective and 2–3 search_queries are required"));
  return call(options, client => client.search({ objective: input.objective.trim(), search_queries: input.search_queries.map(q => q.trim()) }), responseObject);
};
export const parallel_extract = (input: ExtractInput, options?: RuntimeOptions): Promise<OperationResult<ExtractOutput>> => {
  if (!responseObject(input) || !Array.isArray(input.urls) || input.urls.length < 1 || input.urls.length > 20 || !input.urls.every(validUrl) || (input.objective !== undefined && !validText(input.objective))) return Promise.resolve(error("INVALID_INPUT", "1–20 valid http(s) urls are required"));
  return call(options, client => client.extract({ urls: input.urls, ...(input.objective ? { objective: input.objective.trim() } : {}) }), responseObject);
};
export const parallel_task = (input: TaskInput, options?: RuntimeOptions): Promise<OperationResult<TaskOutput>> => {
  if (!responseObject(input) || (!validText(input.input) && !responseObject(input.input)) || !validText(input.processor)) return Promise.resolve(error("INVALID_INPUT", "input and processor are required"));
  const isTaskOutput = (value: unknown): value is TaskOutput => responseObject(value) && validText(value.run_id) && validText(value.interaction_id) && validText(value.status) && typeof value.is_active === "boolean" && validText(value.processor);
  return call(options, client => client.taskRun.create({ input: input.input, processor: input.processor.trim() }), isTaskOutput);
};
