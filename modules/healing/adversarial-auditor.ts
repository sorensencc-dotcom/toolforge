export interface AuditPacket {
  packetId: string;
  specGoal: string;
  declaredScope: string[];
  testOutput: string;
  appliedDiff: string;
  historyLog: string[];
}

export interface AuditVerdict {
  consensus: boolean;
  blockerAnalysis: string;
  targetedFixRecipe: string;
}

export interface LocalProviderLike {
  generate(modelName: string, prompt: string): Promise<string>;
}

export async function runAdversarialCrossAudit(
  packet: AuditPacket,
  localProvider: LocalProviderLike
): Promise<AuditVerdict> {
  const auditPrompt = `
You are an adversarial code referee operating under strict IJFW discipline.
The previous worker attempt failed the deterministic Iron Gate. You have an isolated, unpolluted context window.

### PACKET SPEC
ID: ${packet.packetId}
Goal: ${packet.specGoal}
Declared Scope: ${JSON.stringify(packet.declaredScope)}

### ATTEMPT DIFF
\`\`\`diff
${packet.appliedDiff}
\`\`\`

### FAILURE TRACE (IRON GATE)
\`\`\`
${packet.testOutput}
\`\`\`

### AGENT HISTORY LOG
${packet.historyLog.slice(-10).join('\n')}

### AUDIT RULES
1. Do not generate full code directly.
2. Formulate a root-cause breakdown of why the attempt failed the gate against the declared scope.
3. Emit a concise, step-by-step remediation recipe for the execution worker.
4. If the diff violates the declared scope or introduced cyclic regressions, set consensus to false.

Respond ONLY with valid JSON:
{
  "consensus": boolean,
  "blockerAnalysis": "string",
  "targetedFixRecipe": "string"
}`;

  const response = await localProvider.generate("adversarial-auditor", auditPrompt);
  try {
    return JSON.parse(response.trim());
  } catch {
    const cleanJson = response.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleanJson);
  }
}
