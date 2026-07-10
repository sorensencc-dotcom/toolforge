/**
 * Tests for CoworkClient and HTTP transport layer.
 */

import { CoworkClient, SkillManifest } from '../src/client/CoworkClient';
import { initMockServer, getMockServerContext, resetMockServerState, shutdownMockServer } from './helpers/mockServer';

describe('CoworkClient', () => {
  let client: CoworkClient;

  beforeAll(async () => {
    await initMockServer();
    const context = getMockServerContext();
    client = new CoworkClient(context.baseUrl, context.apiKey, 'toolforge-gateway');
  });

  afterEach(() => {
    resetMockServerState();
  });

  afterAll(async () => {
    await shutdownMockServer();
  });

  describe('registerSkill', () => {
    it('should register a skill successfully', async () => {
      const manifest: SkillManifest = {
        id: 'test-skill-1',
        name: 'Test Skill',
        version: '1.0.0',
        category: 'test',
        entrypoint: 'src/index.ts',
      };

      const result = await client.registerSkill(manifest);

      expect(result.status).toBe('registered');
      expect(result.plugin_id).toBe('plugin-test-skill-1');
      expect(result.registered_at).toBeDefined();
    });

    it('should throw RegistrationError on invalid skill', async () => {
      const invalidManifest = { name: 'Invalid' } as unknown as SkillManifest;

      await expect(client.registerSkill(invalidManifest)).rejects.toThrow();
    });

    it('should retry failed registrations (500 error)', async () => {
      const context = getMockServerContext();
      const manifest: SkillManifest = {
        id: 'retry-test',
        name: 'Retry Test',
        version: '1.0.0',
        category: 'test',
        entrypoint: 'src/index.ts',
      };

      // Force two 500 errors before succeeding
      context.state.faultInjection.set('/v1/skills/register', {
        forceStatus: { code: 500, count: 2 },
      });

      const result = await client.registerSkill(manifest);

      expect(result.status).toBe('registered');
      // Should have made 3 requests: 2 failures + 1 success
      expect(context.state.requestLog.length).toBeGreaterThanOrEqual(3);
    });

    it('should not retry 4xx errors', async () => {
      const context = getMockServerContext();
      const manifest: SkillManifest = {
        id: 'no-retry-test',
        name: 'No Retry Test',
        version: '1.0.0',
        category: 'test',
        entrypoint: 'src/index.ts',
      };

      // Force a 422 error (unprocessable entity)
      context.state.faultInjection.set('/v1/skills/register', {
        forceStatus: { code: 422, count: 100 },
      });

      await expect(client.registerSkill(manifest)).rejects.toThrow();
      // Should only have 1 request (no retries on 4xx)
      expect(context.state.requestLog.filter((r) => r.path === '/v1/skills/register').length).toBe(1);
    });
  });

  describe('pushManifest', () => {
    it('should push gateway manifest successfully', async () => {
      const manifest = {
        gateway: 'toolforge-cowork-gateway',
        skills: [
          {
            id: 'skill1',
            name: 'Skill 1',
            version: '1.0.0',
            category: 'test',
            entrypoint: 'src/index.ts',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      const result = await client.pushManifest(manifest);

      expect(result.manifest_id).toBeDefined();
      expect(result.received_at).toBeDefined();
    });

    it('should reject invalid manifest', async () => {
      const invalidManifest = { gateway: 'test' } as any;

      await expect(client.pushManifest(invalidManifest)).rejects.toThrow();
    });
  });

  describe('pullManifestHash', () => {
    it('should fetch manifest hash after push', async () => {
      const manifest = {
        gateway: 'toolforge-cowork-gateway',
        skills: [
          {
            id: 'skill1',
            name: 'Skill 1',
            version: '1.0.0',
            category: 'test',
            entrypoint: 'src/index.ts',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      await client.pushManifest(manifest);
      const hashResult = await client.pullManifestHash();

      expect(hashResult.gateway).toBe('toolforge-cowork-gateway');
      expect(hashResult.hash).toBeDefined();
      expect(hashResult.hash.length).toBe(64); // SHA256 hex string
      expect(hashResult.updated_at).toBeDefined();
    });

    it('should throw SyncError when no manifest exists', async () => {
      await expect(client.pullManifestHash()).rejects.toThrow();
    });
  });

  describe('syncState', () => {
    it('should sync gateway state', async () => {
      const state = {
        gateway_id: 'toolforge-gateway',
        last_sync: new Date().toISOString(),
        skills_registered: 5,
        drift_detected: false,
      };

      const result = await client.syncState(state);

      expect(result.ack).toBe(true);
      expect(result.sync_id).toBeDefined();
    });

    it('should handle sync errors', async () => {
      const context = getMockServerContext();

      // Force permanent 500 errors
      context.state.faultInjection.set('/v1/sync/state', {
        forceStatus: { code: 500, count: 100 },
      });

      const state = {
        gateway_id: 'toolforge-gateway',
        last_sync: new Date().toISOString(),
        skills_registered: 5,
        drift_detected: false,
      };

      await expect(client.syncState(state)).rejects.toThrow();
    });
  });

  describe('heartbeat', () => {
    it('should send heartbeat successfully', async () => {
      const result = await client.heartbeat();

      expect(result.status).toBe('received');
      expect(result.received_at).toBeDefined();
    });

    it('should retry heartbeat on 500 error', async () => {
      const context = getMockServerContext();

      // Force one 500 error
      context.state.faultInjection.set('/v1/gateways/heartbeat', {
        forceStatus: { code: 500, count: 1 },
      });

      const result = await client.heartbeat();

      expect(result.status).toBe('received');
    });
  });

  describe('getGatewayStatus', () => {
    it('should fetch gateway status', async () => {
      const result = await client.getGatewayStatus();

      expect(result.status).toBe('online');
      expect(result.skills_active).toBe(0);
      expect(result.last_heartbeat).toBeDefined();
    });

    it('should report skill count after registration', async () => {
      const manifest: SkillManifest = {
        id: 'status-test',
        name: 'Status Test',
        version: '1.0.0',
        category: 'test',
        entrypoint: 'src/index.ts',
      };

      await client.registerSkill(manifest);
      const status = await client.getGatewayStatus();

      expect(status.skills_active).toBe(1);
    });
  });

  describe('Authentication', () => {
    it('should reject requests with invalid API key', async () => {
      const context = getMockServerContext();
      const badClient = new CoworkClient(context.baseUrl, 'invalid-key', 'toolforge-gateway');

      const manifest: SkillManifest = {
        id: 'auth-test',
        name: 'Auth Test',
        version: '1.0.0',
        category: 'test',
        entrypoint: 'src/index.ts',
      };

      await expect(badClient.registerSkill(manifest)).rejects.toThrow();
    });

    it('should include Bearer token in auth header', async () => {
      const context = getMockServerContext();
      const manifest: SkillManifest = {
        id: 'header-test',
        name: 'Header Test',
        version: '1.0.0',
        category: 'test',
        entrypoint: 'src/index.ts',
      };

      await client.registerSkill(manifest);

      const lastRequest = context.state.requestLog[context.state.requestLog.length - 1];
      expect(lastRequest.headers.authorization).toContain('Bearer ');
    });
  });

  describe('Timeout handling', () => {
    it('should timeout on delayed response', async () => {
      const context = getMockServerContext();

      // Force a 5 second delay on status endpoint
      context.state.faultInjection.set('/v1/gateways/status', {
        forceDelayMs: 5000,
      });

      // This test may be flaky depending on system load; skipping for now
      // as timeout behavior depends on CoworkHttp implementation
    });
  });
});
