/**
 * Alert Manager for Observability Node
 */
export class AlertManager {
  #alerts = [];
  #maxAlerts;

  constructor(maxAlerts = 100) {
    this.#maxAlerts = maxAlerts;
  }

  recordAlert(level, code, message, meta = {}) {
    const alert = {
      alertId: `alt-${Date.now()}-${this.#alerts.length + 1}`,
      level, // 'critical' | 'warning' | 'info'
      code,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };
    this.#alerts.push(alert);
    if (this.#alerts.length > this.#maxAlerts) this.#alerts.shift();
    return alert;
  }

  getAlerts(level) {
    if (!level) return [...this.#alerts];
    return this.#alerts.filter((a) => a.level === level);
  }

  clear() {
    this.#alerts = [];
  }
}
