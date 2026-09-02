/**
 * Main Cowork API client.
 * Orchestrates registration, manifest push, sync operations.
 */

import { CoworkHttp } from './CoworkHttp';
import { CoworkAuth } from './CoworkAuth';
import { Logger } from '../utils/logger';
import { RegistrationError, SyncError } from '../utils/errors';

interface SkillManifest {
  id: string;
  name: string;
  version: string;
  category: string;
  entrypoint: string;
}

interface GatewayManifest {
  gateway: string;
  skills: SkillManifest[];
  timestamp: string;
}

interface RegistrationResponse {
  plugin_id: string;
  status: string;
  registered_at: string;
}

interface SyncStateUpdate {
  gateway_id: string;
  last_sync: string;
  skills_registered: number;
  drift_detected: boolean;
}

class CoworkClient {
  private logger: Logger;
  private http: CoworkHttp;
  private auth: CoworkAuth;

  constructor(apiUrl: string, apiKey: string, gatewayId: string) {
    this.logger = new Logger('CoworkClient');
    this.http = new CoworkHttp(apiUrl);
    this.auth = new CoworkAuth(apiKey, gatewayId);
  }

  /**
   * Register a single skill to Cowork.
   */
  async registerSkill(manifest: SkillManifest): Promise<RegistrationResponse> {
    try {
      this.logger.info('Registering skill', { skillId: manifest.id });

      const payload = {
        skill: manifest,
        gateway_identity: this.auth.getGatewayIdentity(),
      };

      const response = await this.http.request<RegistrationResponse>(
        '/v1/skills/register',
        {
          method: 'POST',
          headers: this.auth.getAuthHeader(),
          body: payload,
          retries: 3,
        },
      );

      this.logger.info('Skill registered', {
        skillId: manifest.id,
        pluginId: response.data.plugin_id,
      });

      return response.data;
    } catch (error) {
      throw new RegistrationError(
        `Failed to register skill: ${error instanceof Error ? error.message : String(error)}`,
        manifest.id,
      );
    }
  }

  /**
   * Push complete gateway manifest to Cowork.
   */
  async pushManifest(manifest: GatewayManifest): Promise<{ manifest_id: string; received_at: string }> {
    try {
      this.logger.info('Pushing gateway manifest', {
        skillCount: manifest.skills.length,
      });

      const payload = {
        ...manifest,
        gateway_identity: this.auth.getGatewayIdentity(),
      };

      const response = await this.http.request<{ manifest_id: string; received_at: string }>(
        '/v1/manifests/push',
        {
          method: 'POST',
          headers: this.auth.getAuthHeader(),
          body: payload,
          retries: 2,
        },
      );

      this.logger.info('Manifest pushed', { manifestId: response.data.manifest_id });
      return response.data;
    } catch (error) {
      throw new RegistrationError(
        `Failed to push manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Sync gateway state with Cowork.
   */
  async syncState(state: SyncStateUpdate): Promise<{ sync_id: string; ack: boolean }> {
    try {
      this.logger.info('Syncing state', { skillsRegistered: state.skills_registered });

      const response = await this.http.request<{ sync_id: string; ack: boolean }>(
        '/v1/sync/state',
        {
          method: 'PATCH',
          headers: this.auth.getAuthHeader(),
          body: state,
          retries: 3,
        },
      );

      this.logger.info('State synced', { syncId: response.data.sync_id });
      return response.data;
    } catch (error) {
      throw new SyncError(
        `Failed to sync state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get gateway status from Cowork.
   */
  async getGatewayStatus(): Promise<{
    status: string;
    skills_active: number;
    last_heartbeat: string;
  }> {
    try {
      this.logger.debug('Fetching gateway status');

      const response = await this.http.request<{
        status: string;
        skills_active: number;
        last_heartbeat: string;
      }>('/v1/gateways/status', {
        method: 'GET',
        headers: this.auth.getAuthHeader(),
        retries: 2,
      });

      return response.data;
    } catch (error) {
      throw new SyncError(
        `Failed to get gateway status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Pull manifest hash from Cowork.
   */
  async pullManifestHash(): Promise<{
    gateway: string;
    hash: string;
    updated_at: string;
  }> {
    try {
      this.logger.debug('Fetching manifest hash');

      const response = await this.http.request<{
        gateway: string;
        hash: string;
        updated_at: string;
      }>('/v1/manifests/hash', {
        method: 'GET',
        headers: this.auth.getAuthHeader(),
        retries: 2,
      });

      this.logger.info('Manifest hash fetched', { hash: response.data.hash });
      return response.data;
    } catch (error) {
      throw new SyncError(
        `Failed to pull manifest hash: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send gateway heartbeat to Cowork.
   */
  async heartbeat(): Promise<{
    status: string;
    received_at: string;
  }> {
    try {
      this.logger.debug('Sending heartbeat');

      const payload = {
        gateway_id: this.auth.getGatewayIdentity().gatewayId,
        timestamp: new Date().toISOString(),
      };

      const response = await this.http.request<{
        status: string;
        received_at: string;
      }>('/v1/gateways/heartbeat', {
        method: 'POST',
        headers: this.auth.getAuthHeader(),
        body: payload,
        retries: 2,
      });

      this.logger.info('Heartbeat sent', { status: response.data.status });
      return response.data;
    } catch (error) {
      throw new SyncError(
        `Failed to send heartbeat: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

interface ManifestHashResponse {
  gateway: string;
  hash: string;
  updated_at: string;
}

interface HeartbeatResponse {
  status: string;
  received_at: string;
}

export {
  CoworkClient,
  SkillManifest,
  GatewayManifest,
  RegistrationResponse,
  SyncStateUpdate,
  ManifestHashResponse,
  HeartbeatResponse,
};
