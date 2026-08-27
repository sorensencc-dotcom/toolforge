export { validateAdapterConfig, AdapterConfigError } from './config.js';
export { classifyDiff, DiffEntryError, UnsupportedGlobError } from './classifier.js';
export { evaluateAutomationTestPolicy } from './policy.js';
export {
  evaluateCiAutomationPolicy,
  evaluateCiCommitPolicies,
  runConfiguredTestCommands,
} from './ci.js';
