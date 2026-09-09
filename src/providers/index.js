/**
 * Provider Factory & Dependency Injection
 * Returns configured provider instance based on environment
 */

import OllamaProvider from './ollama-provider.js';
import { loadModelSelection } from './model-selection.js';

let cachedProvider = null;

export function getProvider(config) {
  if (cachedProvider) return cachedProvider;

  const selection = config?.selection ?? loadModelSelection(config?.repoRoot);
  cachedProvider = new OllamaProvider({ ...config, selection });
  return cachedProvider;
}

export function resetProvider() {
  cachedProvider = null;
}

export { OllamaProvider };
export default getProvider;
