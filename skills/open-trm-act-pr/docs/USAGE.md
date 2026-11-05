# Open TRM act PR - usage

## Worked example (PR #227, closes #215)

```js
import { branchName, commitSubject, prBody } from '../src/index.mjs';

branchName('toolforge icf batch triage pr bridge tests');
// trm/act-toolforge-icf-batch-triage-pr-bridge-tests

commitSubject({
  type: 'chore',
  scope: 'icf',
  summary: 'implement integration test suite for batch triage and PR staging bridge',
  issue: 215,
});
// chore(icf): implement integration test suite for batch triage and PR staging bridge (closes #215)
```

`prBody` renders Why, Scope, Tradeoffs, Blast Radius, and Tests. It throws when `why`, `tradeoffs`, `blastRadius`, or `tests` is empty, so a PR cannot go out with a blank section.

## Troubleshooting

- `gh pr create` rejects the branch: push first with `git push -u origin <branch>`.
- The suite is silent for 60 seconds: treat it as hung, abort, and clear `.staging.lock` and `.kb-sync.lock` before retrying.
- The PR is not tracked in the app: run `mcp__ccd_pr__get_status`, then `bind_pr`.
