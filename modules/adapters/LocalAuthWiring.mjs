import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { LocalFileAdapterTransport } from './LocalFileAdapterTransport.mjs';

export class LocalAuthWiring {
  constructor(options = {}) {
    this.sigilRoot = resolve(options.sigilRoot || 'C:\\dev\\.sigil');
    this.policyPath = join(this.sigilRoot, 'auth_policy.json');
    this.sessionPath = join(this.sigilRoot, 'session.json');

    this.transport = new LocalFileAdapterTransport({
      filePath: this.policyPath,
      parse: (raw) => this._parseAuthPolicy(raw)
    });
  }

  async verifyActionPermission(actionIntent) {
    const { action = 'READ', scope = 'LOW_RISK', requiresStepUp = false } = actionIntent || {};

    let policy;
    try {
      policy = await this.transport.fetch();
    } catch {
      policy = {
        mode: 'LOCAL_LOOPBACK',
        requireStepUpForHighRisk: true,
        allowedActions: ['READ', 'QUERY', 'MEMORY_SYNC', 'TODO_SYNC']
      };
    }

    if (requiresStepUp || scope === 'HIGH_RISK' || scope === 'CRITICAL') {
      const stepUpValid = this._checkSessionStepUp();
      if (!stepUpValid) {
        return {
          authorized: false,
          action,
          scope,
          challengeRequired: true,
          reason: 'Action requires local WebAuthn/OIDC step-up authentication challenge.'
        };
      }
    }

    return {
      authorized: true,
      action,
      scope,
      challengeRequired: false,
      reason: `Action '${action}' authorized under local policy mode '${policy.mode}'.`
    };
  }

  _checkSessionStepUp() {
    if (!existsSync(this.sessionPath)) return false;
    try {
      const raw = readFileSync(this.sessionPath, 'utf8');
      const session = JSON.parse(raw);
      if (!session.stepUpVerifiedAt) return false;

      const elapsedMs = Date.now() - new Date(session.stepUpVerifiedAt).getTime();
      const maxAgeMs = (session.stepUpMaxAgeMinutes || 15) * 60 * 1000;
      return elapsedMs <= maxAgeMs;
    } catch {
      return false;
    }
  }

  _parseAuthPolicy(rawString) {
    const parsed = JSON.parse(rawString);
    return {
      mode: parsed.mode || 'LOCAL_LOOPBACK',
      requireStepUpForHighRisk: parsed.require_step_up ?? true,
      allowedActions: parsed.allowed_actions || ['READ', 'QUERY', 'MEMORY_SYNC', 'TODO_SYNC']
    };
  }
}
