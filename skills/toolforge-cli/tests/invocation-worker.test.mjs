import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import { createInvocationRunner, invocationFailure, MAX_WORKER_FRAMING_BYTES, MAX_WORKER_REQUEST_BYTES } from '../src/invoke-skill.mjs';
import { MAX_INPUT_BYTES } from '../src/invocation-contracts.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const context = { toolforgeRoot: root, nodeExecutable: process.execPath };
const agent = { agentName: ' agent ', expectedSchema: {}, actualSchema: {} };
const retro = { date: '2026-10-09', type: 'weekly', metrics: { unit_scale: 80, active_days: 5, commits_authored: 1, issues_closed: 0 }, sections: { wins: [], blockers: [], next: [] }, notes: '' };
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(root, '.pilot-worker-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const runner = createInvocationRunner({ ...context, workspaceRoots: [dir] });
  t.after(() => runner.dispose());
  const write = async (name, text) => { const file = path.join(dir, name); await fs.writeFile(file, text); return file; };
  return { dir, runner, write };
}
async function snapshot(dir) {
  const names = (await fs.readdir(dir)).sort();
  return Promise.all(names.map(async name => [name, createHash('sha256').update(await fs.readFile(path.join(dir, name))).digest('hex')]));
}

test('reviewed subprocess exception retains fixed shell-free worker boundary', async t => {
  const { runner } = await fixture(t);
  const originalSpawn = childProcess.spawn;
  const launches = [];
  childProcess.spawn = (executable, args, options) => {
    launches.push({ executable, args, options });
    return originalSpawn(executable, args, options);
  };
  syncBuiltinESMExports();
  t.after(() => { childProcess.spawn = originalSpawn; syncBuiltinESMExports(); });
  const result = await runner.invokeSkill('agent-drift-detector', agent);
  assert.equal(result.state, 'completed');
  assert.equal(launches.length, 1);
  const { executable, args, options } = launches[0];
  assert.equal(executable, process.execPath);
  assert.equal(args.at(-1), path.join(root, 'skills/toolforge-cli/src/invocation-worker.mjs'));
  assert.ok(args.includes('--permission'));
  assert.ok(args.includes('--experimental-strip-types'));
  assert.ok(args.slice(2, -1).every(arg => arg.startsWith('--allow-fs-read=')));
  assert.equal(options.shell, false);
  assert.equal(options.detached, false);
  assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']);
  assert.ok(Object.keys(options.env).every(key => ['SystemRoot', 'WINDIR', 'TEMP', 'TMP'].includes(key)));
  const source = await fs.readFile(path.join(root, 'skills/toolforge-cli/src/invoke-skill.mjs'), 'utf8');
  assert.match(source.split('\n')[0], /noqa: SEC-AUDITOR.*fixed Node worker.*shell:false/);
});

