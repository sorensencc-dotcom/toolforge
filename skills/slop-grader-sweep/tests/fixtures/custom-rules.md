Fixture ruleset used by the offline integration test. It exercises the real
`-r <path.md>` contract without spending an API call.

# Line Rules

## fixture_banned_word
Does the line use a banned marketing buzzword?

### Criteria
- **true**: The line contains a buzzword such as "leverage" or "synergy".
- **false**: The line uses plain, concrete wording.
