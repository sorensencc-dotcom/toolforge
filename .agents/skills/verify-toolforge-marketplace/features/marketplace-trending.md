# Marketplace trending

Marketplace trending calculates and surfaces the fastest-growing and most frequently installed skills across 7-day and 30-day rolling evaluation windows, ranking skills by momentum score and net install velocity.

## Sub-features

- `trending-7d` calculates short-term weekly momentum and surfaces breakout skills.
- `trending-30d` calculates monthly sustained install volume and stability metrics.
- `trending-direction` classifies growth trajectory into `up`, `down`, or `stable`.
- `trending-ui` renders trending leaderboard cards with velocity badges and rating averages.

## How to get to it (user POV)

- Send HTTP `GET /api/v1/skills/trending?window=7d` or `GET /api/v1/skills/trending?window=30d`.
- Open `http://localhost:5173`, choose `Trending` in the top navigation, and switch between `7 days` and `30 days` toggle buttons.

## Driving it with control-marketplace

Preconditions:

- Marketplace doctor passes (`node .agents/skills/verify-toolforge-marketplace/scripts/control-marketplace.mjs doctor`).
- API server is running at `<url>` (or mock fixture server loaded).

- **Fetch 7-day trending metrics.** Query the 7d window:
  Run `curl -s "<url>/api/v1/skills/trending?window=7d&limit=5"`.
  Returns status 200 and a JSON object `{ "data": [ ... ] }` of trending skills with `installs7d`, `installs30d`, `trendScore`, and `trendDirection` (`growthPct` is a derived UI calculation, not serialized in the API response).

- **Fetch 30-day trending metrics.** Query the 30d window:
  Run `curl -s "<url>/api/v1/skills/trending?window=30d&limit=5"`.
  Returns status 200 with `{ "data": [ ... ] }` containing monthly aggregate installations `installs30d`.

- **Verify ordering invariance.** Inspect returned ranking order:
  Assert that skills are sorted in descending order of momentum/score.
  The top items match positive growth indicators (`trendDirection: "up"`).

- **Verify route registration order.** Query `/api/v1/skills/trending` directly:
  Confirm HTTP status is 200 and NOT 404. This proves that `/trending` is correctly mounted ahead of `/api/v1/skills/:id` in Express route registration.

## Gotchas

- If `/api/v1/skills/trending` is registered AFTER `/api/v1/skills/:id` in Express, the route matcher treats `"trending"` as a skill ID parameter and returns 404 from `getSkill("trending")`.
- Window parameter values other than `7d` default to `30d`.
- In the frontend Web UI, `Trending.jsx` currently loads from local static fixture `src/ui/fixtures/trending.json` as a mock swap point rather than live API polling.
- In test environments without a provisioned PostgreSQL instance, live SQL aggregate recalculation is skipped; run unit test suite `node --test src/services/trending-batch.test.js` (13 tests) for deterministic spike algorithm verification.
