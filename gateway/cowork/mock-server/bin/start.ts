/**
 * Standalone mock Cowork server entrypoint.
 * Run: COWORK_API_KEY=your-key ts-node mock-server/bin/start.ts
 */

import { createMockCoworkServer } from '../src/mockCoworkServer';

const apiKey = process.env.COWORK_API_KEY;
if (!apiKey) {
  console.error('COWORK_API_KEY is required to start the mock Cowork server');
  process.exit(1);
}
const port = process.env.COWORK_MOCK_PORT ? parseInt(process.env.COWORK_MOCK_PORT, 10) : 4790;

const server = createMockCoworkServer({ apiKey });

(async () => {
  try {
    const { baseUrl, port: actualPort } = await server.start(port);
    console.log(`Mock Cowork server listening on ${baseUrl}`);
    console.log(`Set COWORK_API_URL=${baseUrl} in your .env`);

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start mock server:', error);
    process.exit(1);
  }
})();
