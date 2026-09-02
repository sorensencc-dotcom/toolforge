/**
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 * Public Entry Point
 *
 * Spec: CIC v2.4.0 | Amendment §2/S3-A1
 *
 * Re-exports all public API surfaces in a single import.
 *
 * Usage:
 *   import { WhichLLMAdapter, LineageContract, GovernanceWrapper } from '@cic/whichllm-integration-pack';
 */

// ── Adapter ───────────────────────────────────────────────────────────────────
export {
  WhichLLMAdapter,
  deriveId,
  canonicalJson,
  backoffMs,
  ADAPTER_VERSION,
  CIC_SPEC_VERSION,
  AMENDMENT_REF,
} from './adapter/whichllm-adapter.js';

// ── Governance ────────────────────────────────────────────────────────────────
export {
  GovernanceWrapper,
  GovernanceViolationError,
  MODEL_ALLOWLIST,
  GOVERNANCE_VERSION,
} from './governance/governance-wrapper.js';

// ── Lineage ───────────────────────────────────────────────────────────────────
export {
  LineageContract,
  GENESIS_HASH,
  LINEAGE_CONTRACT_VERSION,
} from './lineage/lineage-contract.js';

// ── Harvester Registry ────────────────────────────────────────────────────────
export {
  HARVESTER_REGISTRY,
  registerHarvester,
  updateHarvester,
  retireHarvester,
  pauseHarvester,
  activateHarvester,
  getHarvester,
  listHarvesters,
  registryHealthSummary,
  RegistryError,
} from './harvester/harvester-registry.js';

// ── Observability ─────────────────────────────────────────────────────────────
export {
  AdapterObserver,
  Span,
  OBSERVER_VERSION,
} from './observability/adapter-observer.js';
