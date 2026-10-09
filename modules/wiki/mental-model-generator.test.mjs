import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateMentalModels } from './mental-model-generator.mjs';

console.log('🧪 Testing mental-model-generator.mjs...');

const testTempDir = path.join(os.tmpdir(), `trm-mm-test-${Date.now()}`);
fs.mkdirSync(testTempDir, { recursive: true });

try {
  const results = generateMentalModels(testTempDir);

  // Assertions
  assert.ok(Array.isArray(results), 'Result should be an array');
  assert.strictEqual(results.length, 3, 'Should generate 3 core mental models');

  for (const item of results) {
    assert.ok(typeof item.file === 'string', 'Item file should be a string path');
    assert.ok(!item.file.includes('\\'), 'File path should use forward slashes');
    assert.ok(typeof item.title === 'string', 'Item title should be a string');
    assert.ok(item.sizeBytes > 0, 'Size in bytes should be greater than zero');

    const fullPath = path.join(testTempDir, item.file);
    assert.ok(fs.existsSync(fullPath), `Generated file must exist at ${fullPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.startsWith('---'), 'File must contain YAML frontmatter');
    assert.ok(content.includes(item.title), 'File must contain title');
  }

  console.log('✔ All mental-model-generator tests passed successfully!');
} finally {
  fs.rmSync(testTempDir, { recursive: true, force: true });
}
