function validateDriftInputs(agentName: string, expectedSchema: any, actualSchema: any): void {
  if (!agentName || typeof agentName !== "string") {
    throw new Error("agentName is required and must be a string");
  }
  if (!expectedSchema || typeof expectedSchema !== "object") {
    throw new Error("expectedSchema is required and must be an object");
  }
  if (!actualSchema || typeof actualSchema !== "object") {
    throw new Error("actualSchema is required and must be an object");
  }
}

export interface DetectDriftParams {
  agentName: string;
  expectedSchema: any;
  actualSchema: any;
}

export interface DetectDriftResult {
  agentName: string;
  driftDetected: boolean;
  missingFields: string[];
  extraFields: string[];
  recommendations: string[];
}

export function detectDrift({ agentName, expectedSchema, actualSchema }: DetectDriftParams): DetectDriftResult {
  validateDriftInputs(agentName, expectedSchema, actualSchema);

  const expectedKeys = Object.keys(expectedSchema).sort();
  const actualKeys = Object.keys(actualSchema).sort();

  const missing = expectedKeys.filter(k => !actualKeys.includes(k));
  const extra = actualKeys.filter(k => !expectedKeys.includes(k));

  return {
    agentName,
    driftDetected: missing.length > 0 || extra.length > 0,
    missingFields: missing,
    extraFields: extra,
    recommendations: [
      ...(missing.length > 0 ? [`Add missing fields: ${missing.join(", ")}`] : []),
      ...(extra.length > 0 ? [`Remove unexpected fields: ${extra.join(", ")}`] : []),
      ...(missing.length === 0 && extra.length === 0 ? ["Schema is aligned"] : [])
    ]
  };
}
