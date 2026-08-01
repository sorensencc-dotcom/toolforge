import { findAllTopics, scanTopicDir, deriveStatus } from './scanTopic';
import { attachGitInfo, renderTable } from './report';

export { findAllTopics, scanTopicDir, deriveStatus } from './scanTopic';
export type { TopicStats, TrmStatus, TrmState, TopicMeta } from './scanTopic';
export { attachGitInfo, renderTable } from './report';
export { uncommittedCount } from './vaultGit';

export function runTrmStatus(vaultRoot: string): string {
  const topicDirs = findAllTopics(vaultRoot);
  const statuses = topicDirs.map((dir) => deriveStatus(scanTopicDir(dir)));
  const withGit = attachGitInfo(vaultRoot, statuses);
  return renderTable(withGit);
}

if (require.main === module) {
  const vaultRoot = process.argv[2] ?? 'C:\\Users\\soren\\trm-vault';
  console.log(runTrmStatus(vaultRoot));
}
