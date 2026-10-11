import { spawn } from 'node:child_process'; // noqa: SEC-AUDITOR -- reviewed fixed Node worker, shell:false, pinned sources and exact read permissions; see docs/USAGE.md.
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { validateInvocationInput, inspectInvocation, getInvocationDescriptor, classifyInvocationResult, MAX_INPUT_BYTES } from './invocation-contracts.mjs';
import reviewed from './invocation-reviewed.json' with { type: 'json' };

const MAX_OUTPUT_BYTES = 131072;
// Trusted framing gets 4 KiB separately from the public 64 KiB input allowance.
export const MAX_WORKER_FRAMING_BYTES = 4096;
export const MAX_WORKER_REQUEST_BYTES = MAX_INPUT_BYTES + MAX_WORKER_FRAMING_BYTES;
const messages = Object.freeze({
  INVALID_INPUT: 'Invalid invocation input', INVALID_JSON: 'Invalid JSON', INVALID_TARGET: 'Unknown pilot skill',
  PAYLOAD_TOO_LARGE: 'Request exceeds 64 KiB', RUNTIME_UNAVAILABLE: 'Compatible read-only runtime unavailable',
  SOURCE_DRIFT: 'Installed sources do not match reviewed pilot', BUSY: 'Two pilot workers are already active',
  WORKER_FAILED: 'Skill execution failed', TIMED_OUT: 'Invocation exceeded five seconds', CANCELLED: 'Invocation cancelled',
});
export function invocationEnvelope(skillId, state, code = null, durationMs = 0, fieldErrors) {
  return { contractVersion: 1, skillId, state, outcome: null, result: null,
    error: code ? { code, message: messages[code], ...(fieldErrors ? { fieldErrors } : {}) } : null, durationMs };
}
export function invocationFailure(skillId, cause, durationMs = 0) {
  const aliases = { INPUT_TOO_LARGE: 'PAYLOAD_TOO_LARGE', INVALID_CONTEXT: 'RUNTIME_UNAVAILABLE', REGISTRY_DRIFT: 'SOURCE_DRIFT', REGISTRY_UNAVAILABLE: 'SOURCE_DRIFT', SOURCE_UNAVAILABLE: 'SOURCE_DRIFT', REVIEW_INCOMPLETE: 'SOURCE_DRIFT' };
  const code = Object.hasOwn(aliases, cause?.code) ? aliases[cause.code] : Object.hasOwn(messages, cause?.code) ? cause.code : 'WORKER_FAILED';
  const state = code === 'CANCELLED' ? 'cancelled' : code === 'TIMED_OUT' ? 'timed_out' : ['RUNTIME_UNAVAILABLE', 'SOURCE_DRIFT'].includes(code) ? 'unavailable' : ['INVALID_INPUT', 'INVALID_JSON', 'INVALID_TARGET', 'PAYLOAD_TOO_LARGE', 'BUSY'].includes(code) ? 'rejected' : 'failed';
  return invocationEnvelope(skillId, state, code, durationMs, code === 'INVALID_INPUT' ? cause.fieldErrors : undefined);
}
function protocol(raw, skillId, durationMs) {
  const value = JSON.parse(raw);
  const expected = ['contractVersion', 'skillId', 'state', 'outcome', 'result', 'error', 'durationMs'];
  if (!value || Object.keys(value).length !== expected.length || !expected.every(k => Object.hasOwn(value, k)) || value.contractVersion !== 1 || value.skillId !== skillId || !Number.isFinite(value.durationMs) || value.durationMs < 0) throw new Error('protocol');
  if (value.state === 'completed') {
    if (value.error !== null || classifyInvocationResult(skillId, value.result) !== value.outcome) throw new Error('result');
  } else {
    if (value.outcome !== null || value.result !== null || !value.error || !Object.hasOwn(messages, value.error.code) || Object.keys(value.error).some(k => !['code', 'message', 'fieldErrors'].includes(k))) throw new Error('error');
    const safe = invocationFailure(skillId, { code: value.error.code }, durationMs);
    if (safe.state !== value.state) throw new Error('state');
    return safe;
  }
  return { ...value, durationMs };
}

