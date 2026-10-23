import { execFileSync } from 'node:child_process';
import { runAdversarialReview } from '../../../modules/review/review-runner.ts';

function gitOutput(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Returns the process exit code: 0 pass, 1 blocked, 2 failed closed. */
export async function reviewAction(
  { adversarial, base, authorModel, threshold, json },
  { git = gitOutput, review = runAdversarialReview, log = console.log, error = console.error } = {},
) {
  if (!adversarial) {
    error('✗ toolforge review currently supports only --adversarial.');
    return 2;
  }
  try {
    const diff = git(['diff', `${base}...HEAD`]);
    if (diff.trim() === '') {
      error(`✗ No diff between ${base} and HEAD to review.`);
      return 2;
    }
    const commitMessage = git(['log', '--format=%B%n----', `${base}..HEAD`]);
    const { route, outcome } = await review({
      diff,
      packet: { author_model: authorModel, commitMessage },
      threshold,
    });
    if (json) {
      log(JSON.stringify({ reviewer: route, ...outcome }, null, 2));
    } else {
      log(`Reviewer: ${route.provider}/${route.model}`);
      for (const f of outcome.findings) {
        log(`  risk ${f.risk} ${f.file}: ${f.summary}\n    trigger: ${f.trigger}\n    fix: ${f.fixRecipe}`);
      }
      if (outcome.flags.length > 0) log(`Flags: ${outcome.flags.join(', ')}`);
      log(outcome.pass ? '✓ Adversarial review passed.' : '✗ Adversarial review blocked.');
    }
    return outcome.pass ? 0 : 1;
  } catch (e) {
    error(`✗ Adversarial review failed closed: ${e.message}`);
    return 2;
  }
}

export default {
  command: 'review',
  describe: 'Review the current branch diff',
  builder: (yargs) =>
    yargs
      .option('adversarial', {
        describe: 'Review with a model from a different family than the diff author',
        type: 'boolean',
        default: false,
      })
      .option('base', { describe: 'Base ref to diff against', type: 'string', default: 'origin/main' })
      .option('author-model', {
        describe: 'Model that wrote the diff (default: last Co-Authored-By trailer)',
        type: 'string',
      })
      .option('threshold', { describe: 'Risk at or above this blocks (default 3)', type: 'number' })
      .option('json', { describe: 'Print the outcome as JSON', type: 'boolean', default: false }),

  handler: async (argv) => {
    process.exit(await reviewAction(argv));
  },
};