test('real handlers under production flags retain native results and never write or contact loopback', async t => {
  const { dir, runner, write } = await fixture(t);
  const guard = await write('network-guard.mjs', `
    import net from 'node:net'; import http from 'node:http'; import https from 'node:https'; import tls from 'node:tls'; import dns from 'node:dns'; import dnp from 'node:dns/promises'; import dgram from 'node:dgram'; import {syncBuiltinESMExports} from 'node:module';
    const denied=()=>{process.stderr.write('NETWORK_ATTEMPT'); throw new Error('Network attempt');};
    globalThis.fetch=denied;
    for(const api of [net,http,https,tls,dns,dnp,dgram]) for(const name of ['connect','createConnection','request','get','lookup','resolve','resolve4','resolve6','createSocket']) if(typeof api[name]==='function') api[name]=denied;
    net.Socket.prototype.connect=denied; syncBuiltinESMExports();
  `);
  const originalSpawn = childProcess.spawn;
  let diagnostics = '';
  childProcess.spawn = (executable, args, options) => {
    const child = originalSpawn(executable, [...args.slice(0, -1), `--allow-fs-read=${guard}`, '--import', pathToFileURL(guard).href, args.at(-1)], options);
    child.stderr.on('data', chunk => { diagnostics += chunk.toString(); });
    return child;
  };
  syncBuiltinESMExports();
  t.after(() => { childProcess.spawn = originalSpawn; syncBuiltinESMExports(); });
  let connections = 0;
  const listener = net.createServer(socket => { connections++; socket.destroy(); });
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const address = `http://127.0.0.1:${listener.address().port}/`;
  const good = await write('good.md', `# Roadmap\n<!-- SYNC:TOOLFORGE -->\n${address}\n<!-- END:SYNC -->`);
  const missing = await write('missing.md', '# Missing');
  const reversed = await write('reversed.md', '# Reversed\n<!-- END:SYNC -->\nx\n<!-- SYNC:TOOLFORGE -->');
  const jsons = [];
  for (const [i, value] of [retro, { ...retro, extra: address }, {}, null, [], 'x', 1, true, false].entries()) jsons.push(await write(`${i}.json`, JSON.stringify(value)));
  jsons.push(await write('bad.json', '{broken'));
  const before = await snapshot(dir);
  for (const [roadmapPath, strict, expected] of [[good, false, 'pass'], [missing, false, 'findings'], [reversed, false, 'findings'], [missing, true, 'findings']]) {
    const result = await runner.invokeSkill('roadmap-validator', { roadmapPath, strict, verbose: true });
    assert.equal(result.state, 'completed', JSON.stringify(result) + diagnostics);
    assert.equal(result.outcome, expected);
    assert.equal(Object.hasOwn(result.result, 'data'), !strict);
  }
  for (const input of [agent, { ...agent, expectedSchema: { missing: address } }, { ...agent, actualSchema: { extra: 1 } }]) {
    const result = await runner.invokeSkill('agent-drift-detector', input);
    assert.equal(result.state, 'completed', JSON.stringify(result));
    assert.equal(result.result.agentName, 'agent');
    assert.equal(result.outcome, input === agent ? 'pass' : 'findings');
  }
  for (const file of jsons) {
    const result = await runner.invokeSkill('retro-schema-validator', { filePaths: [file] });
    assert.equal(result.state, 'completed', JSON.stringify(result));
    assert.equal(result.outcome, file === jsons[0] ? 'pass' : 'findings');
  }
  const ordered = await runner.invokeSkill('retro-schema-validator', { filePaths: jsons.slice(1).reverse() });
  assert.deepEqual([...new Set(ordered.result.violations.map(v => v.file))], jsons.slice(1).reverse());
  assert.deepEqual(await snapshot(dir), before);
  assert.equal(connections, 0);
  assert.doesNotMatch(diagnostics, /NETWORK_ATTEMPT/);
  assert.match(diagnostics, /\[VALIDATOR\] Validating/);
  assert.match(diagnostics, /MODULE_TYPELESS_PACKAGE_JSON/);
});

test('safe input/runtime errors and already-aborted requests spawn nothing', async t => {
  const { runner } = await fixture(t);
  const controller = new AbortController(); controller.abort();
  assert.equal((await runner.invokeSkill('agent-drift-detector', agent, { signal: controller.signal })).state, 'cancelled');
  for (const [id, input, code] of [['unknown', {}, 'INVALID_TARGET'], ['agent-drift-detector', { ...agent, unexpected: 1 }, 'INVALID_INPUT'], ['agent-drift-detector', { ...agent, expectedSchema: { large: 'x'.repeat(65536) } }, 'PAYLOAD_TOO_LARGE']]) {
    const result = await runner.invokeSkill(id, input);
    assert.equal(result.state, 'rejected'); assert.equal(result.error.code, code);
    assert.equal(result.skillId, id === 'unknown' ? null : id);
  }
  assert.equal((await runner.invokeSkill(['agent-drift-detector'], agent)).error.code, 'INVALID_TARGET');
  assert.equal(invocationFailure(null, { code: 'toString' }).error.code, 'WORKER_FAILED');
  const unavailable = createInvocationRunner({ ...context, nodeExecutable: 'C:/missing-node.exe' });
  t.after(() => unavailable.dispose());
  assert.equal((await unavailable.invokeSkill('agent-drift-detector', agent)).error.code, 'RUNTIME_UNAVAILABLE');
  for (const [privateCode, publicCode] of [['INVALID_CONTEXT', 'RUNTIME_UNAVAILABLE'], ['REGISTRY_DRIFT', 'SOURCE_DRIFT'], ['INPUT_TOO_LARGE', 'PAYLOAD_TOO_LARGE'], ['INVALID_RESULT', 'WORKER_FAILED'], ['SKILL_ERROR', 'WORKER_FAILED']]) assert.equal(invocationFailure('agent-drift-detector', { code: privateCode, message: 'private' }).error.code, publicCode);
});

