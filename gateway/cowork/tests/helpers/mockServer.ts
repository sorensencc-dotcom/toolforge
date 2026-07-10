/**
 * Jest helper for setting up and tearing down the mock Cowork server.
 */

import { createMockCoworkServer, MockCoworkState } from '../../mock-server/src/mockCoworkServer';

export interface MockServerContext {
  baseUrl: string;
  apiKey: string;
  state: MockCoworkState;
}

let mockServerContext: MockServerContext | null = null;
let mockServerInstance: ReturnType<typeof createMockCoworkServer> | null = null;

/**
 * Initialize mock server before tests run.
 */
export async function initMockServer(apiKey: string = 'mock-api-key-1234567890ab'): Promise<MockServerContext> {
  if (mockServerContext) {
    return mockServerContext;
  }

  mockServerInstance = createMockCoworkServer({ apiKey });
  const { baseUrl } = await mockServerInstance.start();

  mockServerContext = {
    baseUrl,
    apiKey,
    state: mockServerInstance.state,
  };

  return mockServerContext;
}

/**
 * Get current mock server context (fails if not initialized).
 */
export function getMockServerContext(): MockServerContext {
  if (!mockServerContext) {
    throw new Error('Mock server not initialized. Call initMockServer() first.');
  }
  return mockServerContext;
}

/**
 * Reset mock server state between tests.
 */
export function resetMockServerState(): void {
  if (mockServerContext) {
    mockServerContext.state.registeredSkills.clear();
    mockServerContext.state.lastManifest = null;
    mockServerContext.state.manifestHash = null;
    mockServerContext.state.lastSyncState = null;
    mockServerContext.state.lastHeartbeat = null;
    mockServerContext.state.requestLog = [];
    mockServerContext.state.faultInjection.clear();
  }
}

/**
 * Shut down mock server after tests run.
 */
export async function shutdownMockServer(): Promise<void> {
  if (mockServerInstance) {
    await mockServerInstance.stop();
  }
  mockServerContext = null;
  mockServerInstance = null;
}
