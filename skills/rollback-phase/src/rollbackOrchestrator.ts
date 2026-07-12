import type { Checkpoint, RollbackState, RollbackResult, RollbackEvent } from "./types";
import * as snapshotLoader from "./snapshotLoader";
import * as configRestorer from "./configRestorer";
import * as flagRestorer from "./flagRestorer";
import * as healthGate from "./healthGate";

// State machine orchestrator: IDLE → INIT → RESTORE_CONFIG → RESTORE_FLAGS → HEALTH_CHECK → COMPLETE|FAIL
export class RollbackOrchestrator {
  private state: RollbackState = "IDLE";
  private events: RollbackEvent[] = [];

  async execute(checkpointId: string): Promise<RollbackResult> {
    // TODO: Implementation: state machine loop
    // IDLE → INIT: load checkpoint, validate
    // INIT → RESTORE_CONFIG: restore config via configRestorer
    // RESTORE_CONFIG → RESTORE_FLAGS: restore flags via flagRestorer
    // RESTORE_FLAGS → HEALTH_CHECK: run health gate
    // HEALTH_CHECK → COMPLETE: if health passed
    // HEALTH_CHECK → FAIL: if health failed (trigger rollback of rollback?)
    // Log event for each state transition

    const result: RollbackResult = {
      phaseId: checkpointId,
      rollbackStatus: "pending",
      restored: false,
      events: this.events,
    };
    return result;
  }

  private emitEvent(type: RollbackEvent["type"], details: Record<string, unknown>): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      details,
    });
  }

  private transitionState(newState: RollbackState): void {
    this.state = newState;
    this.emitEvent("started", { state: newState });
  }

  getEvents(): RollbackEvent[] {
    return this.events;
  }
}