// Trusted test harness intercepts spawn; invocation input cannot select fixtures.
async function withWorker(t, source, run) {
  const { dir, runner, write } = await fixture(t);
  const worker = await write('fixture.mjs', source);
  const original = childProcess.spawn;
  let spawned = 0;
  let diagnostics = '';
  childProcess.spawn = (executable, args, options) => {
    spawned++;
    assert.ok(path.isAbsolute(executable));
    assert.equal(options.shell, false); assert.equal(options.detached, false);
    assert.ok(args.includes('--permission')); assert.ok(args.includes('--experimental-strip-types'));
    assert.deepEqual(Object.keys(options.env).filter(k => !['SystemRoot', 'WINDIR', 'TEMP', 'TMP'].includes(k)), []);
    assert.ok(args.filter(a => a.startsWith('--allow-fs-read=')).every(a => !a.endsWith(dir) && !a.endsWith(root)));
    const child = original(executable, [...args.slice(0, -1), `--allow-fs-read=${worker}`, worker], options);
    child.stderr.on('data', chunk => { if (diagnostics.length < 4096) diagnostics += chunk.toString(); });
    return child;
  };
  syncBuiltinESMExports();
  try { await run(runner, () => spawned, dir); }
  catch (error) { console.error(`Fixture stderr: ${diagnostics}`); throw error; }
  finally { childProcess.spawn = original; syncBuiltinESMExports(); }
}
const readRequest = 'let raw=""; for await (const c of process.stdin) raw+=c; const request=JSON.parse(raw);';
const completed = 'const result={agentName:"agent",driftDetected:false,missingFields:[],extraFields:[],recommendations:["Schema is aligned"]}; const envelope={contractVersion:1,skillId:request.skillId,state:"completed",outcome:"pass",result,error:null,durationMs:0};';

test('protocol, exit, exception and combined output limits fail and recover', async t => {
  for (const body of ['process.exit(3);', 'throw new Error("private detail");', 'process.stdout.write("garbage");', `${completed} envelope.contractVersion=2; process.stdout.write(JSON.stringify(envelope));`, `${completed} envelope.result={}; process.stdout.write(JSON.stringify(envelope));`, `${completed} envelope.outcome="findings"; process.stdout.write(JSON.stringify(envelope));`, `${completed} process.stdout.write(JSON.stringify(envelope)+"\\nextra");`, `${completed} envelope.result.agentName="PLACEHOLDER"; process.stdout.write(Buffer.concat([Buffer.from(JSON.stringify(envelope).split('PLACEHOLDER')[0]),Buffer.from([255]),Buffer.from(JSON.stringify(envelope).split('PLACEHOLDER')[1])]));`, 'process.stderr.write("x".repeat(131073));', 'process.stdout.write("x".repeat(131073));']) {
    await withWorker(t, `${readRequest}${body}`, async runner => {
      const result = await runner.invokeSkill('agent-drift-detector', agent);
      assert.equal(result.state, 'failed', JSON.stringify(result)); assert.equal(result.error.code, 'WORKER_FAILED');
      assert.doesNotMatch(JSON.stringify(result), /private detail/);
      const recovered = await runner.invokeSkill('agent-drift-detector', agent);
      assert.equal(recovered.state, 'failed'); assert.notEqual(recovered.error.code, 'BUSY');
    });
  }
  const { runner } = await fixture(t);
  assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, 'completed');
});

test('exact combined output cap accepts boundary and rejects one extra byte', async t => {
  for (const extra of [0, 1]) await withWorker(t, `${readRequest}${completed}const output=JSON.stringify(envelope); process.stderr.write('x'.repeat(131072-Buffer.byteLength(output)+${extra})); process.stdout.write(output);`, async runner => {
    assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, extra ? 'failed' : 'completed');
  });
});

function sizedExternal(bytes, httpEnvelope = false) {
  const value = { ...agent, agentName: 'agent', expectedSchema: { large: '' } };
  const external = httpEnvelope ? { skillId: 'agent-drift-detector', input: value } : value;
  value.expectedSchema.large = 'x'.repeat(bytes - Buffer.byteLength(JSON.stringify(external)));
  const raw = JSON.stringify(external);
  assert.equal(Buffer.byteLength(raw), bytes);
  return raw;
}

