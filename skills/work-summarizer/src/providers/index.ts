import { ReasoningProvider } from "../reasoningProvider.js";
import { ClaudeProvider } from "./claudeProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";

export { ClaudeProvider } from "./claudeProvider.js";
export { OllamaProvider } from "./ollamaProvider.js";

export type ProviderType = "claude" | "ollama";

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export function createProvider(config: ProviderConfig): ReasoningProvider {
  switch (config.type) {
    case "claude":
      if (!config.apiKey) {
        throw new Error("Claude provider requires apiKey");
      }
      return new ClaudeProvider(config.apiKey, config.model, config.timeoutMs);

    case "ollama":
      return new OllamaProvider(config.model);

    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export function createProviderFromEnv(
  type: ProviderType = "claude",
  timeoutMs: number = 30000
): ReasoningProvider | null {
  if (type === "claude") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620";
    return new ClaudeProvider(apiKey, model, timeoutMs);
  }

  if (type === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL || "llama3";
    return new OllamaProvider(model);
  }

  return null;
}
