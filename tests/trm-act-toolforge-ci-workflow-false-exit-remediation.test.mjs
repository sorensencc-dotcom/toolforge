import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows');
const workflows = fs
  .readdirSync(dir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));

test('workflow directory is not empty', () => {
  assert.ok(workflows.length > 0);
});

for (const { f, text } of workflows) {
  test(`${f}: top-level defaults.run.shell is bash`, () => {
    assert.match(
      text,
      /^defaults:\r?\n {2}run:\r?\n {4}shell: bash\s*$/m,
      'bash default runs with -eo pipefail so a failing pipe stage fails the step',
    );
  });

  test(`${f}: no continue-on-error: true masking step failures`, () => {
    assert.doesNotMatch(text, /^\s*continue-on-error:\s*true\b/m);
  });

  test(`${f}: step shells are limited to bash or pwsh`, () => {
    for (const m of text.matchAll(/^\s+shell:\s*(\S+)/gm)) {
      assert.ok(['bash', 'pwsh'].includes(m[1]), `unexpected shell ${m[1]}`);
    }
  });

  test(`${f}: no '|| true' swallowing outside a captured assignment`, () => {
    for (const line of text.split(/\r?\n/)) {
      if (/\|\|\s*true\b/.test(line)) {
        assert.match(line, /=\$\(.*\|\|\s*true\)/, `bare '|| true': ${line.trim()}`);
      }
    }
  });
}
