export interface GovernanceTagParts {
  runId: string;
  gateId?: string;
  profileId?: string;
}

export function formatGovernanceTag(parts: GovernanceTagParts): string {
  const profileId = parts.profileId ?? 'default';
  const segments = [`RUN-ID:${parts.runId}`];
  if (parts.gateId) segments.push(`GATE-ID:${parts.gateId}`);
  segments.push(`PROFILE-ID:${profileId}`);
  return `[${segments.join('][')}]`;
}
