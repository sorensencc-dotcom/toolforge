#!/usr/bin/env bash
### Git pre-push step: run `toolforge review --adversarial` on the branch diff before it is pushed.
###
### Opt-in, because each run calls a paid reviewer model. Set TOOLFORGE_ADVERSARIAL_REVIEW=1 to enable it.
### Once enabled it fails closed: a blocking finding, a missing OPENAI_API_KEY, or a malformed reply all stop the push.
### TOOLFORGE_REVIEW_BASE sets the base ref (default origin/main).
### TOOLFORGE_REVIEW_CMD replaces the review command, for tests.
set -u

if [ "${TOOLFORGE_ADVERSARIAL_REVIEW:-}" != "1" ]; then
  exit 0
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
BASE="${TOOLFORGE_REVIEW_BASE:-origin/main}"

if ! git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null; then
  echo "[ADVERSARIAL-REVIEW] ✗ Base ref $BASE not found. Push blocked. Fetch it, set TOOLFORGE_REVIEW_BASE, or unset TOOLFORGE_ADVERSARIAL_REVIEW."
  exit 1
fi

if git diff --quiet "$BASE"...HEAD; then
  echo "[ADVERSARIAL-REVIEW] No diff against $BASE. Skipping."
  exit 0
fi

echo "[ADVERSARIAL-REVIEW] Reviewing $BASE...HEAD"
if [ -n "${TOOLFORGE_REVIEW_CMD:-}" ]; then
  # shellcheck disable=SC2086
  $TOOLFORGE_REVIEW_CMD
else
  node src/cli/index.js review --adversarial --base "$BASE"
fi
STATUS=$?

case "$STATUS" in
  0)
    echo "[ADVERSARIAL-REVIEW] ✓ Passed."
    exit 0
    ;;
  1)
    echo "[ADVERSARIAL-REVIEW] ✗ Blocking finding. Push blocked. Fix it, or bypass once with 'git push --no-verify'."
    exit 1
    ;;
  *)
    echo "[ADVERSARIAL-REVIEW] ✗ Review failed closed (exit $STATUS). Push blocked. Bypass once with 'git push --no-verify'."
    exit 1
    ;;
esac
