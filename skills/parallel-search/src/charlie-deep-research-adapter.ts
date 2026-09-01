import { parallel_search, type OperationResult, type RuntimeOptions, type SearchOutput } from "./index.js";

export type CharlieResearchRecord = { title: string; url: string; snippet: string };
export type AdapterErrorCode = "FEATURE_DISABLED" | "INVALID_INPUT" | "INVALID_API_RESPONSE" | "API_KEY_MISSING" | "PARALLEL_API_ERROR";
export type AdapterResult = { ok: true; data: CharlieResearchRecord[] } | { ok: false; error: { code: AdapterErrorCode } };
export type AdapterOptions = RuntimeOptions & { enabled?: boolean };

const isEnabled = (options?: AdapterOptions) => options?.enabled ?? ["1", "true", "yes"].includes(process.env.CHARLIE_PARALLEL_SEARCH_ENABLED?.trim().toLowerCase() ?? "");
const fail = (code: AdapterErrorCode): AdapterResult => ({ ok: false, error: { code } });

function normalize(value: SearchOutput): CharlieResearchRecord[] | undefined {
  if (!Array.isArray(value.results)) return undefined;
  return value.results.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const title = record.title;
    const url = record.url;
    if (typeof title !== "string" || typeof url !== "string" || !/^https?:\/\//.test(url)) return [];
    const excerpts = record.excerpts;
    const snippet = Array.isArray(excerpts) && typeof excerpts[0] === "string" ? excerpts[0] : "";
    return [{ title, url, snippet }];
  });
}

export async function charlieDeepResearchSearch(topic: string, persona: string, options?: AdapterOptions): Promise<AdapterResult> {
  if (!isEnabled(options)) return fail("FEATURE_DISABLED");
  if (typeof topic !== "string" || !topic.trim() || typeof persona !== "string" || !persona.trim()) return fail("INVALID_INPUT");
  const result: OperationResult<SearchOutput> = await parallel_search({ objective: `Research ${topic.trim()} from the perspective of ${persona.trim()}`, search_queries: [topic.trim(), `${topic.trim()} history`, `${topic.trim()} primary sources`], mode: "agentic" }, options);
  if (result.ok === false) return fail(result.error.code);
  const data = normalize(result.data);
  return data ? { ok: true, data } : fail("INVALID_API_RESPONSE");
}
