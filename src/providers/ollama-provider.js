/**
 * OllamaProvider - implements LocalProviderLike interface
 * Connects to Ollama API at OLLAMA_BASE_URL
 * Defaults to http://host.docker.internal:11434/v1 for local Docker development
 */

export class OllamaProvider {
  constructor(config = {}) {
    this.selection = config.selection;
    this.baseUrl =
      config.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      'http://host.docker.internal:11434/v1';
    this.timeout =
      config.timeout ||
      (process.env.OLLAMA_TIMEOUT ? parseInt(process.env.OLLAMA_TIMEOUT, 10) : 30000);
  }

  async execute({ provider = this.selection?.provider, model = this.selection?.model, prompt, onEvent } = {}) {
    if (provider !== 'ollama' || model !== this.selection?.model) {
      const error = new Error('PROVIDER_REQUEST_REJECTED: requested provider/model is not the validated local selection');
      error.receipt = { event_type: 'provider_request_rejected', requested_provider: provider, requested_model: model, retry: false, fallback: false };
      error.trmEvent = { ...error.receipt, event_type: 'trm_provider_validation_failed', reason: 'requested_provider_model_rejected' };
      onEvent?.(error.trmEvent);
      throw error;
    }
    const response = await this.generate(model, prompt);
    const echoedProvider = response?.provider ?? 'ollama';
    const echoedModel = response?.model ?? model;
    if (echoedProvider !== provider || echoedModel !== model) {
      const error = new Error('PROVIDER_ECHO_MISMATCH: Ollama response identity mismatch');
      error.receipt = { event_type: 'provider_echo_mismatch', requested_provider: provider, requested_model: model, echoed_provider: echoedProvider, echoed_model: echoedModel, retry: false, fallback: false };
      error.trmEvent = { ...error.receipt, event_type: 'trm_provider_validation_failed', reason: 'provider_echo_mismatch' };
      onEvent?.(error.trmEvent);
      throw error;
    }
    return { provider, model, response: response?.content ?? response };
  }

  async generate(modelName, prompt) {
    if (!modelName || typeof modelName !== 'string') {
      throw new Error('modelName must be a non-empty string');
    }
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt must be a non-empty string');
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Ollama API returned HTTP ${response.status}: ${errorBody}`
        );
      }

      const data = await response.json();

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error(
          'Malformed Ollama response: missing or empty choices array'
        );
      }

      const message = data.choices[0].message;
      if (!message || typeof message.content !== 'string') {
        throw new Error(
          'Malformed Ollama response: invalid message structure'
        );
      }

      return message.content;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error(
          `Failed to connect to Ollama at ${this.baseUrl}: ${err.message}`
        );
      }
      if (err instanceof SyntaxError) {
        throw new Error(`Failed to parse Ollama response: ${err.message}`);
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Ollama request timed out after ${this.timeout}ms`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default OllamaProvider;
