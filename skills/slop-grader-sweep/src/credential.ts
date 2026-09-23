// skills/slop-grader-sweep/src/credential.ts
import { resolveApiKey } from '../../../credential-resolver';

export type CredentialResult =
  | { ok: true; apiKey: string }
  | { ok: false; reason: string };

export function resolveOpenRouterCredential(): CredentialResult {
  try {
    const apiKey = resolveApiKey('openrouter');
    return { ok: true, apiKey };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
