import { parallel_search, parallel_task, parallel_task_result, type OperationResult, type RuntimeOptions, type SearchOutput } from "./index.js";

export type CharlieResearchRecord = { title: string; url: string; snippet: string };
export type AdapterErrorCode = "FEATURE_DISABLED" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "API_KEY_MISSING" | "PARALLEL_API_ERROR";
export type AdapterResult = { ok: true; data: CharlieResearchRecord[] } | { ok: false; error: { code: AdapterErrorCode; run_id?: string } };
export type AdapterOptions = RuntimeOptions & { enabled?: boolean; taskRun?: boolean; timeoutSeconds?: number };

const isEnabled = (options?: AdapterOptions) => options?.enabled ?? ["1", "true", "yes"].includes(process.env.CHARLIE_PARALLEL_SEARCH_ENABLED?.trim().toLowerCase() ?? "");
const fail = (code: AdapterErrorCode): AdapterResult => ({ ok: false, error: { code } });

// Per-candidate drop/shape rule shared by the Search path and the Task Run path.
// Returns the record, or undefined to drop it.
function toRecord(candidate: unknown): CharlieResearchRecord | undefined {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
  const c = candidate as Record<string, unknown>;
  const title = c.title;
  const url = c.url;
  if (typeof title !== "string" || typeof url !== "string" || !/^https?:\/\//.test(url)) return undefined;
  const excerpts = c.excerpts;
  const snippet = Array.isArray(excerpts) && typeof excerpts[0] === "string" ? excerpts[0] : "";
  return { title, url, snippet };
}

function normalize(value: SearchOutput): CharlieResearchRecord[] | undefined {
  if (!Array.isArray(value.results)) return undefined;
  return value.results.flatMap(item => {
    const record = toRecord(item);
    return record ? [record] : [];
  });
}

// Task Run path: flatten every citations[] across every basis[] entry through toRecord.
// A non-array basis is a structural failure (=> undefined). A single malformed entry
// or a non-array citations list is skipped, never fatal.
function normalizeBasis(basis: unknown): CharlieResearchRecord[] | undefined {
  if (!Array.isArray(basis)) return undefined;
  return basis.flatMap(entry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const citations = (entry as Record<string, unknown>).citations;
    if (!Array.isArray(citations)) return [];
    return citations.flatMap(citation => {
      const record = toRecord(citation);
      return record ? [record] : [];
    });
  });
}

export async function charlieDeepResearchSearch(topic: string, persona: string, options?: AdapterOptions): Promise<AdapterResult> {
  if (!isEnabled(options)) return fail("FEATURE_DISABLED");
  if (typeof topic !== "string" || !topic.trim() || typeof persona !== "string" || !persona.trim()) return fail("INVALID_INPUT");
  const objective = `Research ${topic.trim()} from the perspective of ${persona.trim()}`;
  const useTaskRun = options?.taskRun === true || ["1", "true", "yes"].includes(process.env.CHARLIE_PARALLEL_TASKRUN?.trim().toLowerCase() ?? "");

  if (useTaskRun) {
    const processor = process.env.CHARLIE_PARALLEL_PROCESSOR?.trim() || "core";
    const created = await parallel_task({ input: objective, processor }, options);
    if (created.ok === false) return { ok: false, error: { code: created.error.code } };
    const settled = await parallel_task_result({ run_id: created.data.run_id, wait: true, timeout_seconds: options?.timeoutSeconds }, options);
    if (settled.ok === false) return { ok: false, error: { code: settled.error.code, run_id: created.data.run_id } };
    const output = (settled.data as Record<string, unknown>).output;
    const basis = output && typeof output === "object" && !Array.isArray(output) ? (output as Record<string, unknown>).basis : undefined;
    const records = normalizeBasis(basis);
    return records ? { ok: true, data: records } : fail("INVALID_API_RESPONSE");
  }

  const result: OperationResult<SearchOutput> = await parallel_search({ objective, search_queries: [topic.trim(), `${topic.trim()} history`, `${topic.trim()} primary sources`], mode: "agentic" }, options);
  if (result.ok === false) return fail(result.error.code);
  const data = normalize(result.data);
  return data ? { ok: true, data } : fail("INVALID_API_RESPONSE");
}
