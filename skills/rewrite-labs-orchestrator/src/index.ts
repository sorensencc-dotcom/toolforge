function validatePipelineState(pipelineState: any): void {
  if (!pipelineState || typeof pipelineState !== "object") {
    throw new Error("pipelineState is required and must be an object");
  }
}

export interface PipelineStage {
  name: string;
  status: "pending" | "running" | "complete" | "blocked";
}

export interface PipelineState {
  stages: PipelineStage[];
}

export interface OrchestratePipelineParams {
  pipelineState: PipelineState;
}

export interface OrchestratePipelineResult {
  totalStages: number;
  completedStages: number;
  blockedStages: number;
  blockedStageNames: string[];
  progressPercent: number;
  nextSteps: string[];
  suggestedActions: string[];
}

export function orchestratePipeline({ pipelineState }: OrchestratePipelineParams): OrchestratePipelineResult {
  validatePipelineState(pipelineState);

  const stages = pipelineState.stages || [];
  const blockedStages = stages.filter(s => s.status === "blocked");
  const completedStages = stages.filter(s => s.status === "complete");
  const runningStages = stages.filter(s => s.status === "running");

  const nextSteps: string[] = [];
  if (blockedStages.length > 0) {
    nextSteps.push(`Unblock: ${blockedStages.map(s => s.name).join(", ")}`);
  }
  if (runningStages.length === 0 && completedStages.length < stages.length) {
    const pending = stages.find(s => s.status === "pending");
    if (pending) nextSteps.push(`Start: ${pending.name}`);
  }

  return {
    totalStages: stages.length,
    completedStages: completedStages.length,
    blockedStages: blockedStages.length,
    blockedStageNames: blockedStages.map(s => s.name),
    progressPercent: completedStages.length * 100 / Math.max(stages.length, 1),
    nextSteps: nextSteps.length > 0 ? nextSteps : ["Pipeline running normally"],
    suggestedActions: blockedStages.length > 0 ? ["Review blockers", "Request assistance"] : []
  };
}
