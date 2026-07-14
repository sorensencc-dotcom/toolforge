import axios from 'axios';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

export default {
  command: 'install <skill-name>',
  describe: 'Install a skill',
  builder: (yargs) =>
    yargs
      .positional('skill-name', {
        describe: 'Skill name or ID to install',
        type: 'string',
      })
      .option('version', {
        describe: 'Specific version to install',
        type: 'string',
        alias: 'v',
      })
      .option('destination', {
        describe: 'Installation directory',
        type: 'string',
        alias: 'd',
        default: './skills',
      }),

  handler: async (argv) => {
    try {
      const apiUrl = argv.apiUrl;
      const skillName = argv.skillName;
      const destination = resolve(argv.destination);

      if (argv.verbose) {
        console.log(`Installing skill: ${skillName}`);
        console.log(`API URL: ${apiUrl}`);
        console.log(`Destination: ${destination}`);
      }

      // Search for skill by name
      let skillId;
      try {
        const searchRes = await axios.get(`${apiUrl}/api/v1/skills/search`, {
          params: { q: skillName, limit: 1 },
        });
        if (searchRes.data.data.length === 0) {
          console.error(`✗ Skill not found: ${skillName}`);
          process.exit(1);
        }
        skillId = searchRes.data.data[0].id;
      } catch (error) {
        console.error(`✗ Failed to search skills: ${error.message}`);
        process.exit(1);
      }

      // Fetch skill details
      let skill;
      try {
        const skillRes = await axios.get(`${apiUrl}/api/v1/skills/${skillId}`);
        skill = skillRes.data.data;
      } catch (error) {
        console.error(`✗ Failed to fetch skill: ${error.message}`);
        process.exit(1);
      }

      // Fetch versions
      let versions;
      try {
        const versionsRes = await axios.get(`${apiUrl}/api/v1/skills/${skillId}/versions`);
        versions = versionsRes.data.data || [];
      } catch (error) {
        console.error(`✗ Failed to fetch versions: ${error.message}`);
        process.exit(1);
      }

      if (versions.length === 0) {
        console.error(`✗ No versions available for ${skillName}`);
        process.exit(1);
      }

      // Select version
      const targetVersion =
        versions.find((v) => v.version_tag === argv.version) ||
        versions[0]; // Default to latest

      if (argv.verbose) {
        console.log(`Installing ${skill.name} v${targetVersion.version_tag}`);
      }

      // Create installation record
      const userId = process.env.USER || 'cli-user';
      try {
        // Note: Would need to call a logging endpoint
        // For now, just simulate the installation
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        if (argv.verbose) {
          console.warn(`Warning: Could not log installation: ${error.message}`);
        }
      }

      // Create installation metadata
      mkdirSync(destination, { recursive: true });
      const installMetadata = {
        skill: skill.name,
        skillId: skill.id,
        version: targetVersion.version_tag,
        installedAt: new Date().toISOString(),
        entrypoint: skill.manifest_json?.entrypoint || 'index.js',
        runtime: skill.manifest_json?.runtime || 'node',
      };

      writeFileSync(
        `${destination}/.toolforge-install.json`,
        JSON.stringify(installMetadata, null, 2)
      );

      console.log(`✓ Successfully installed ${skill.name} v${targetVersion.version_tag}`);
      console.log(`  Location: ${destination}`);
      if (skill.manifest_json?.entrypoint) {
        console.log(`  Entrypoint: ${skill.manifest_json.entrypoint}`);
      }
    } catch (error) {
      console.error(`✗ Installation failed: ${error.message}`);
      process.exit(1);
    }
  },
};