test('raw CLI-equivalent 65536-byte input survives framing; 65537 rejects', async t => {
  const { dir, runner } = await fixture(t);
  const differingRoots = createInvocationRunner({ ...context, workspaceRoots: [root, dir, root, dir] });
  t.after(() => differingRoots.dispose());
  for (const instance of [runner, differingRoots]) {
    const accepted = await instance.invokeSkill('agent-drift-detector', JSON.parse(sizedExternal(MAX_INPUT_BYTES)));
    assert.equal(accepted.state, 'completed', JSON.stringify(accepted));
    const rejected = await instance.invokeSkill('agent-drift-detector', JSON.parse(sizedExternal(MAX_INPUT_BYTES + 1)));
    assert.equal(rejected.state, 'rejected'); assert.equal(rejected.error.code, 'PAYLOAD_TOO_LARGE');
  }
});

test('HTTP-envelope-shaped 65536-byte body survives framing; external 65537 rejects', async t => {
  const { runner, dir } = await fixture(t);
  const differingRoots = createInvocationRunner({ ...context, workspaceRoots: [root, dir, root, dir] });
  t.after(() => differingRoots.dispose());
  // Test-only admission model: no HTTP route exists until Task4.
  async function admit(instance, raw) {
    if (Buffer.byteLength(raw) > MAX_INPUT_BYTES) return invocationFailure(null, { code: 'PAYLOAD_TOO_LARGE' });
    const body = JSON.parse(raw);
    return instance.invokeSkill(body.skillId, body.input);
  }
  for (const instance of [runner, differingRoots]) {
    assert.equal((await admit(instance, sizedExternal(MAX_INPUT_BYTES, true))).state, 'completed');
    const rejected = await admit(instance, sizedExternal(MAX_INPUT_BYTES + 1, true));
    assert.equal(rejected.state, 'rejected'); assert.equal(rejected.error.code, 'PAYLOAD_TOO_LARGE');
  }
});

test('exact 4096-byte trusted framing accepts full input; one byte more is unavailable', async t => {
  const { dir } = await fixture(t);
  const canonicalRoot = await fs.realpath(root), canonicalDir = await fs.realpath(dir);
  const roots = [];
  const framing = workspaceRoots => Buffer.byteLength(JSON.stringify({ contractVersion: 1, skillId: 'agent-drift-detector', input: null, context: { toolforgeRoot: canonicalRoot, workspaceRoots, nodeExecutable: process.execPath } })) - 4;
  const basePath = path.join(canonicalDir, 'x');
  while (MAX_WORKER_FRAMING_BYTES - framing([...roots, basePath]) > 200) roots.push(canonicalDir);
  const suffixLength = MAX_WORKER_FRAMING_BYTES - framing([...roots, basePath]) + 1;
  assert.equal(MAX_WORKER_FRAMING_BYTES, 4096); assert.equal(MAX_WORKER_REQUEST_BYTES, 69632);
  for (const extra of [0, 1]) {
    const paddedRoot = path.join(canonicalDir, 'x'.repeat(suffixLength + extra));
    await fs.mkdir(paddedRoot);
    const workspaceRoots = [...roots, await fs.realpath(paddedRoot)];
    assert.equal(framing(workspaceRoots), MAX_WORKER_FRAMING_BYTES + extra);
    const runner = createInvocationRunner({ ...context, workspaceRoots });
    t.after(() => runner.dispose());
    for (const input of [agent, JSON.parse(sizedExternal(MAX_INPUT_BYTES))]) {
      const result = await runner.invokeSkill('agent-drift-detector', input);
      assert.equal(result.state, extra ? 'unavailable' : 'completed', JSON.stringify(result));
      if (extra) assert.equal(result.error.code, 'RUNTIME_UNAVAILABLE');
    }
  }
});

test('worker independently enforces input and trusted framing limits', async t => {
  const { runner, dir } = await fixture(t);
  const original = childProcess.spawn;
  for (const [tamper, expected] of [[request => { request.input = JSON.parse(sizedExternal(MAX_INPUT_BYTES + 1)); }, 'PAYLOAD_TOO_LARGE'], [request => { request.context.workspaceRoots = Array(100).fill(dir); }, 'RUNTIME_UNAVAILABLE']]) {
    childProcess.spawn = (executable, args, options) => {
      const child = original(executable, args, options);
      const end = child.stdin.end.bind(child.stdin);
      child.stdin.end = raw => { const request = JSON.parse(raw); tamper(request); return end(JSON.stringify(request)); };
      return child;
    };
    syncBuiltinESMExports();
    try {
      const result = await runner.invokeSkill('agent-drift-detector', agent);
      assert.equal(result.error.code, expected);
    } finally { childProcess.spawn = original; syncBuiltinESMExports(); }
  }
});

