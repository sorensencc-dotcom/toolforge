/**
 * Cowork Gateway - Main entrypoint.
 * Orchestrates skill registration, manifest export, and sync operations.
 */

export * from './utils';
export * from './client';
export * from './registry';
export * from './sync';

import { CoworkClient } from './client';
import { CoworkAuth } from './client';
import { SkillRegistry } from './registry';
import { ManifestBuilder } from './registry';
import { RegistrationManager } from './registry';
import { SyncCoordinator } from './sync';
import { loadEnv } from './utils';

/**
 * Initialize and run Cowork Gateway Phase 3.A.
 */
async function initializeGateway() {
  try {
    // Load environment configuration
    const env = loadEnv();
    console.log('✅ Environment loaded');

    // Initialize client
    const auth = new CoworkAuth(env.COWORK_API_KEY, env.COWORK_GATEWAY_ID);
    const client = new CoworkClient(env.COWORK_API_URL, env.COWORK_API_KEY, env.COWORK_GATEWAY_ID);
    console.log('✅ Cowork client initialized');

    // Load skill registry
    const registry = new SkillRegistry(env.TOOLFORGE_SKILLS_PATH);
    await registry.load();
    console.log(`✅ Skill registry loaded: ${registry.count()} skills`);

    // Build manifest
    const builder = new ManifestBuilder(env.COWORK_GATEWAY_ID, '1.0.0');
    const manifest = builder.buildGatewayManifest(registry.getAll());
    console.log(`✅ Gateway manifest built: ${manifest.skills.length} skills`);

    // Initialize sync coordinator
    const coordinator = new SyncCoordinator(env.COWORK_GATEWAY_ID, client);
    await coordinator.handshake(['skill-registration', 'distributed-sync'], registry.count());
    console.log('✅ Handshake complete');

    // Register unregistered skills
    const manager = new RegistrationManager(client);
    const unregistered = registry.getByStatus('pending_registration');
    console.log(`📝 Registering ${unregistered.length} unregistered skills...`);

    const results = await manager.registerUnregistered(unregistered);
    const successful = manager.getSuccessful().length;
    const failed = manager.getFailed().length;

    console.log(`✅ Registration complete: ${successful} successful, ${failed} failed`);

    // Sync state
    const registered = registry.countRegistered() + successful;
    await coordinator.syncState(registered, registered);
    console.log('✅ State synced with Cowork');

    // Report final status
    const status = await coordinator.getGatewayStatus();
    console.log(`✅ Gateway status: ${status.status}, ${status.skills_active} skills active`);

    return {
      success: true,
      skillsRegistered: registered,
      results,
    };
  } catch (error) {
    console.error('❌ Gateway initialization failed:', error);
    throw error;
  }
}

export { initializeGateway };
