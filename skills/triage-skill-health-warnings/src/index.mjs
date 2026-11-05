const GROUP_TAG = 'toolforge-health-warning';

// Parse SKILLPACK-RUNTIME-HEALTH.md into [{ skill, status, checks: [{ check, result, details }] }].
export function parseHealthReport(md) {
  const skills = [];
  let cur = null;
  for (const line of String(md).split(/\r?\n/)) {
    const head = line.match(/^### (\S+) [—-] (.+)$/u);
    if (head) {
      cur = { skill: head[1], status: head[2].replace(/[^\w]/g, '').toUpperCase(), checks: [] };
      skills.push(cur);
      continue;
    }
    if (!cur) continue;
    const row = line.match(/^\|\s*(\w+)\s*\|\s*(?:\S+\s+)?(PASS|WARN|FAIL)\s*\|\s*(.*?)\s*\|\s*$/u);
    if (row && row[1] !== 'Check') cur.checks.push({ check: row[1], result: row[2], details: row[3] });
  }
  return skills;
}

// { Group: [{ skill, result, details }] } for every non-PASS check, skills sorted so reruns are stable.
export function groupWarnings(parsed) {
  const groups = {};
  for (const s of parsed) {
    for (const c of s.checks) {
      if (c.result === 'PASS') continue;
      (groups[c.check] ??= []).push({ skill: s.skill, result: c.result, details: c.details });
    }
  }
  for (const g of Object.keys(groups)) groups[g].sort((a, b) => a.skill.localeCompare(b.skill));
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

// Todo row in AGENTS.md table format; resolved adds the done marker and date.
export function renderTodoRow({ group, skills, created, resolved = null }) {
  const status = resolved ? '✅ `[x]`' : '⏳ `[ ]`';
  const when = resolved ? `(created ${created}) (resolved ${resolved})` : `(created ${created})`;
  return `| ${status} | **P2** | **[P2] Toolforge health warning group: ${group}** ${when} — ${skills.length} skill(s): ${skills.join(', ')}. Source: SKILLPACK-RUNTIME-HEALTH.md. <!-- todo-group: ${GROUP_TAG}:${group} --> |`;
}

// Flip the open row for a group to done. Already-done or missing rows are left alone.
export function closeTodoRow(agentsMd, group, date) {
  const tag = `<!-- todo-group: ${GROUP_TAG}:${group} -->`;
  let changed = false;
  const out = String(agentsMd).split('\n').map((line) => {
    if (!line.includes(tag) || !line.includes('⏳')) return line;
    changed = true;
    return line
      .replace('⏳ `[ ]`', '✅ `[x]`')
      .replace(/\(created (\d{4}-\d{2}-\d{2})\)(?! \(resolved)/, `(created $1) (resolved ${date})`);
  });
  return { md: out.join('\n'), changed };
}

// Close a group only when the regenerated report no longer lists it.
export function groupsToClose(openGroups, freshGroups) {
  return openGroups.filter((g) => !(g in freshGroups));
}
