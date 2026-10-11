import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import vm from 'node:vm';
import * as api from '../src/invoke-skill.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scriptPath = path.join(root, 'skills/toolforge-cli/src/invoke-skill.mjs');
const agent = { agentName: ' agent ', expectedSchema: {}, actualSchema: {} };
const retro = { date: '2026-10-09', type: 'weekly', metrics: { unit_scale: 80, active_days: 5, commits_authored: 1, issues_closed: 0 }, sections: { wins: [], blockers: [], next: [] }, notes: '' };
const args = (id = 'agent-drift-detector', roots = [root]) => ['--skill', id, ...roots.flatMap(r => ['--workspace-root', r])];
function subprocess(executable, argv, chunks = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, { windowsHide: true, shell: false });
    const out = [], err = [];
    child.on('error', reject);
    child.stdout.on('data', c => out.push(c)); child.stderr.on('data', c => err.push(c));
    child.stdin.on('error', () => {});
    child.on('close', code => resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }));
    (async () => {
      for (const chunk of chunks) { child.stdin.write(chunk); await new Promise(r => setImmediate(r)); }
      child.stdin.end();
    })().catch(reject);
  });
}
async function cli(argv, chunks) {
  const result = await subprocess(process.execPath, [scriptPath, ...argv], chunks);
  assert.equal(result.stdout.trim().split('\n').length, 1);
  return { ...result, envelope: JSON.parse(result.stdout) };
}
function semantic(envelope) {
  const { durationMs, ...value } = envelope;
  if (value.result) { value.result = { ...value.result }; delete value.result.timestamp; }
  if (value.result?.data) { value.result.data = { ...value.result.data }; delete value.result.data.validated; }
  return value;
}
async function fixtures(t) {
  const dir = await fs.mkdtemp(path.join(root, '.pilot-cli-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const write = async (name, content) => { const file = path.join(dir, name); await fs.writeFile(file, content); return file; };
  return { dir, write };
}
test('CLI native parity for all pilots: pass, findings, and rejection; import stays idle', async t => {
  const { dir, write } = await fixtures(t);
  const good = await write('good.md', '# Roadmap\n<!-- SYNC:TOOLFORGE -->\nx\n<!-- END:SYNC -->');
  const bad = await write('bad.md', '# Missing');
  const json = await write('good.json', JSON.stringify(retro));
  const invalid = await write('bad.json', 'null');
  const runner = api.createInvocationRunner({ toolforgeRoot: root, nodeExecutable: process.execPath, workspaceRoots: [dir] });
  t.after(() => runner.dispose());
  for (const [id, inputs] of [
    ['agent-drift-detector', [agent, { ...agent, expectedSchema: { missing: 1 } }, { ...agent, unknown: 1 }]],
    ['roadmap-validator', [{ roadmapPath: good, verbose: true }, { roadmapPath: bad, strict: true }, { roadmapPath: path.join(dir, 'absent.md') }]],
    ['retro-schema-validator', [{ filePaths: [json] }, { filePaths: [invalid, json] }, { filePaths: [] }]],
  ]) for (const [index, input] of inputs.entries()) {
    const expected = await runner.invokeSkill(id, input);
    assert.equal(expected.state, index === 2 ? 'rejected' : 'completed', JSON.stringify(expected));
    if (index < 2) assert.equal(expected.outcome, index === 0 ? 'pass' : 'findings');
    const actual = await cli(args(id, [root, dir]), [JSON.stringify(input)]);
    assert.deepEqual(semantic(actual.envelope), semantic(expected));
    assert.equal(actual.code, expected.state !== 'completed' ? 2 : expected.outcome === 'pass' ? 0 : 1);
    assert.doesNotMatch(actual.stdout, /\[VALIDATOR\]/);
  }
  const imported = await subprocess(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../src/invoke-skill.mjs', import.meta.url).href)});`]);
  assert.equal(imported.code, 0); assert.equal(imported.stdout, ''); assert.equal(imported.stderr, '');
});
test('reject missing/unknown/duplicate args and arbitrary module/export selections', async () => {
  for (const argv of [[], ['--skill'], ['--workspace-root', root], ['--skill', 'unknown', '--workspace-root', root], args().concat('--entrypoint', 'x'), args().concat('--export', 'detectDrift'), args().concat('--skill', 'agent-drift-detector'), ['--skill', 'agent-drift-detector'], ['--skill', 'agent-drift-detector', '--workspace-root', 'relative'], args().concat('--workspace-root')]) {
    const result = await cli(argv, ['{}']);
    assert.equal(result.code, 2); assert.equal(result.envelope.state, 'rejected');
    assert.ok(['INVALID_INPUT', 'INVALID_TARGET'].includes(result.envelope.error.code));
  }
});
test('strict JSON object and UTF-8 decoding; raw byte cap includes whitespace, chunks and invalid bytes', async () => {
  for (const input of ['', '{', '{} {}', 'null', '[]', '"x"', '1', Buffer.from([0xff]), Buffer.from([0xe2, 0x82])]) {
    const actual = await cli(args(), [input]);
    assert.equal(actual.code, 2); assert.ok(['INVALID_JSON', 'INVALID_INPUT'].includes(actual.envelope.error.code));
  }
  const text = JSON.stringify({ ...agent, agentName: '\u00e9\u6f22\ud83d\ude80' });
  const bytes = Buffer.from(text);
  const valid = await cli(args(), Array.from(bytes, byte => Buffer.from([byte])));
  assert.equal(valid.envelope.state, 'completed', JSON.stringify(valid.envelope));
  assert.equal(valid.envelope.result.agentName, '\u00e9\u6f22\ud83d\ude80');
  const split = await api.runInvocationCli(args(), Readable.from(Array.from(bytes, byte => Buffer.from([byte]))));
  assert.equal(split.result.agentName, '\u00e9\u6f22\ud83d\ude80');
  const boundary = Buffer.concat([bytes, Buffer.alloc(65536 - bytes.length, 32)]);
  assert.equal((await cli(args(), [boundary])).code, 0);
  for (const chunks of [[boundary, Buffer.from(' ')], [Buffer.alloc(65537, 32)], [Buffer.alloc(65536, 32), Buffer.from([0xff])], [Buffer.from(JSON.stringify({ ...agent, expectedSchema: { x: '\u00e9'.repeat(33000) } }))]]) {
    const actual = await cli(args(), chunks);
    assert.equal(actual.code, 2); assert.equal(actual.envelope.error.code, 'PAYLOAD_TOO_LARGE');
  }
});
test('stdin errors use safe helper; unavailable runtime remains public envelope', async () => {
  assert.equal(typeof api.runInvocationCli, 'function');
  const broken = new Readable({ read() { this.destroy(new Error('private stdin detail')); } });
  const result = await api.runInvocationCli(args(), broken);
  assert.equal(result.error.code, 'WORKER_FAILED'); assert.doesNotMatch(JSON.stringify(result), /private/);
  const oldVersion = Object.getOwnPropertyDescriptor(process.versions, 'node');
  try {
    Object.defineProperty(process.versions, 'node', { value: '22.0.0', configurable: true });
    const unavailable = await api.runInvocationCli(args(), Readable.from([Buffer.from(JSON.stringify(agent))]));
    assert.equal(unavailable.error.code, 'RUNTIME_UNAVAILABLE');
  } finally { Object.defineProperty(process.versions, 'node', oldVersion); }
});
test('formatter body is portable and quotes every argument with compact JSON', () => {
  assert.equal(typeof api.formatInvocationCommand, 'function');
  const portable = vm.runInNewContext(`(${api.formatInvocationCommand.toString()})`, {});
  const options = { nodeExecutable: "C:/node's/node.exe", scriptPath: "C:/script's/invoke.mjs", workspaceRoots: ["C:/root's"] };
  const input = { ...agent, agentName: "O'Brien $x ` ; <html> \\ \" \u6f22" };
  const command = api.formatInvocationCommand('agent-drift-detector', input, options);
  assert.equal(portable('agent-drift-detector', input, options), command);
  for (const value of [options.nodeExecutable, options.scriptPath, '--skill', 'agent-drift-detector', '--workspace-root', options.workspaceRoots[0], JSON.stringify(input)]) assert.ok(command.includes(`'${value.replaceAll("'", "''")}'`));
  assert.doesNotMatch(command, /\bexit\b/i);
});
const pwsh = 'C:/Program Files/PowerShell/7/pwsh.exe';
const ps51 = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
function shell(executable, command) {
  return subprocess(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')]);
}
const quote = value => `'${value.replaceAll("'", "''")}'`;
test('actual pwsh Unicode/metacharacter data, semantic parity, native exits and encoding restoration', async t => {
  assert.equal(typeof api.formatInvocationCommand, 'function');
  const { dir, write } = await fixtures(t);
  const sentinel = path.join(dir, 'INJECTED');
  const hostile = `\u6f22\u00e9\ud83d\ude80 O'Brien \" \\ $env:PATH \` <html>; Set-Content -LiteralPath '${sentinel}' -Value injected; #`;
  const roadmapPath = await write("\u6f22 O'Brien $cash `tick.md", '# Roadmap\n<!-- SYNC:TOOLFORGE -->\nx\n<!-- END:SYNC -->');
  const runner = api.createInvocationRunner({ toolforgeRoot: root, nodeExecutable: process.execPath, workspaceRoots: [dir] });
  t.after(() => runner.dispose());
  for (const [id, input] of [['agent-drift-detector', { agentName: hostile, expectedSchema: { [hostile]: hostile }, actualSchema: { [hostile]: hostile } }], ['agent-drift-detector', { ...agent, actualSchema: { [hostile]: 1 } }], ['agent-drift-detector', {}], ['roadmap-validator', { roadmapPath, verbose: true }]]) {
    const command = api.formatInvocationCommand(id, input, { nodeExecutable: process.execPath, scriptPath, workspaceRoots: [dir] });
    const actual = await shell(pwsh, `$ErrorActionPreference='Stop'; $OutputEncoding=[System.Text.ASCIIEncoding]::new(); $before=$OutputEncoding; ${command}; $native=$LASTEXITCODE; [Console]::Error.WriteLine('CHECK:'+($OutputEncoding -eq $before)+':'+$native); exit $native`);
    const expected = await runner.invokeSkill(id, input);
    assert.deepEqual(semantic(JSON.parse(actual.stdout)), semantic(expected), actual.stderr);
    const code = expected.state !== 'completed' ? 2 : expected.outcome === 'pass' ? 0 : 1;
    assert.equal(actual.code, code); assert.match(actual.stderr, new RegExp(`CHECK:True:${code}`));
  }
  const failure = api.formatInvocationCommand('agent-drift-detector', agent, { nodeExecutable: process.execPath, scriptPath: path.join(dir, 'missing.mjs'), workspaceRoots: [dir] });
  const failed = await shell(pwsh, `$OutputEncoding=[System.Text.ASCIIEncoding]::new(); $before=$OutputEncoding; ${failure}; [Console]::Error.WriteLine('RESTORED:'+($OutputEncoding -eq $before)+':'+$LASTEXITCODE); exit $LASTEXITCODE`);
  assert.equal(failed.code, 1); assert.match(failed.stderr, /RESTORED:True:1/);
  const absent = api.formatInvocationCommand('agent-drift-detector', agent, { nodeExecutable: path.join(dir, 'missing.exe'), scriptPath, workspaceRoots: [dir] });
  const thrown = await shell(pwsh, `$ErrorActionPreference='Stop'; $global:LASTEXITCODE=23; $OutputEncoding=[System.Text.ASCIIEncoding]::new(); $before=$OutputEncoding; try { ${absent} } catch { [Console]::Error.WriteLine('CAUGHT:'+($_.Exception.GetBaseException().Message)) }; [Console]::Error.WriteLine('RESTORED:'+($OutputEncoding -eq $before)+':'+$global:LASTEXITCODE)`);
  assert.match(thrown.stderr, /CAUGHT:.*missing\.exe/); assert.match(thrown.stderr, /RESTORED:True:23/);
  assert.equal(await fs.stat(sentinel).catch(e => e.code), 'ENOENT');
});
test('actual Windows PowerShell 5.1 refuses before invoking Node', async t => {
  assert.equal(typeof api.formatInvocationCommand, 'function');
  const { dir, write } = await fixtures(t);
  const sentinel = path.join(dir, 'node-was-invoked');
  const probe = await write('probe.mjs', `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(sentinel)}, 'bad');`);
  const command = api.formatInvocationCommand('agent-drift-detector', agent, { nodeExecutable: process.execPath, scriptPath: probe, workspaceRoots: [dir] });
  const actual = await shell(ps51, `$ErrorActionPreference='Stop'; try { ${command}; exit 99 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 2 }`);
  assert.equal(actual.code, 2); assert.equal(actual.stdout, ''); assert.match(actual.stderr, /PowerShell 7/);
  assert.equal(await fs.stat(sentinel).catch(e => e.code), 'ENOENT');
});

test('actual pwsh quotes script, roots, and skill argument; JSON arrives byte-for-byte without BOM', async t => {
  const { dir, write } = await fixtures(t);
  const sentinel = path.join(dir, 'argument-injection');
  const hostile = `\u6f22 O'Brien \" \\ $x \` <tag>; Set-Content '${sentinel}' bad; #`;
  const probe = await write("\u6f22 O'Brien $cash `tick.mjs", `let chunks=[]; for await(const c of process.stdin) chunks.push(c); const b=Buffer.concat(chunks); console.log(JSON.stringify({args:process.argv.slice(2),raw:b.toString('utf8'),bom:b.subarray(0,3).equals(Buffer.from([239,187,191]))})); process.exitCode=1;`);
  const input = { agentName: hostile, expectedSchema: { [hostile]: hostile }, actualSchema: {} };
  const command = api.formatInvocationCommand(hostile, input, { nodeExecutable: process.execPath, scriptPath: probe, workspaceRoots: [dir, hostile] });
  const actual = await shell(pwsh, `${command}; exit $LASTEXITCODE`);
  assert.equal(actual.code, 1, actual.stderr);
  const received = JSON.parse(actual.stdout);
  assert.deepEqual(received.args, ['--skill', hostile, '--workspace-root', dir, '--workspace-root', hostile]);
  assert.equal(received.raw, JSON.stringify(input)); assert.equal(received.bom, false);
  assert.equal(await fs.stat(sentinel).catch(e => e.code), 'ENOENT');
});

test('actual generated pwsh command preserves inclusive raw UTF-8 boundary and native parity', async t => {
  const { dir } = await fixtures(t);
  const runner = api.createInvocationRunner({ toolforgeRoot: root, nodeExecutable: process.execPath, workspaceRoots: [dir] });
  t.after(() => runner.dispose());
  for (const size of [65535, 65536, 65537]) {
    const input = { agentName: "\u6f22 O'Brien $x ` \\ \" <tag>", expectedSchema: { x: '\u00e9' }, actualSchema: { x: 0 } };
    input.expectedSchema.x += 'a'.repeat(size - Buffer.byteLength(JSON.stringify(input)));
    const json = JSON.stringify(input);
    assert.equal(Buffer.byteLength(json), size);
    const command = api.formatInvocationCommand('agent-drift-detector', input, { nodeExecutable: process.execPath, scriptPath, workspaceRoots: [dir] });
    // ASCII bootstrap avoids both Windows' argv limit and shell source code-page decoding.
    const bootstrap = '& ([scriptblock]::Create([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd()))))';
    const source = `$ErrorActionPreference='Stop'; $OutputEncoding=[System.Text.ASCIIEncoding]::new(); $before=$OutputEncoding\n${command}\n\n$native=$LASTEXITCODE; [Console]::Error.WriteLine('BOUNDARY:'+($OutputEncoding -eq $before)+':'+$native); exit $native\n`;
    const actual = await subprocess(pwsh, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(bootstrap, 'utf16le').toString('base64')], [Buffer.from(source, 'utf8').toString('base64')]);
    const expected = await runner.invokeSkill('agent-drift-detector', input);
    const direct = await cli(args('agent-drift-detector', [dir]), [json]);
    assert.equal(expected.state, size <= 65536 ? 'completed' : 'rejected');
    assert.deepEqual(semantic(direct.envelope), semantic(expected));
    assert.deepEqual(semantic(JSON.parse(actual.stdout)), semantic(expected), actual.stderr);
    assert.equal(actual.code, size <= 65536 ? 0 : 2);
    assert.match(actual.stderr, new RegExp(`BOUNDARY:True:${actual.code}`));
  }
});

test('formatter finally terminates and disposes its own child after a post-start exception', async t => {
  const { dir, write } = await fixtures(t);
  const probe = await write('waiting.mjs', 'setInterval(() => {}, 1000);');
  const command = api.formatInvocationCommand('agent-drift-detector', agent, { nodeExecutable: process.execPath, scriptPath: probe, workspaceRoots: [dir] });
  const interrupted = command.replace('$toolforgeProcess.StandardInput.Write(', "$global:toolforgeTestChildId = $toolforgeProcess.Id; $global:toolforgeTestProcess = $toolforgeProcess; throw 'post-start failure'; $toolforgeProcess.StandardInput.Write(");
  assert.notEqual(interrupted, command);
  const actual = await shell(pwsh, `$ErrorActionPreference='Stop'; $OutputEncoding=[System.Text.ASCIIEncoding]::new(); $before=$OutputEncoding; try { ${interrupted} } catch { [Console]::Error.WriteLine('CAUGHT:'+($_.Exception.Message)) }; $alive=Get-Process -Id $global:toolforgeTestChildId -ErrorAction SilentlyContinue; [Console]::Error.WriteLine('CLEANUP:'+($null -eq $alive)+':'+($OutputEncoding -eq $before)); try { $null=$global:toolforgeTestProcess.WaitForExit(0); throw 'process still associated' } catch { [Console]::Error.WriteLine('DISPOSED:'+($_.Exception.Message -ne 'process still associated')) }; if ($alive) { Stop-Process -Id $alive.Id; exit 1 }`);
  assert.equal(actual.code, 0, actual.stderr);
  assert.match(actual.stderr, /CAUGHT:post-start failure/);
  assert.match(actual.stderr, /CLEANUP:True:True/);
  assert.match(actual.stderr, /DISPOSED:True/);
  assert.equal(actual.stdout, '');
});

test('large input with actual early Node exit 1 preserves native failure after stdin throws', async t => {
  const { dir } = await fixtures(t);
  const input = { agentName: 'agent', expectedSchema: { x: '' }, actualSchema: { x: 0 } };
  input.expectedSchema.x = 'a'.repeat(65536 - Buffer.byteLength(JSON.stringify(input)));
  assert.equal(Buffer.byteLength(JSON.stringify(input)), 65536);
  const command = api.formatInvocationCommand('agent-drift-detector', input, { nodeExecutable: process.execPath, scriptPath: path.join(dir, 'missing.mjs'), workspaceRoots: [dir] });
  const observed = command.replace('$toolforgeStarted = $toolforgeProcess.Start()', '$toolforgeStarted = $toolforgeProcess.Start()\n    $global:toolforgeTestChildId = $toolforgeProcess.Id\n    $global:toolforgeTestProcess = $toolforgeProcess');
  assert.notEqual(observed, command);
  const bootstrap = '& ([scriptblock]::Create([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd()))))';
  for (const prior of [0, 23]) {
    const source = `$ErrorActionPreference='Stop'; $global:LASTEXITCODE=${prior}; $OutputEncoding=[System.Text.ASCIIEncoding]::new(); $before=$OutputEncoding; $caught=$false; try { ${observed} } catch { $caught=$true; [Console]::Error.WriteLine('WRITE_ERROR:'+($_.Exception.GetBaseException().Message)) }; $native=$global:LASTEXITCODE; $alive=Get-Process -Id $global:toolforgeTestChildId -ErrorAction SilentlyContinue; [Console]::Error.WriteLine('EARLY:${prior}:'+($OutputEncoding -eq $before)+':'+$native+':'+$caught+':'+($null -eq $alive)); try { $null=$global:toolforgeTestProcess.WaitForExit(0); throw 'process still associated' } catch { [Console]::Error.WriteLine('DISPOSED:'+($_.Exception.Message -ne 'process still associated')) }; if ($alive) { Stop-Process -Id $alive.Id }; exit $native`;
    const actual = await subprocess(pwsh, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(bootstrap, 'utf16le').toString('base64')], [Buffer.from(source, 'utf8').toString('base64')]);
    assert.match(actual.stderr, /MODULE_NOT_FOUND/);
    assert.match(actual.stderr, /WRITE_ERROR:.*pipe/i);
    assert.match(actual.stderr, new RegExp(`EARLY:${prior}:True:1:True:True`));
    assert.match(actual.stderr, /DISPOSED:True/);
    assert.equal(actual.code, 1, actual.stderr);
    assert.equal(actual.stdout, '');
  }
});