test('worker internal wire cap accepts 69632 bytes and rejects 69633', async t => {
  const { runner } = await fixture(t);
  const original = childProcess.spawn;
  for (const extra of [0, 1]) {
    childProcess.spawn = (executable, args, options) => {
      const child = original(executable, args, options);
      const end = child.stdin.end.bind(child.stdin);
      child.stdin.end = raw => end(raw + ' '.repeat(MAX_WORKER_REQUEST_BYTES - Buffer.byteLength(raw) + extra));
      return child;
    };
    syncBuiltinESMExports();
    try { assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, extra ? 'failed' : 'completed'); }
    finally { childProcess.spawn = original; syncBuiltinESMExports(); }
  }
});

test('imports never launch', async () => {
  const original = childProcess.spawn;
  childProcess.spawn = () => { throw new Error('Import launched child'); }; syncBuiltinESMExports();
  try {
    await import('../src/invoke-skill.mjs?import-only');
    await import('../src/invocation-worker.mjs?import-only');
  } finally { childProcess.spawn = original; syncBuiltinESMExports(); }
});

test('abort/dispose/exit races close each worker; runner instances own separate slots', async t => {
  await withWorker(t, `${readRequest}${completed}setTimeout(()=>process.stdout.write(JSON.stringify(envelope)),100);`, async runner => {
    const separate = createInvocationRunner(context); t.after(() => separate.dispose());
    const abort = new AbortController();
    const a = runner.invokeSkill('agent-drift-detector', agent, { signal: abort.signal });
    const b = runner.invokeSkill('agent-drift-detector', agent);
    const c = separate.invokeSkill('agent-drift-detector', agent);
    setTimeout(() => abort.abort(), 100);
    assert.ok(['completed', 'cancelled'].includes((await a).state));
    assert.equal((await b).state, 'completed'); assert.equal((await c).state, 'completed');
    assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, 'completed');
    const d = runner.invokeSkill('agent-drift-detector', agent, { signal: abort.signal });
    await Promise.all([runner.dispose(), runner.dispose()]);
    assert.equal((await d).state, 'cancelled');
  });
});

test('deadline, BUSY, cancellation and dispose await exit before slot recovery', async t => {
  await withWorker(t, `${readRequest}setInterval(()=>{},1000);`, async (runner, count) => {
    const already = new AbortController(); already.abort();
    await runner.invokeSkill('agent-drift-detector', agent, { signal: already.signal }); assert.equal(count(), 0);
    const abort = new AbortController();
    const a = runner.invokeSkill('agent-drift-detector', agent, { signal: abort.signal });
    const b = runner.invokeSkill('agent-drift-detector', agent);
    const busy = await runner.invokeSkill('agent-drift-detector', agent);
    assert.equal(busy.error.code, 'BUSY');
    setTimeout(() => abort.abort(), 150);
    assert.equal((await a).state, 'cancelled');
    const start = Date.now();
    assert.equal((await b).state, 'timed_out'); assert.ok(Date.now() - start > 4500);
    const c = runner.invokeSkill('agent-drift-detector', agent);
    await new Promise(resolve => setTimeout(resolve, 100));
    await runner.dispose();
    assert.equal((await c).state, 'cancelled');
    assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, 'cancelled');
  });
});

test('production permissions deny write, child, threads, native, WASI and unrelated reads', async t => {
  await withWorker(t, `${readRequest}
    import fs from 'node:fs'; import cp from 'node:child_process'; import {Worker} from 'node:worker_threads';
    const probes=[()=>fs.writeFileSync(request.context.toolforgeRoot+'/permission-sentinel','x'),()=>fs.readFileSync(request.context.toolforgeRoot+'/README.md'),()=>cp.spawn(process.execPath,['-e','']),()=>new Worker('',{eval:true}),()=>process.dlopen({exports:{}},'missing.node'),async()=>{const {WASI}=await import('node:wasi'); return new WASI({version:'preview1'});}];
    for(const probe of probes) {try {await probe(); process.stdout.write('permission escaped'); process.exit(3);} catch(e) {if(!['ERR_ACCESS_DENIED','ERR_DLOPEN_DISABLED'].includes(e.code)) throw e;}}
    ${completed} process.stdout.write(JSON.stringify(envelope));`, async runner => {
    assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, 'completed');
  });
  await assert.rejects(fs.stat(path.join(root, 'permission-sentinel')), e => e.code === 'ENOENT');
});