export function createInvocationRunner(context) {
  const configured = { ...context, workspaceRoots: [...(context?.workspaceRoots ?? [])] };
  const active = new Set();
  let disposed = false;
  async function inspect(skillId) {
    getInvocationDescriptor(skillId);
    try {
      if (Number(process.versions.node.split('.')[0]) !== 24 || typeof configured.nodeExecutable !== 'string' || !path.isAbsolute(configured.nodeExecutable) || await realpath(configured.nodeExecutable) !== await realpath(process.execPath)) throw new Error('runtime');
    } catch { return { contractVersion: 1, fields: getInvocationDescriptor(skillId).fields, available: false, reason: 'RUNTIME_UNAVAILABLE' }; }
    const metadata = await inspectInvocation(skillId, configured);
    if (!process.allowedNodeEnvironmentFlags.has('--permission') || !process.allowedNodeEnvironmentFlags.has('--experimental-strip-types')) return { ...metadata, available: false, reason: 'RUNTIME_UNAVAILABLE' };
    return metadata;
  }
  async function invokeSkill(skillId, input, { signal } = {}) {
    try {
      if (typeof skillId !== 'string') throw Object.assign(new Error('target'), { code: 'INVALID_TARGET' });
      getInvocationDescriptor(skillId);
    }
    catch (cause) { return invocationFailure(null, cause); }
    if (disposed || signal?.aborted) return invocationFailure(skillId, { code: 'CANCELLED' });
    if (active.size >= 2) return invocationFailure(skillId, { code: 'BUSY' });
    let cancel = () => {};
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    const slot = { cancel: () => cancel(), done };
    active.add(slot);
    try {
      const normalized = await validateInvocationInput(skillId, input, { ...configured, signal });
      // Freeze caller-owned objects before any later await or spawn.
      const frozenInput = JSON.parse(JSON.stringify(normalized.input));
      const metadata = await inspect(skillId);
      if (disposed || signal?.aborted) return invocationFailure(skillId, { code: 'CANCELLED' });
      if (!metadata.available) return invocationFailure(skillId, { code: metadata.reason });
      const toolforgeRoot = await realpath(configured.toolforgeRoot);
      const workspaceRoots = await Promise.all(configured.workspaceRoots.map(root => realpath(root)));
      const request = JSON.stringify({ contractVersion: 1, skillId, input: frozenInput, context: { toolforgeRoot, workspaceRoots, nodeExecutable: configured.nodeExecutable } });
      const inputBytes = Buffer.byteLength(JSON.stringify(frozenInput));
      if (inputBytes > MAX_INPUT_BYTES) return invocationFailure(skillId, { code: 'PAYLOAD_TOO_LARGE' });
      if (Buffer.byteLength(request) - inputBytes > MAX_WORKER_FRAMING_BYTES) return invocationFailure(skillId, { code: 'INVALID_CONTEXT' });
      if (disposed || signal?.aborted) return invocationFailure(skillId, { code: 'CANCELLED' });
      const closure = [...reviewed.shared, ...reviewed.skills[skillId].files];
      const reads = [...closure, ...reviewed.absent, ...reviewed.skills[skillId].absent, 'skills/toolforge-cli/src/invocation-reviewed.json'].map(file => path.join(toolforgeRoot, file));
      const args = ['--permission', '--experimental-strip-types', ...new Set([...reads, ...normalized.readFiles].map(file => `--allow-fs-read=${file}`)), path.join(toolforgeRoot, 'skills/toolforge-cli/src/invocation-worker.mjs')];
      const env = {};
      for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key];
      const start = performance.now();
      return await new Promise(resolve => {
        let child;
        let terminal = null;
        let bytes = 0;
        const stdout = [];
        const elapsed = () => Math.max(0, performance.now() - start);
        const stop = code => {
          if (terminal === null) terminal = code;
          if (child && child.exitCode === null && child.signalCode === null) child.kill();
        };
        try { child = spawn(configured.nodeExecutable, args, { shell: false, detached: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env, cwd: toolforgeRoot }); }
        catch { resolve(invocationFailure(skillId, { code: 'WORKER_FAILED' }, elapsed())); return; }
        cancel = () => stop('CANCELLED');
        const timer = setTimeout(() => stop('TIMED_OUT'), Math.max(0, 5000 - elapsed()));
        signal?.addEventListener('abort', cancel, { once: true });
        if (disposed || signal?.aborted) cancel();
        child.on('error', () => stop('WORKER_FAILED'));
        child.stdin.on('error', () => stop('WORKER_FAILED'));
        for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > MAX_OUTPUT_BYTES) { stop('WORKER_FAILED'); return; }
          if (stream === child.stdout) stdout.push(chunk);
        });
        // close waits for process exit AND drained pipes; no early slot release.
        child.on('close', (code, exitSignal) => {
          clearTimeout(timer); signal?.removeEventListener('abort', cancel);
          if (terminal || code !== 0 || exitSignal) { resolve(invocationFailure(skillId, { code: terminal ?? 'WORKER_FAILED' }, elapsed())); return; }
          try { resolve(protocol(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(stdout)), skillId, elapsed())); }
          catch { resolve(invocationFailure(skillId, { code: 'WORKER_FAILED' }, elapsed())); }
        });
        child.stdin.end(request);
      });
    } catch (cause) { return invocationFailure(skillId, disposed || signal?.aborted ? { code: 'CANCELLED' } : cause); }
    finally { active.delete(slot); finish(); }
  }
  async function dispose() {
    disposed = true;
    const slots = [...active];
    for (const slot of slots) slot.cancel();
    await Promise.all(slots.map(slot => slot.done));
  }
  return { invokeSkill, inspectInvocation: inspect, dispose };
}

