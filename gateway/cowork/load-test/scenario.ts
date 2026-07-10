import { CoworkClient } from '../src/client/CoworkClient';
import { SyncCoordinator } from '../src/sync/SyncCoordinator';
import { SyncState } from '../src/sync/SyncState';

export interface GatewaySimulatorResult {
  gatewayId: string;
  cycleCount: number;
  errors: Array<{ cycle: number; stage: string; error: string }>;
  lastHash: string | null;
  lastState: Record<string, unknown> | null;
}

export class GatewaySimulator {
  private gatewayId: string;
  private client: CoworkClient;
  private coordinator: SyncCoordinator;
  private result: GatewaySimulatorResult;
  private running = false;

  constructor(gatewayId: string, baseUrl: string, apiKey: string) {
    this.gatewayId = gatewayId;
    this.client = new CoworkClient({ baseUrl, apiKey });
    this.coordinator = new SyncCoordinator(this.client);
    this.result = {
      gatewayId,
      cycleCount: 0,
      errors: [],
      lastHash: null,
      lastState: null,
    };
  }

  async run(durationMs: number, cycleIntervalMs: number): Promise<GatewaySimulatorResult> {
    this.running = true;
    const startTime = Date.now();

    while (this.running && Date.now() - startTime < durationMs) {
      const cycleStartTime = Date.now();
      this.result.cycleCount++;

      try {
        // handshake
        await this.coordinator.handshake();

        // syncState
        await this.coordinator.syncState();
        const state = this.coordinator.getGatewayStatus();
        this.result.lastState = state;

        // pullManifestHash
        const pullResponse = await this.client.pullManifestHash();
        const pulledHash = pullResponse.hash;
        this.result.lastHash = pulledHash;

        // detectDrift and possibly push
        const syncState = this.coordinator.getGatewayStatus();
        const driftDetected = this.coordinator.detectDrift(
          syncState.lastManifestHash || '',
          pulledHash
        );
        if (driftDetected) {
          // In real code, would call DistributedSyncOrchestrator.sync().
          // For this harness, just record the drift and push the current state.
          await this.client.pushManifest({ skills: [] });
        }

        // heartbeat
        await this.client.heartbeat({
          gateway_id: this.gatewayId,
          timestamp: new Date().toISOString(),
        });
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