async function copiedInstallation(t) {
  const { dir } = await fixture(t);
  const anchor = JSON.parse(await fs.readFile(path.join(root, 'skills/toolforge-cli/src/invocation-reviewed.json')));
  const copy = path.join(dir, 'install');
  for (const relative of [...Object.keys(anchor.files), 'skills/toolforge-cli/src/invocation-reviewed.json']) {
    const target = path.join(copy, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(root, relative), target);
  }
  const runner = createInvocationRunner({ ...context, toolforgeRoot: copy, workspaceRoots: [dir] });
  t.after(() => runner.dispose());
  return { copy, runner, anchor, dir };
}

test('parent source drift blocks imports; independent worker catches post-inspection hash and input drift', async t => {
  const { copy, runner, dir } = await copiedInstallation(t);
  for (const relative of ['skills/agent-drift-detector/src/index.ts', 'skills/toolforge-cli/src/invocation-worker.mjs', 'skills/toolforge-cli/src/invoke-skill.mjs', 'skills/toolforge-cli/src/invocation-contracts.mjs', 'skills/toolforge-cli/SKILL.json', 'skills/agent-drift-detector/package.json']) {
    const target = path.join(copy, relative), original = await fs.readFile(target);
    await fs.appendFile(target, '\n/* source drift */');
    assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).error.code, 'SOURCE_DRIFT', relative);
    await fs.writeFile(target, original);
  }
  const originalSpawn = childProcess.spawn;
  const target = path.join(copy, 'skills/agent-drift-detector/src/index.ts');
  const original = await fs.readFile(target);
  childProcess.spawn = (executable, args, options) => {
    fsSync.appendFileSync(target, '\nthrow new Error("unreviewed handler executed");');
    return originalSpawn(executable, args, options);
  };
  syncBuiltinESMExports();
  try { assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).error.code, 'SOURCE_DRIFT'); }
  finally { childProcess.spawn = originalSpawn; syncBuiltinESMExports(); await fs.writeFile(target, original); }
  const roadmapPath = path.join(dir, 'selected.md'); await fs.writeFile(roadmapPath, '# Readable');
  childProcess.spawn = (executable, args, options) => {
    // Replace stdin in trusted harness after parent validation, preserving deployed flags.
    const child = originalSpawn(executable, args, options);
    const end = child.stdin.end.bind(child.stdin);
    child.stdin.end = raw => { const request = JSON.parse(raw); request.input.roadmapPath = path.join(dir, '..', 'escape.md'); return end(JSON.stringify(request)); };
    return child;
  };
  syncBuiltinESMExports();
  try { assert.equal((await runner.invokeSkill('roadmap-validator', { roadmapPath })).error.code, 'INVALID_INPUT'); }
  finally { childProcess.spawn = originalSpawn; syncBuiltinESMExports(); }
  assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, 'completed');
});

test('reviewed test-only handlers with missing export/import, exception, or malformed result fail safely', async t => {
  const { copy, runner, anchor } = await copiedInstallation(t);
  const relative = 'skills/agent-drift-detector/src/index.ts';
  const target = path.join(copy, relative);
  const anchorPath = path.join(copy, 'skills/toolforge-cli/src/invocation-reviewed.json');
  const original = await fs.readFile(target), originalAnchor = await fs.readFile(anchorPath);
  const originalSpawn = childProcess.spawn;
  for (const source of ['export const wrongExport=1;', 'import "./unreviewed.mjs";', 'export function detectDrift(){throw new Error("private handler detail");}', 'export function detectDrift(){return {}; }']) {
    childProcess.spawn = (executable, args, options) => {
      fsSync.writeFileSync(target, source);
      fsSync.writeFileSync(anchorPath, JSON.stringify({ ...anchor, files: { ...anchor.files, [relative]: createHash('sha256').update(source).digest('hex') } }));
      return originalSpawn(executable, args, options);
    };
    syncBuiltinESMExports();
    try {
      const result = await runner.invokeSkill('agent-drift-detector', agent);
      assert.equal(result.state, 'failed'); assert.equal(result.error.code, 'WORKER_FAILED');
      assert.doesNotMatch(JSON.stringify(result), /private handler detail/);
    } finally {
      childProcess.spawn = originalSpawn; syncBuiltinESMExports();
      await fs.writeFile(target, original); await fs.writeFile(anchorPath, originalAnchor);
    }
  }
  assert.equal((await runner.invokeSkill('agent-drift-detector', agent)).state, 'completed');
});
