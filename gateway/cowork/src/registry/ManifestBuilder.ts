/**
 * Builds Cowork-compatible manifests from skill registry.
 * Exports to JSON format required by Cowork API.
 */

import { Logger } from '../utils/logger';
import { ManifestError } from '../utils/errors';
import { RegisteredSkill } from './SkillRegistry';

interface CoworkSkillManifest {
  id: string;
  name: string;
  version: string;
  category: string;
  entrypoint: string;
  registered: boolean;
}

interface CoworkGatewayManifest {
  gateway: string;
  version: string;
  skills: CoworkSkillManifest[];
  timestamp: string;
}

class ManifestBuilder {
  private logger: Logger;

  constructor(private gatewayId: string, private gatewayVersion: string = '1.0.0') {
    this.logger = new Logger('ManifestBuilder');
  }

  /**
   * Build gateway manifest from skills.
   */
  buildGatewayManifest(skills: RegisteredSkill[]): CoworkGatewayManifest {
    try {
      this.logger.info('Building gateway manifest', { skillCount: skills.length });

      const skillManifests: CoworkSkillManifest[] = skills.map((skill) =>
        this.buildSkillManifest(skill),
      );

      const manifest: CoworkGatewayManifest = {
        gateway: this.gatewayId,
        version: this.gatewayVersion,
        skills: skillManifests,
        timestamp: new Date().toISOString(),
      };

      this.validateManifest(manifest);
      this.logger.info('Gateway manifest built', { skillCount: manifest.skills.length });

      return manifest;
    } catch (error) {
      throw new ManifestError(
        `Failed to build gateway manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build individual skill manifest.
   */
  private buildSkillManifest(skill: RegisteredSkill): CoworkSkillManifest {
    return {
      id: skill.id,
      name: skill.name,
      version: skill.version,
      category: skill.category,
      entrypoint: skill.entrypoint,
      registered: skill.cowork.registered,
    };
  }

  /**
   * Validate manifest schema.
   */
  private validateManifest(manifest: CoworkGatewayManifest): void {
    if (!manifest.gateway || manifest.gateway.trim().length === 0) {
      throw new ManifestError('Gateway ID is empty');
    }

    if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
      throw new ManifestError('Skills array is empty or missing');
    }

    for (const skill of manifest.skills) {
      this.validateSkillManifest(skill);
    }

    this.logger.debug('Manifest validation passed', { skillCount: manifest.skills.length });
  }

  /**
   * Validate individual skill manifest.
   */
  private validateSkillManifest(skill: CoworkSkillManifest): void {
    const required = ['id', 'name', 'version', 'category', 'entrypoint'];
    for (const field of required) {
      if (!skill[field as keyof CoworkSkillManifest]) {
        throw new ManifestError(`Missing required field in skill manifest: ${field}`);
      }
    }
  }

  /**
   * Export manifest to JSON string.
   */
  toJSON(manifest: CoworkGatewayManifest): string {
    return JSON.stringify(manifest, null, 2);
  }
}

export { ManifestBuilder, CoworkGatewayManifest, CoworkSkillManifest };