export async function runInvocationCli(argv = process.argv.slice(2), stdin = process.stdin) {
  let skillId = null;
  let runner;
  try {
    const workspaceRoots = [];
    const invalidArgs = () => { throw Object.assign(new Error('args'), { code: 'INVALID_INPUT', fieldErrors: { arguments: 'Use one --skill and at least one absolute --workspace-root' } }); };
    let target;
    for (let i = 0; i < argv.length; i += 2) {
      const flag = argv[i], value = argv[i + 1];
      if (typeof value !== 'string' || !value || value.startsWith('--')) invalidArgs();
      if (flag === '--skill' && target === undefined) target = value;
      else if (flag === '--workspace-root' && path.isAbsolute(value)) workspaceRoots.push(value);
      else invalidArgs();
    }
    if (target === undefined || !workspaceRoots.length) invalidArgs();
    getInvocationDescriptor(target);
    skillId = target;
    const chunks = [];
    let bytes = 0;
    // Raw stdin has its own cap, before decoding or JSON whitespace removal.
    for await (const chunk of stdin) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_INPUT_BYTES) throw Object.assign(new Error('size'), { code: 'PAYLOAD_TOO_LARGE' });
      chunks.push(buffer);
    }
    let input;
    try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw Object.assign(new Error('json'), { code: 'INVALID_JSON' }); }
    runner = createInvocationRunner({ toolforgeRoot: path.resolve(import.meta.dirname, '../../..'), nodeExecutable: process.execPath, workspaceRoots });
    return await runner.invokeSkill(skillId, input);
  } catch (cause) { return invocationFailure(skillId, cause); }
  finally { await runner?.dispose(); }
}

// Keep this body independent of Node imports so dashboards can reuse it verbatim.
export function formatInvocationCommand(skillId, input, { nodeExecutable, scriptPath, workspaceRoots }) {
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  const argv = [scriptPath, '--skill', skillId, ...workspaceRoots.flatMap(root => ['--workspace-root', root])];
  return `& {
  if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7 or newer is required' }
  $toolforgeOutputEncoding = $OutputEncoding
  $toolforgeProcess = [System.Diagnostics.Process]::new()
  $toolforgeStarted = $false
  try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $toolforgeProcess.StartInfo.FileName = ${quote(nodeExecutable)}
    $toolforgeProcess.StartInfo.UseShellExecute = $false
    $toolforgeProcess.StartInfo.CreateNoWindow = $true
    $toolforgeProcess.StartInfo.RedirectStandardInput = $true
    $toolforgeProcess.StartInfo.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
${argv.map(value => `    $toolforgeProcess.StartInfo.ArgumentList.Add(${quote(value)})`).join('\n')}
    $toolforgeStarted = $toolforgeProcess.Start()
    $toolforgeProcess.StandardInput.Write(${quote(JSON.stringify(input))})
    $toolforgeProcess.StandardInput.Close()
    $toolforgeProcess.WaitForExit()
  } finally {
    try {
      if ($toolforgeStarted) {
        if (!$toolforgeProcess.HasExited) {
          try { $toolforgeProcess.Kill($true) }
          catch { if (!$toolforgeProcess.HasExited) { throw } }
        }
        $toolforgeProcess.WaitForExit()
        $global:LASTEXITCODE = $toolforgeProcess.ExitCode
      }
    } finally {
      try { $toolforgeProcess.Dispose() }
      finally { $OutputEncoding = $toolforgeOutputEncoding }
    }
  }
}`;
}

// Workers import this supervisor for envelopes; only direct execution reads stdin.
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const envelope = await runInvocationCli();
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
  process.exitCode = envelope.state !== 'completed' ? 2 : envelope.outcome === 'pass' ? 0 : 1;
}
