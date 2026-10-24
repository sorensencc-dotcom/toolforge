# Run tests safe: usage

## Examples

- "run tests" -> `timeout 60 npm test`, then summarize counts.
- "tests hung" -> kill tree, `clearLocks([root, 'kb-sync', '_kb-sync-staging'])`, rerun the named file with `--test-timeout=10000`.

## Troubleshooting

- `findHangingFile` returns null: the runner printed no per-file markers. Rerun with `--test-reporter=spec` and read the last `▶` line.
- Lock reappears after clearing: another live run holds it. Check for running node processes before deleting again.
- Windows: `killTree` uses `taskkill /T /F`; a plain `kill` leaves child node processes alive.
