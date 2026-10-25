const DAY_MS = 86400000;

function dayNumber(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function countActiveDays(days) {
  return new Set(days).size;
}

export function computeStreak(days, anchorDay) {
  const have = new Set(days.map(dayNumber));
  let streak = 0;
  for (let n = dayNumber(anchorDay); have.has(n); n -= 1) streak += 1;
  return streak;
}

export function countPrReferences(subjects) {
  const refs = new Set();
  for (const subject of subjects) {
    for (const match of subject.matchAll(/#(\d+)/g)) refs.add(match[1]);
  }
  return refs.size;
}

export function topDirectories(files, limit = 3) {
  const counts = new Map();
  for (const file of files) {
    const parts = file.replace(/\\/g, '/').split('/');
    const key = parts.length > 1 ? `${parts[0]}/` : './';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([dir]) => dir);
}

export function buildTweetable({ date, commits, versionRange, testFiles }) {
  const [from, to] = versionRange;
  const releases = from === to ? `version ${to}` : `releases ${from} to ${to}`;
  return `Week ending ${date}: ${commits} commits, ${releases}, ${testFiles} test files tracked.`;
}

const SOURCE_FILE = /\.(mjs|cjs|js|jsx|ts|tsx|ps1|sh|py)$/i;

export function isSourceFile(file) {
  return SOURCE_FILE.test(file);
}

export function computeSessions(commitTimes, { gapMinutes = 120, deepMinutes = 90, mediumMinutes = 30 } = {}) {
  const times = [...commitTimes].sort((a, b) => a - b);
  const durations = [];
  let start = null;
  let last = null;
  for (const t of times) {
    if (start !== null && t - last > gapMinutes * 60000) {
      durations.push((last - start) / 60000);
      start = null;
    }
    if (start === null) start = t;
    last = t;
  }
  if (start !== null) durations.push((last - start) / 60000);

  const totalMinutes = durations.reduce((sum, m) => sum + m, 0);
  return {
    sessions: durations.length,
    deep: durations.filter(m => m >= deepMinutes).length,
    medium: durations.filter(m => m >= mediumMinutes && m < deepMinutes).length,
    micro: durations.filter(m => m < mediumMinutes).length,
    totalMinutes: Math.round(totalMinutes),
    avgMinutes: durations.length ? Math.round(totalMinutes / durations.length) : 0
  };
}

export function localDay(isoTimestamp) {
  const date = new Date(isoTimestamp);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
