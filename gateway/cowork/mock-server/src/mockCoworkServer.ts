/**
 * Mock Cowork server for local E2E testing.
 * Implements the 6 canonical endpoints without external HTTP calls.
 */

import express, { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import crypto from 'crypto';

interface MockCoworkServerOpts {
  apiKey?: string;
  port?: number;
}

interface MockCoworkState {
  registeredSkills: Map<string, Record<string, unknown>>;
  lastManifest: Record<string, unknown> | null;
  manifestHash: string | null;
  lastSyncState: Record<string, unknown> | null;
  lastHeartbeat: string | null;
  requestLog: Array<{ method: string; path: string; headers: Record<string, unknown>; timestamp: string }>;
  faultInjection: Map<
    string,
    {
      forceStatus?: { code: number; count: number };
      forceDelayMs?: number;
    }
  >;
}

export function createMockCoworkServer(opts: MockCoworkServerOpts = {}) {
  const apiKey = opts.apiKey || 'mock-api-key-1234567890ab';
  let httpServer: Server | null = null;

  const state: MockCoworkState = {
    registeredSkills: new Map(),
    lastManifest: null,
    manifestHash: null,
    lastSyncState: null,
    lastHeartbeat: null,
    requestLog: [],
    faultInjection: new Map(),
  };

  const app: Express = express();
  app.use(express.json());

  // Auth middleware
  app.use((req: Request, res: Response, next): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      state.requestLog.push({
        method: req.method,
        path: req.path,
        headers: req.headers,
        timestamp: new Date().toISOString(),
      });
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const token = authHeader.slice(7);
    if (token !== apiKey) {
      state.requestLog.push({
        method: req.method,
        path: req.path,
        headers: req.headers,
        timestamp: new Date().toISOString(),
      });
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    next();
  });

  // Fault injection helper
  const applyFaultInjection = async (endpoint: string) => {
    const fault = state.faultInjection.get(endpoint);
    if (fault?.forceDelayMs) {
      await new Promise((r) => setTimeout(r, fault.forceDelayMs));
    }
    if (fault?.forceStatus) {
      const { code, count } = fault.forceStatus;
      if (count > 0) {
        fault.forceStatus.count -= 1;
        return code;
      }
    }
    return null;
  };

  // POST /v1/skills/register
  app.post('/v1/skills/register', async (req: Request, res: Response): Promise<void> => {
    state.requestLog.push({
      method: req.method,
      path: req.path,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    const faultCode = await applyFaultInjection('/v1/skills/register');
    if (faultCode) {
      res.status(faultCode).json({ error: 'fault injection' });
      return;
    }

    const { skill } = req.body;
    if (!skill || !skill.id) {
      res.status(422).json({ error: 'invalid_skill' });
      return;
    }

    state.registeredSkills.set(skill.id, skill);
    res.status(200).json({
      plugin_id: `plugin-${skill.id}`,
      status: 'registered',
      registered_at: new Date().toISOString(),
    });
  });

  // POST /v1/manifests/push
  app.post('/v1/manifests/push', async (req: Request, res: Response): Promise<void> => {
    state.requestLog.push({
      method: req.method,
      path: req.path,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    const faultCode = await applyFaultInjection('/v1/manifests/push');
    if (faultCode) {
      res.status(faultCode).json({ error: 'fault injection' });
      return;
    }

    const body = req.body;
    if (!body.skills || !Array.isArray(body.skills)) {
      res.status(422).json({ error: 'invalid_manifest' });
      return;
    }

    state.lastManifest = body;
    const manifestJson = JSON.stringify(body);
    state.manifestHash = crypto.createHash('sha256').update(manifestJson).digest('hex');

    res.status(200).json({
      manifest_id: `manifest-${Date.now()}`,
      received_at: new Date().toISOString(),
    });
  });

  // GET /v1/manifests/hash
  app.get('/v1/manifests/hash', async (req: Request, res: Response): Promise<void> => {
    state.requestLog.push({
      method: req.method,
      path: req.path,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    const faultCode = await applyFaultInjection('/v1/manifests/hash');
    if (faultCode) {
      res.status(faultCode).json({ error: 'fault injection' });
      return;
    }

    if (!state.manifestHash) {
      res.status(404).json({ error: 'no_manifest' });
      return;
    }

    res.status(200).json({
      gateway: 'toolforge-cowork-gateway',
      hash: state.manifestHash,
      updated_at: new Date().toISOString(),
    });
  });

  // PATCH /v1/sync/state
  app.patch('/v1/sync/state', async (req: Request, res: Response): Promise<void> => {
    state.requestLog.push({
      method: req.method,
      path: req.path,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    const faultCode = await applyFaultInjection('/v1/sync/state');
    if (faultCode) {
      res.status(faultCode).json({ error: 'fault injection' });
      return;
    }

    state.lastSyncState = req.body;
    res.status(200).json({
      sync_id: `sync-${Date.now()}`,
      ack: true,
    });
  });

  // POST /v1/gateways/heartbeat
  app.post('/v1/gateways/heartbeat', async (req: Request, res: Response): Promise<void> => {
    state.requestLog.push({
      method: req.method,
      path: req.path,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    const faultCode = await applyFaultInjection('/v1/gateways/heartbeat');
    if (faultCode) {
      res.status(faultCode).json({ error: 'fault injection' });
      return;
    }

    state.lastHeartbeat = new Date().toISOString();
    res.status(200).json({
      status: 'received',
      received_at: state.lastHeartbeat,
    });
  });

  // GET /v1/gateways/status
  app.get('/v1/gateways/status', async (req: Request, res: Response): Promise<void> => {
    state.requestLog.push({
      method: req.method,
      path: req.path,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });

    const faultCode = await applyFaultInjection('/v1/gateways/status');
    if (faultCode) {
      res.status(faultCode).json({ error: 'fault injection' });
      return;
    }

    res.status(200).json({
      status: 'online',
      skills_active: state.registeredSkills.size,
      last_heartbeat: state.lastHeartbeat || 'never',
    });
  });

  return {
    app,
    state,
    start: async (port?: number): Promise<{ server: Server; port: number; baseUrl: string }> => {
      return new Promise((resolve) => {
        const actualPort = port || opts.port || 0;
        httpServer = createServer(app);
        httpServer.listen(actualPort, '127.0.0.1', () => {
          const addr = httpServer!.address();
          const listenPort = typeof addr === 'object' && addr !== null ? addr.port : actualPort;
          const baseUrl = `http://127.0.0.1:${listenPort}`;
          resolve({ server: httpServer!, port: listenPort, baseUrl });
        });
      });
    },
    stop: async (): Promise<void> => {
      return new Promise((resolve) => {
        if (httpServer) {
          httpServer.close(() => resolve());
        } else {
          resolve();
        }
      });
    },
  };
}

export type { MockCoworkState };
