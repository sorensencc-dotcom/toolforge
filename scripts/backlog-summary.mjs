import fs from 'node:fs';

const BACKLOG_ITEM = /^- \[([ xX])\] \*\*\[(P\d)\]/;

export function summarizeBacklog(todosPath, sinceDate, untilDate) {
  let text;
  try {
    text = fs.readFileSync(todosPath, 'utf8');
  } catch {
    return { total_open: null, p0_p1: null, p2: null, completed_this_period: null, added_this_period: null };
  }
  const inWindow = date => date !== undefined && date >= sinceDate && date <= untilDate;
  const tally = { total_open: 0, p0_p1: 0, p2: 0, completed_this_period: 0, added_this_period: 0 };
  for (const line of text.split(/\r?\n/)) {
    const m = BACKLOG_ITEM.exec(line);
    if (!m) continue;
    const created = /created (\d{4}-\d{2}-\d{2})/.exec(line)?.[1];
    if (inWindow(created)) tally.added_this_period++;
    if (m[1] === ' ') {
      tally.total_open++;
      if (m[2] === 'P0' || m[2] === 'P1') tally.p0_p1++;
      else if (m[2] === 'P2') tally.p2++;
    } else if (inWindow(/resolved (\d{4}-\d{2}-\d{2})/.exec(line)?.[1])) {
      tally.completed_this_period++;
    }
  }
  return tally;
}
