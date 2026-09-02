// Plain-JS entrypoint. Node 24 routes a `.ts` main-entry file through its
// native ESM/type-stripping loader, bypassing ts-node's CJS require hook
// entirely (confirmed: identical code works when *required* from a .js
// file, but silently no-ops when passed to `node` as the entry arg). This
// bootstrap keeps validate.ts a plain library required via the normal hook.
require("ts-node/register");
const { validateSubmission } = require("./validate.ts");

const skillPath = process.argv[2];
if (!skillPath) {
  console.error("Usage: validate <skill-path>");
  process.exit(1);
}

const report = validateSubmission(skillPath);
console.log(JSON.stringify(report, null, 2));
process.exit(report.recommendation === "reject" ? 1 : 0);
