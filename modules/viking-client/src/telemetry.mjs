export class VikingTelemetryTracker {
  #events = [];
  #sink;

  constructor({ sink = () => {} } = {}) { this.#sink = sink; }

  record(event) {
    const safe = Object.freeze({ timestamp: new Date().toISOString(), ...event });
    this.#events.push(safe);
    this.#sink(safe);
    return safe;
  }

  events() { return [...this.#events]; }

  snapshot() {
    const requests = this.#events.filter((event) => event.event === 'viking.rpc');
    const contentEvents = this.#events.filter((event) => event.event === 'viking.content');
    const reads = requests.reduce((total, event) => total + (event.resource_read_count ?? 0), 0);
    const l2Reads = requests.reduce((total, event) => total + (event.l2_read_count ?? 0), 0);
    return {
      rpc_call_count: requests.length,
      resource_read_count: reads,
      l2_read_count: l2Reads,
      l2_escalation_rate: reads === 0 ? 0 : l2Reads / reads,
      request_bytes: requests.reduce((total, event) => total + (event.request_bytes ?? 0), 0),
      response_bytes: requests.reduce((total, event) => total + (event.response_bytes ?? 0), 0),
      content_tokens: contentEvents.reduce((total, event) => total + (event.content_tokens ?? 0), 0),
      errors: requests.filter((event) => event.error_code).length,
    };
  }
}

