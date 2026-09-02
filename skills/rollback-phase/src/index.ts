import { RollbackOrchestrator } from "./rollbackOrchestrator";
import type { RollbackResult } from "./types";

interface RollbackPhaseInput {
  phaseId: string;
  targetState?: string;
}

export async function execute(input: RollbackPhaseInput): Promise<RollbackResult> {
  console.log(`Rolling back phase: ${input.phaseId}`);
  const orchestrator = new RollbackOrchestrator();
  return orchestrator.execute(input.phaseId);
}

export async function main(input: RollbackPhaseInput): Promise<RollbackResult> {
  return execute(input);
}

export default main;
