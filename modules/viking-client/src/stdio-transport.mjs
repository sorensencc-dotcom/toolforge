import { spawn } from 'node:child_process';
import { VikingRpcError } from './errors.mjs';

export function createStdioTransport({ command, args = [], cwd, env, timeoutMs = 30000, onStderr = () => {}, spawnImpl = spawn }) {
  if (typeof command !== 'string' || command.length === 0) throw new TypeError('command is required');
  const child = spawnImpl(command, args, { cwd, env: env ? { ...process.env, ...env } : process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const pending = new Map();
  let nextId = 1;
  let buffer = '';
  let closed = false;

  function rejectAll(error) {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
  }

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n');
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let response;
      try { response = JSON.parse(line); } catch { rejectAll(new VikingRpcError({ message: 'Server emitted malformed JSON', data: { viking_code: 'TRANSPORT_ERROR' } })); continue; }
      const entry = pending.get(response.id);
      if (!entry) continue;
      pending.delete(response.id);
      clearTimeout(entry.timer);
      if (response.error) entry.reject(new VikingRpcError(response.error));
      else entry.resolve(response.result);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', onStderr);
  child.on('error', (error) => rejectAll(new VikingRpcError({ message: error.message, data: { viking_code: 'TRANSPORT_ERROR' } })));
  child.on('exit', (code, signal) => { closed = true; rejectAll(new VikingRpcError({ message: `Viking server exited (${code ?? signal ?? 'unknown'})`, data: { viking_code: 'TRANSPORT_CLOSED' } })); });

  return Object.freeze({
    request(method, params = {}) {
      if (closed) return Promise.reject(new VikingRpcError({ message: 'Viking transport is closed', data: { viking_code: 'TRANSPORT_CLOSED' } }));
      const id = nextId++;
      const envelope = { jsonrpc: '2.0', id, method, params };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new VikingRpcError({ message: `Viking request timed out after ${timeoutMs}ms`, data: { viking_code: 'REQUEST_TIMEOUT', method } })); }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${JSON.stringify(envelope)}\n`);
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      child.stdin.end();
      child.kill();
      rejectAll(new VikingRpcError({ message: 'Viking transport closed', data: { viking_code: 'TRANSPORT_CLOSED' } }));
    },
  });
}

