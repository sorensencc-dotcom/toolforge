const fs = require('fs');

let content = fs.readFileSync('src/e2e/harness.js', 'utf8');

const regex = /export async function seedInstalls\(db, skillId, versionId, runId, count, \{ daysAgo = 0, userOffset = 0 \} = \{\}\) \{[\s\S]*?await db.query\([\s\S]*?\n    \);\n  \}\n\}/m;

const replaceWith = `export async function seedInstalls(db, skillId, versionId, runId, count, { daysAgo = 0, userOffset = 0 } = {}) {
  if (count <= 0) return;

  const chunkSize = 5000;
  for (let start = 0; start < count; start += chunkSize) {
    const chunkCount = Math.min(chunkSize, count - start);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (let i = 0; i < chunkCount; i++) {
      const p1 = paramIdx++;
      const p2 = paramIdx++;
      const p3 = paramIdx++;
      const p4 = paramIdx++;
      values.push(\`($$\${p1}::uuid, $$\${p2}::uuid, $$\${p3}, 'success', NOW() - ($$\${p4} || ' days')::interval)\`);
      params.push(skillId, versionId, \`\${runId}-u\${userOffset + start + i}@e2e.local\`, String(daysAgo));
    }

    await db.query(
      \`INSERT INTO installation_log (skill_id, version_id, user_id, status, timestamp)
       VALUES \${values.join(', ')}\`,
      params
    );
  }
}`;

content = content.replace(regex, replaceWith);
fs.writeFileSync('src/e2e/harness.js', content);
