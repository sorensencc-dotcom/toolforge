# Pilot usage and troubleshooting

Verified behavior and delivery limits: [pilot acceptance](acceptance.md).

This native Toolforge pilot invokes three reviewed local handlers. The existing
PowerShell marketplace CLI uses its separate interface and runtime requirements.

## Invoke a pilot

1. Use installed Node major 24 and PowerShell 7 or newer for clipboard commands.
2. Select explicit input files inside an existing absolute workspace root. Select
   only disposable fixtures when verifying behavior. Do not select directories.
3. Build an input object for a supported pilot. Roadmap accepts `roadmapPath`,
   optional `strict`, and optional `verbose`. Agent accepts `agentName`,
   `expectedSchema`, and `actualSchema`. Retro accepts `filePaths` with 1-32 distinct
   JSON files, in the desired order. No unknown fields or implicit coercion.
4. Send exactly one strict UTF-8 JSON object through stdin to:

```text
node <toolforge-root>/skills/toolforge-cli/src/invoke-skill.mjs --skill <pilot-id> --workspace-root <absolute-root>
```

Repeat `--workspace-root` for additional trusted roots. No `--entrypoint`,
`--export`, positional input, directory scan, or `--all` option exists.

5. Read the single JSON result envelope on stdout. Exit code 0 means completed/pass;
   1 means completed/findings; 2 means any other state. Findings are validation
   results, not runtime failures. Read `$LASTEXITCODE` after copied commands.

Example Agent input:

```json
{"agentName":"example","expectedSchema":{"status":"string"},"actualSchema":{"status":"success"}}
```

Agent compares top-level field names, not nested types or JSON Schema. Roadmap and
Retro retain native validation rules, result fields, and optional omissions.

## Shared API and clipboard text

```javascript
import { createInvocationRunner, formatInvocationCommand } from './src/invoke-skill.mjs';
const context = { toolforgeRoot, nodeExecutable, workspaceRoots };
const runner = createInvocationRunner(context);
try {
  const metadata = await runner.inspectInvocation('agent-drift-detector');
  const envelope = await runner.invokeSkill('agent-drift-detector', input, { signal });
} finally {
  await runner.dispose();
}
const command = formatInvocationCommand('agent-drift-detector', normalizedInput, {
  nodeExecutable, scriptPath, workspaceRoots,
});
```

Context comes from the trusted host. `scriptPath` selects this installed CLI.
Validate/normalize input through the shared contract before preparing clipboard
text. The formatter serializes supplied input; it performs no filesystem/runtime
validation and references no Node imports or surrounding helpers. Browser consumers
can reuse its literal function body and compare outputs in parity tests. Importing
the Node module in a browser is unsupported; Node imports remain parent-side.

Copied text runs within a scriptblock. It rejects PowerShell major versions below
7 before Node, starts `System.Diagnostics.Process` with `UseShellExecute=false`,
and supplies single-quoted literal paths/arguments through `ArgumentList`.
`RedirectStandardInput=true` and explicit BOM-less UTF-8 `StandardInputEncoding`
send compact single-quoted JSON through `StandardInput.Write` and `Close`, without
a newline. Stdout/stderr remain inherited. No shell interpolation, wrapper script,
new transport flag, or limit relaxation.

The scriptblock waits for native completion and sets global `$LASTEXITCODE` without
exiting the interactive shell. It sets BOM-less UTF-8 `$OutputEncoding` and restores
encoding in nested `finally` blocks, including native failures and thrown invocation
errors. Cleanup kills an unfinished owned process tree, waits for exit, and disposes
the process. Values remain data, including Unicode, quotes, backslashes, dollars,
backticks, and HTML.

Raw stdin caps at 65,536 UTF-8 bytes before decoding or JSON parsing. Whitespace,
invalid bytes, and caller-added newlines count toward that limit. Generated commands
write exact compact JSON bytes, so inputs at 65,535 and 65,536 bytes retain direct
CLI/API parity; 65,537 bytes reject with `PAYLOAD_TOO_LARGE`. The worker separately
allows 4,096 framing bytes and 69,632 total wire bytes.

## Errors and limits

| Error | Action |
| --- | --- |
| INVALID_INPUT | Correct arguments, field types, or selected paths using fieldErrors. |
| INVALID_JSON | Send one JSON object encoded as valid UTF-8. |
| INVALID_TARGET | Select one of the three supported pilot IDs. |
| PAYLOAD_TOO_LARGE | Reduce raw stdin to at most 65,536 bytes, including newlines. |
| RUNTIME_UNAVAILABLE | Use installed Node 24 and compatible trusted configuration. No install fallback. |
| SOURCE_DRIFT | Request explicit source review and deployment-anchor update. Do not regenerate pins at startup. |
| BUSY | Resubmit explicitly after an active invocation finishes. |
| WORKER_FAILED | Inspect runtime diagnostics; native execution or protocol failed. |
| TIMED_OUT / CANCELLED | Resubmit explicitly if execution is still needed. |

The supervisor captures worker diagnostics separately from protocol stdout under
the combined 128 KiB output cap. Handler logs are not additional CLI result fields.
Stdin failures map through the same safe public helper; private exception text is
not exposed. Durations/timestamps can differ between independent runs; compare
native semantic fields, outcomes, and error codes.

Workers have a five-second deadline and two slots per runner, with no queue. Files
cap at 1 MiB each. Roots authorize file selection, not broad worker directory reads.
The runner's import-line SEC-AUDITOR exception covers only intentional spawning of
the fixed reviewed worker through the same installed Node executable, shell:false,
restricted environment and explicit read permissions. It is not an arbitrary
command exemption. Regression tests pin executable, arguments, flags and options;
source changes still require explicit source-pin and consumer-anchor review.
No temp outputs, persisted inputs/results, downloads, retries, or external services.
Permission checks supplement source review; they are not an OS sandbox or network
firewall. Reviewed hashes detect installed drift, not replacement of both code and
trusted anchor. Realpath checks cannot eliminate hostile concurrent file mutation.

## Verify

From the Toolforge root:

```text
node --test --test-timeout=25000 skills/toolforge-cli/tests/invocation-cli.test.mjs skills/toolforge-cli/tests/invocation-worker.test.mjs skills/toolforge-cli/tests/invocation-contracts.test.mjs skills/retro-schema-validator/tests/index.test.js
```

CLI tests require installed Windows PowerShell 5.1 and PowerShell 7 at standard
Windows paths. They exercise real pilots, UTF-8 byte limits, native shell behavior,
encoding restoration, injection sentinels, and portable formatter-body parity.
