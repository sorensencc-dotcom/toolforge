import axios from 'axios';

export default {
  command: 'list',
  describe: 'List available skills',
  builder: (yargs) =>
    yargs
      .option('category', {
        describe: 'Filter by category',
        type: 'string',
        alias: 'c',
      })
      .option('limit', {
        describe: 'Number of skills to show',
        type: 'number',
        alias: 'l',
        default: 20,
      }),

  handler: async (argv) => {
    try {
      const apiUrl = argv.apiUrl;

      if (argv.verbose) {
        console.log(`Fetching skills from ${apiUrl}...`);
      }

      const params = {
        limit: Math.min(argv.limit, 100),
        offset: 0,
      };

      if (argv.category) {
        params.category = argv.category;
      }

      const response = await axios.get(`${apiUrl}/api/v1/skills`, { params });
      const skills = response.data.data || [];

      if (skills.length === 0) {
        console.log('No skills found.');
        return;
      }

      console.log(`\nAvailable Skills (${skills.length} total):\n`);

      skills.forEach((skill) => {
        const rating = skill.rating || { average: 0, count: 0 };
        const avgScore = rating.average ? rating.average.toFixed(1) : 'N/A';
        console.log(`${skill.name}`);
        console.log(`  Category: ${skill.category}`);
        console.log(`  Rating: ${avgScore} (${rating.count} reviews)`);
        console.log(`  Owner: ${skill.owner}`);
        console.log(`  ${skill.description}\n`);
      });

      if (skills.length === argv.limit) {
        console.log(`Use --limit to show more skills.`);
      }
    } catch (error) {
      console.error(`✗ Failed to list skills: ${error.message}`);
      process.exit(1);
    }
  },
};
