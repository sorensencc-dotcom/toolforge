/**
 * Tests for skill registry and manifest building.
 */

import { join } from 'path';
import { SkillRegistry } from '../src/registry/SkillRegistry';
import { ManifestBuilder } from '../src/registry/ManifestBuilder';
import { RegistrationManager } from '../src/registry/RegistrationManager';
import { CoworkClient } from '../src/client/CoworkClient';
import { initMockServer, getMockServerContext, resetMockServerState, shutdownMockServer } from './helpers/mockServer';

const fixturesPath = join(__dirname, 'fixtures', 'skills');

describe('SkillRegistry', () => {
  describe('load', () => {
    it('should load all skills from fixture directory', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      // Should load valid-skill and skip _hidden-template and missing-version
      expect(registry.count()).toBe(1); // Only valid-skill
    });

    it('should skip directories starting with underscore', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skill = registry.getById('test-valid-skill');
      expect(skill).toBeDefined();

      // _hidden-template should be skipped
      const template = registry.getById('_template');
      expect(template).toBeUndefined();
    });

    it('should handle missing required fields gracefully', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      // missing-version should be logged+skipped (not in registry)
      const missingVersion = registry.getById('test-missing-version');
      expect(missingVersion).toBeUndefined();
    });

    it('should parse valid skill.json', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skill = registry.getById('test-valid-skill');
      expect(skill?.name).toBe('Valid Test Skill');
      expect(skill?.version).toBe('1.0.0');
      expect(skill?.category).toBe('test');
      expect(skill?.entrypoint).toBe('src/index.ts');
    });
  });

  describe('getAll', () => {
    it('should return all loaded skills', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      expect(skills.length).toBe(1);
      expect(skills[0].id).toBe('test-valid-skill');
    });
  });

  describe('getByStatus', () => {
    it('should filter skills by registration status', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const unregistered = registry.getByStatus('pending_registration');
      expect(unregistered.length).toBe(1);

      const registered = registry.getByStatus('registered');
      expect(registered.length).toBe(0);
    });
  });

  describe('count', () => {
    it('should return total skill count', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      expect(registry.count()).toBe(1);
    });
  });

  describe('countRegistered', () => {
    it('should return count of registered skills', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      expect(registry.countRegistered()).toBe(0);
    });
  });
});

describe('ManifestBuilder', () => {
  let builder: ManifestBuilder;

  beforeEach(() => {
    builder = new ManifestBuilder('toolforge-cowork-gateway', '1.0.0');
  });

  describe('buildGatewayManifest', () => {
    it('should build valid gateway manifest from skills', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      const manifest = builder.buildGatewayManifest(skills);

      expect(manifest.gateway).toBe('toolforge-cowork-gateway');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.skills.length).toBe(1);
      expect(manifest.timestamp).toBeDefined();
    });

    it('should include all required fields in skill manifest', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      const manifest = builder.buildGatewayManifest(skills);

      const skill = manifest.skills[0];
      expect(skill.id).toBeDefined();
      expect(skill.name).toBeDefined();
      expect(skill.version).toBeDefined();
      expect(skill.category).toBeDefined();
      expect(skill.entrypoint).toBeDefined();
    });

    it('should throw error on empty skills array', () => {
      expect(() => builder.buildGatewayManifest([])).toThrow();
    });

    it('should throw error on missing gateway ID', () => {
      const badBuilder = new ManifestBuilder('', '1.0.0');

      expect(() => {
        badBuilder.buildGatewayManifest([
          {
            id: 'test',
            name: 'Test',
            version: '1.0.0',
            category: 'test',
            entrypoint: 'src/index.ts',
            cowork: { registered: false, status: 'pending_registration' },
          },
        ]);
      }).toThrow();
    });
  });

  describe('toJSON', () => {
    it('should export manifest as valid JSON string', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      const manifest = builder.buildGatewayManifest(skills);
      const json = builder.toJSON(manifest);

      expect(() => JSON.parse(json)).not.toThrow();
      expect(json).toContain('toolforge-cowork-gateway');
    });

    it('should produce valid JSON that can be re-parsed', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      const manifest = builder.buildGatewayManifest(skills);
      const json = builder.toJSON(manifest);
      const parsed = JSON.parse(json);

      expect(parsed.gateway).toBe(manifest.gateway);
      expect(parsed.skills.length).toBe(manifest.skills.length);
    });
  });
});

describe('RegistrationManager', () => {
  let client: CoworkClient;
  let manager: RegistrationManager;

  beforeAll(async () => {
    await initMockServer();
    const context = getMockServerContext();
    client = new CoworkClient(context.baseUrl, context.apiKey, 'toolforge-gateway');
    manager = new RegistrationManager(client);
  });

  afterEach(() => {
    resetMockServerState();
  });

  afterAll(async () => {
    await shutdownMockServer();
  });

  describe('registerUnregistered', () => {
    it('should register all unregistered skills', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      const results = await manager.registerUnregistered(skills);

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].skillId).toBe('test-valid-skill');
    });

    it('should handle partial failures', async () => {
      const context = getMockServerContext();

      // Force registration to fail for the first skill
      context.state.faultInjection.set('/v1/skills/register', {
        forceStatus: { code: 500, count: 100 },
      });

      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      const results = await manager.registerUnregistered(skills);

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
    });

    it('should return empty array when all skills are registered', async () => {
      const skills = [
        {
          id: 'registered-skill',
          name: 'Registered Skill',
          version: '1.0.0',
          category: 'test',
          entrypoint: 'src/index.ts',
          cowork: { registered: true, status: 'registered' as const },
        },
      ];

      const results = await manager.registerUnregistered(skills);

      expect(results).toEqual([]);
    });
  });

  describe('getSuccessful', () => {
    it('should return only successful registrations', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      await manager.registerUnregistered(skills);

      const successful = manager.getSuccessful();
      expect(successful.length).toBe(1);
      expect(successful[0].success).toBe(true);
    });
  });

  describe('getFailed', () => {
    it('should return only failed registrations', async () => {
      const context = getMockServerContext();
      context.state.faultInjection.set('/v1/skills/register', {
        forceStatus: { code: 500, count: 100 },
      });

      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      await manager.registerUnregistered(skills);

      const failed = manager.getFailed();
      expect(failed.length).toBe(1);
      expect(failed[0].success).toBe(false);
    });
  });

  describe('allSucceeded', () => {
    it('should return true when all registrations succeed', async () => {
      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      await manager.registerUnregistered(skills);

      expect(manager.allSucceeded()).toBe(true);
    });

    it('should return false when any registration fails', async () => {
      const context = getMockServerContext();
      context.state.faultInjection.set('/v1/skills/register', {
        forceStatus: { code: 500, count: 100 },
      });

      const registry = new SkillRegistry(fixturesPath);
      await registry.load();

      const skills = registry.getAll();
      await manager.registerUnregistered(skills);

      expect(manager.allSucceeded()).toBe(false);
    });
  });
});
