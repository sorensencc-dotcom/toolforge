# Decision staging

This directory is the review buffer for `scripts/decision-action-extract.mjs`.

1. Run `node scripts/decision-action-extract.mjs --input <transcript.txt>`.
2. Read each `dec-*.md` card. The JSON block is the record that approval revalidates.
3. To copy one card into `dev/triage/decision-backlog/`, run `node scripts/decision-action-extract.mjs --approve dec-<id>`.
4. Commit the backlog card yourself after `git diff` matches what you reviewed.

The extractor does not run `git commit`. Vague deadlines such as "soon", and shared owners such as "Alex and Jordan", stay in `dev/triage/decision-quarantine/`.
