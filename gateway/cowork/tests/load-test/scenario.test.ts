import { GatewaySimulator } from '../../load-test/scenario';
import { createMockCoworkServer } from '../../mock-server/src/mockCoworkServer';

describe('GatewaySimulator', () => {
  let mockServer: Awaited<ReturnType<typeof createMockCoworkServer>>;
  let baseUrl: string;

  beforeAll(async () => {
    mockServer = createMockCoworkServer({ apiKey: 'test-key' });
    const { baseUrl: url } = await mockServer.start();
    baseUrl = url;
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('runs a single gateway cycle without crashing', async () => {
    const sim = new GatewaySimulator('test-gw-1', baseUrl, 'test-key');
    const result = await sim.run(5000, 5000);

    expect(result.gatewayId).toBe('test-gw-1');
    expect(result.cycleCount).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);
  });

  it('completes multiple cycles within duration', async () => {
    const sim = new GatewaySimulator('test-gw-2', baseUrl, 'test-key');
    // 3 cycles of ~3s each = ~9s, well within 15s timeout
    const result = await sim.run(15000, 3000);

    expect(result.cycleCount).toBeGreaterThanOrEqual(2);
  });

  it('records errors from failed requests', async () => {
    const sim = new GatewaySimulator('test-gw-3', baseUrl, 'wrong-key');
    const result = await sim.run(2000, 2000);

    // Should fail auth and record an error
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('stops early when stop() is called', async () => {
    const sim = new GatewaySimulator('test-gw-4', baseUrl, 'test-key');
    const promise = sim.run(30000, 3000); // Would run 10 cycles
    setTimeout(() => sim.stop(), 5000);
    const result = await promise;

    expect(result.cycleCount).toBeLessThan(5);
  });
});
