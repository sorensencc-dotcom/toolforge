import { CommentDirectiveNode } from './parser';
import { SuppressionDirective } from './types';

export class SuppressionRegistry {
  private directives: SuppressionDirective[] = [];

  constructor(comments: CommentDirectiveNode[], currentDate: Date = new Date()) {
    this.parseDirectives(comments, currentDate);
  }

  private parseDirectives(comments: CommentDirectiveNode[], currentDate: Date): void {
    const todayStr = currentDate.toISOString().slice(0, 10);

    for (const c of comments) {
      const disableMatch = c.value.match(/^heuristics-disable\s+([a-zA-Z0-9_-]+|all)(?:\s+author="([^"]*)")?(?:\s+reason="([^"]*)")?(?:\s+until="([^"]*)")?/);
      if (disableMatch) {
        const ruleId = disableMatch[1];
        const author = disableMatch[2] ?? '';
        const reason = disableMatch[3] ?? '';
        const until = disableMatch[4];

        let isExpired = false;
        if (until) {
          isExpired = todayStr > until;
        }

        this.directives.push({
          ruleId,
          author,
          reason,
          until,
          line: c.line,
          isExpired,
          active: !isExpired,
        });
      }
    }
  }

  public isSuppressed(ruleId: string, line: number): boolean {
    for (const dir of this.directives) {
      if (dir.active && (dir.ruleId === ruleId || dir.ruleId === 'all') && line >= dir.line) {
        return true;
      }
    }
    return false;
  }

  public getDirectives(): SuppressionDirective[] {
    return this.directives;
  }
}
