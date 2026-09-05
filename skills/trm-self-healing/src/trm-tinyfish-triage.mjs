export function matchLocalSignature(logTrace) {
  if (!logTrace || typeof logTrace !== 'string') return null;
  if (/EADDRINUSE|address already in use/i.test(logTrace)) {
    return {
      category: 'PORT_CONFLICT',
      deterministic: true,
      resolution: 'Identify and terminate lingering process on target port using Get-NetTCPConnection or lsof.'
    };
  }
  if (/ECONNREFUSED|connection refused/i.test(logTrace)) {
    return {
      category: 'CONNECTION_REFUSED',
      deterministic: true,
      resolution: 'Verify target daemon is active and listening on expected loopback port.'
    };
  }
  return null;
}

export async function runTinyFishTriage(logTrace, options = {}) {
  const local = matchLocalSignature(logTrace);
  if (local) {
    return { status: 'RESOLVED', category: local.category, resolution: local.resolution };
  }
  return {
    status: 'ESCALATE',
    category: 'UNKNOWN_SIGNATURE',
    resolution: 'Dispatched to Tier-2 Parallel research escalation.'
  };
}
