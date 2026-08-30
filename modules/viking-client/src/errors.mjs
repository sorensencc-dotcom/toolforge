export class VikingRpcError extends Error {
  constructor({ code = -32603, message = 'Viking RPC request failed', data = {} } = {}) {
    super(message);
    this.name = 'VikingRpcError';
    this.code = code;
    this.data = data;
    this.vikingCode = data.viking_code ?? 'INTERNAL_ERROR';
  }
}

export function normalizeRpcError(error) {
  if (error instanceof VikingRpcError) return error;
  if (error?.error && typeof error.error === 'object') return new VikingRpcError(error.error);
  if (typeof error?.code === 'number') return new VikingRpcError(error);
  return new VikingRpcError({ message: error?.message || 'Viking transport failed', data: { viking_code: 'TRANSPORT_ERROR' } });
}

export function isVikingError(error, code) {
  return normalizeRpcError(error).vikingCode === code;
}

