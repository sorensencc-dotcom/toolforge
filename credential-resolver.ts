const PROVIDER_ENV_MAP: Record<string, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

/**
 * Resolves credentials directly from environment variables.
 * Conforms to cloudModelSpecs.
 */
export function resolveApiKey(provider: string): string {
  const normalized = provider.toLowerCase();
  const envKey = PROVIDER_ENV_MAP[normalized] || `${normalized.toUpperCase()}_API_KEY`;

  if (process.env[envKey]) {
    return process.env[envKey]!;
  }

  throw new Error(
    `[whichllm] Could not resolve key for "${normalized}". Missing environment variable: ${envKey}`
  );
}

