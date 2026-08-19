const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'heuristics.json');
const raw = fs.readFileSync(catalogPath, 'utf8');
const catalog = JSON.parse(raw);

let skillMd = `---
name: writing-heuristics
description: Deterministic technical writing heuristics, anti-slop rules, and Google Developer Style enforcement engine
version: ${catalog.version}
---

# Writing Heuristics and Style Discipline

Apply these deterministic rules to all technical documentation, architecture specs, pull request descriptions, and agent communications.

## Canonical Rules Summary

`;

for (const rule of catalog.rules) {
  const autofixStr = rule.autofix ? 'Autofixable' : 'Manual rewrite';
  const advisoryStr = rule.advisory ? ' (Advisory)' : '';
  skillMd += `### ${rule.name} (\`${rule.id}\`)\n`;
  skillMd += `- **Severity**: \`${rule.severity}\`${advisoryStr} | **Confidence**: ${rule.confidence} | **Handling**: ${autofixStr}\n`;
  skillMd += `- **Rule**: ${rule.description}\n`;
  skillMd += `- **Rationale**: ${rule.rationale}\n`;
  skillMd += `- **Pass**: "${rule.passExample}"\n`;
  skillMd += `- **Fail**: "${rule.failExample}"\n\n`;
}

skillMd += `## Suppression Syntax

To suppress a rule locally with an audit trail:
\`\`\`markdown
<!-- heuristics-disable rule-id author="username" reason="Rationale for exemption" until="YYYY-MM-DD" -->
Exempted text here
<!-- heuristics-enable rule-id -->
\`\`\`

## CLI Enforcement
To check documentation in this repository:
\`\`\`bash
node skills/writing-heuristics/bin/lint-heuristics.js check docs/
\`\`\`
`;

let rulesMd = `# Technical Writing Heuristics Reference Manual

**Catalog Version:** ${catalog.version}
**Last Updated:** ${catalog.lastUpdated}
**Total Rules:** ${catalog.rules.length}

---

## Catalog Index

| Rule ID | Name | Severity | Handling | Category |
|---|---|---|---|---|
`;

for (const rule of catalog.rules) {
  const autofixStr = rule.autofix ? 'Autofix (Safe)' : 'Manual';
  rulesMd += `| \`${rule.id}\` | ${rule.name} | \`${rule.severity}\` | ${autofixStr} | ${rule.category} |\n`;
}

rulesMd += `\n---\n\n## Detailed Rule Specifications\n\n`;

for (const rule of catalog.rules) {
  rulesMd += `### ${rule.name} (\`${rule.id}\`)\n\n`;
  rulesMd += `- **Category**: ${rule.category}\n`;
  rulesMd += `- **Severity**: \`${rule.severity}\`\n`;
  rulesMd += `- **Confidence Score**: ${rule.confidence}\n`;
  rulesMd += `- **Autofix Support**: ${rule.autofix ? 'Yes (Confidence >= 0.95)' : 'No'}\n`;
  rulesMd += `- **Description**: ${rule.description}\n`;
  rulesMd += `- **Rationale**: ${rule.rationale}\n\n`;
  if (rule.patterns && rule.patterns.length > 0) {
    rulesMd += `- **Token Patterns**:\n`;
    for (const p of rule.patterns) {
      rulesMd += `  - \`${p}\`\n`;
    }
    rulesMd += `\n`;
  }
  rulesMd += `#### Examples\n\n`;
  rulesMd += `**Pass:**\n> ${rule.passExample}\n\n`;
  rulesMd += `**Fail:**\n> ${rule.failExample}\n\n---\n\n`;
}

fs.writeFileSync(path.join(__dirname, '..', 'SKILL.md'), skillMd.trim() + '\n', 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'rules.md'), rulesMd.trim() + '\n', 'utf8');
console.log('Compiled SKILL.md and docs/rules.md successfully from heuristics.json!');
