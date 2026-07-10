import { CoworkClient } from '../src/client/CoworkClient';
import { SyncCoordinator } from '../src/sync/SyncCoordinator';

export interface GatewaySimulatorResult {
  gatewayId: string;
  cycleCount: number;
  errors: Array<{ cycle: number; stage: string; error: string }>;
  lastHash: string | null;
  lastStatus: Record<string, unknown> | null;
}

export class GatewaySimulator {
  private gatewayId: string;
  private client: CoworkClient;
  private coordinator: SyncCoordinator;
  private result: GatewaySimulatorResult;
  private running = false;

  constructor(gatewayId: string, baseUrl: string, apiKey: string) {
    this.gatewayId = gatewayId;
    this.client = new CoworkClient(baseUrl, apiKey, gatewayId);
    this.coordinator = new SyncCoordinator(gatewayId, this.client);
    this.result = {
      gatewayId,
      cycleCount: 0,
      errors: [],
      lastHash: null,
      lastStatus: null,
    };
  }

  async run(durationMs: number, cycleIntervalMs: number): Promise<GatewaySimulatorResult> {
    this.running = true;
    const startTime = Date.now();

    while (this.running && Date.now() - startTime < durationMs) {
      const cycleStartTime = Date.now();
      this.result.cycleCount++;

      try {
        // handshake with empty capabilities and 0 skills (placeholder for load test)
        await this.coordinator.handshake([], 0);

        // syncState
        await this.coordinator.syncState(0, 0);

        // pullManifestHash
        const pullResponse = await this.client.pullManifestHash();
        const pulledHash = pullResponse.hash;
        this.result.lastHash = pulledHash;

        // detectDrift against empty hash (no change in this simplified harness)
        this.coordinator.detectDrift('', pulledHash);

        // push minimal manifest
        await this.client.pushManifest({
          gateway: this.gatewayId,
          skills: [],
          timestamp: new Date().toISOString(),
        });

        // heartbeat
        await this.client.heartbeat();

        // get gateway status
        const status = await this.coordinator.getGatewayStatus();
        this.result.lastStatus = status;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.result.errors.push({
          cycle: this.result.cycleCount,
          stage: 'unknown',
          error,
        });
      }

      // Sleep until next cycle
      const elapsed = Date.now() - cycleStartTime;
      const sleepMs = Math.max(0, cycleIntervalMs - elapsed);
      if (sleepMs > 0) {
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }

    this.running = false;
    return this.result;
  }

  stop(): void {
    this.running = false;
  }
}
