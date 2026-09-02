---
name: phase-2-simulation-harness-contract
description: Phase 2 SPL+RL simulation harness (immutable contract); builds on Phase 1 MAAL foundation
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7868a049-3774-41db-ade2-dd9374785bc7
---

# **PHASE 2 SIMULATION HARNESS CONTRACT (IMMUTABLE)**

This contract defines the SPL/RL training harness that sits *downstream* of Phase 1 MAAL.

**Prerequisite:** Phase 1 (MAAL Core + Ledger Substrate + BridgeOrchestrator) is frozen at v0.1.0-maal-foundation.

Phase 2 does NOT modify Phase 1. It only **consumes** ledger events and **trains offline**.

---

# **Architecture Overview**

```
┌─────────────────────────────────────────┐
│  Phase 1: MAAL (Frozen v0.1.0)          │
│  - TaskFingerprinting                   │
│  - RoutingRegimeSelector                │
│  - ConstraintEngine                     │
│  - LedgerSubstrate (EventStream)        │
│  - BridgeOrchestrator integration       │
└─────────────────────────────────────────┘
                     │
                     ├─ emits LedgerEvent[]
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Phase 2: SPL/RL Harness                │
│  - Simulation engine (offline)          │
│  - State/action/reward definitions      │
│  - Policy (π_θ) learner                 │
│  - Experience replay                    │
│  - Model evaluation                     │
│  - Training telemetry                   │
└─────────────────────────────────────────┘
                     │
                     ├─ writes TrainingTelemetry
                     │
                     ▼
┌─────────────────────────────────────────┐
│  Phase 3: Canary Gate                   │
│  - A/B test framework                   │
│  - Holdout validation                   │
│  - Production gating                    │
└─────────────────────────────────────────┘
```

---

# **1. PHASE 2 STATE SPACE DEFINITION**

Directory: `cic-os/src/learning/state/`

## **1.1 RouteState.ts**

```ts
export interface RouteState {
  // From Phase 1 fingerprint
  taskFingerprint: TaskFingerprint;
  
  // From ledger (historical)
  recentModelPerformance: {
    modelId: string;
    avgLatencyMs: number;
    avgCost: number;
    successRate: number;
    sampleCount: number;
  }[];
  
  // Derived features
  systemLoad: number;           // 0–1, from event stream density
  costBudgetRemaining: number;  // 0–1
  latencyBudgetRemaining: number; // 0–1
  
  // Regime + constraints (from Phase 1)
  routingRegime: RoutingRegime;
  constraints: RoutingConstraints;
  
  // Timestamp for drift detection
  stateTimestamp: number;
}

export interface RouteStateFactory {
  build(fingerprint: TaskFingerprint): RouteState;
}
```

---

## **1.2 StateFeaturizer.ts**

```ts
export interface StateVector {
  features: number[];        // fixed-size feature vector
  featureNames: string[];    // for debugging
}

export interface StateFeaturizer {
  featurize(state: RouteState): StateVector;
  stateSpaceDim(): number;
}
```

---

# **2. PHASE 2 ACTION SPACE DEFINITION**

Directory: `cic-os/src/learning/action/`

## **2.1 RouteAction.ts**

```ts
export type RouteActionType = 
  | "SELECT_MODEL"
  | "USE_FALLBACK"
  | "DEFER_TO_HUMAN"
  | "QUEUE_FOR_BATCH";

export interface RouteAction {
  actionType: RouteActionType;
  modelId?: string;           // if SELECT_MODEL
  fallbackEdgeId?: string;    // if USE_FALLBACK
  reason?: string;            // for logging
}

export interface ActionSpace {
  enumModelIds(): string[];
  enumFallbackEdges(): string[];
  isValid(action: RouteAction): boolean;
}
```

---

# **3. PHASE 2 REWARD FUNCTION (CALIBRATED)**

Directory: `cic-os/src/learning/reward/`

## **3.1 RewardSignal.ts**

```ts
export interface RewardComponents {
  latencyReward: number;      // -Δms / 1000
  costReward: number;         // -cost * scale
  successReward: number;      // +1 if outcome == success, -1 if failure
  constraintPenalty: number;  // -1 if violated bounds
}

export interface RewardSignal {
  totalReward: number;
  components: RewardComponents;
  isTerminal: boolean;        // episode ends
}

export interface RewardFunction {
  compute(
    state: RouteState,
    action: RouteAction,
    outcome: RouteOutcome
  ): RewardSignal;
}
```

---

## **3.2 RouteOutcome.ts**

```ts
export interface RouteOutcome {
  modelId: string;
  success: boolean;
  actualLatencyMs: number;
  actualCost: number;
  outputQuality?: number;     // 0–1, from model evaluation
  timestamp: number;
}
```

---

# **4. PHASE 2 EPISODE & TRAJECTORY**

Directory: `cic-os/src/learning/episode/`

## **4.1 Episode.ts**

```ts
export interface Step {
  state: RouteState;
  action: RouteAction;
  reward: RewardSignal;
  nextState: RouteState;
}

export interface Episode {
  episodeId: string;
  steps: Step[];
  totalReward: number;
  isSuccess: boolean;
  startTimestamp: number;
  endTimestamp: number;
}

export interface EpisodeBuffer {
  append(episode: Episode): void;
  sample(batchSize: number): Episode[];
  size(): number;
}
```

---

## **4.2 Trajectory.ts**

```ts
export interface Trajectory {
  trajectoryId: string;
  episodes: Episode[];
  cumulativeReward: number;
  policyVersion: string;      // π_v1, π_v2, etc.
}

export interface TrajectoryCollector {
  startTrajectory(): string;
  appendEpisode(trajectoryId: string, episode: Episode): void;
  finalize(trajectoryId: string): Trajectory;
}
```

---

# **5. PHASE 2 POLICY LEARNER (SPL/RL)**

Directory: `cic-os/src/learning/policy/`

## **5.1 PolicyNetwork.ts**

```ts
export interface PolicyNetworkWeights {
  version: string;            // π_v0, π_v1, π_v2, ...
  parameters: Record<string, unknown>;
  trainedAt: number;
  trainingIterations: number;
}

export interface PolicyNetwork {
  // Forward pass: state → action distribution
  forward(state: RouteState): {
    actionLogits: number[];
    entropy: number;
  };
  
  // Update weights via gradient
  updateWeights(gradient: Record<string, unknown>): void;
  
  // Get current weights
  getWeights(): PolicyNetworkWeights;
  
  // Load weights from disk/DB
  loadWeights(weights: PolicyNetworkWeights): void;
}
```

---

## **5.2 PolicyGradientLearner.ts**

```ts
export interface PolicyGradientConfig {
  learningRate: number;
  discountFactor: number;     // γ
  entropyCoefficient: number; // balance exploration
  batchSize: number;
  gradientClipNorm?: number;
}

export interface PolicyGradientLearner {
  // Train on batch of trajectories
  train(
    trajectories: Trajectory[],
    config: PolicyGradientConfig
  ): {
    loss: number;
    entropy: number;
    gradientNorm: number;
  };
  
  // Infer best action (greedy + exploration)
  selectAction(
    state: RouteState,
    epsilon?: number
  ): RouteAction;
}
```

---

# **6. PHASE 2 SIMULATION ENGINE**

Directory: `cic-os/src/learning/simulator/`

## **6.1 RouteSimulator.ts**

```ts
export interface SimulationConfig {
  maxEpisodesPerTrajectory: number;
  maxStepsPerEpisode: number;
  warmupEpisodes: number;     // before training
  evalFrequency: number;      // train X episodes, eval Y
}

export interface RouteSimulator {
  // Generate offline episodes from ledger
  generateEpisode(
    initialState: RouteState,
    policy: PolicyNetwork
  ): Episode;
  
  // Run full simulation
  simulate(
    config: SimulationConfig
  ): {
    trajectories: Trajectory[];
    totalReward: number;
    avgRewardPerEpisode: number;
  };
  
  // Evaluate learned policy
  evaluate(
    policy: PolicyNetwork,
    testSize: number
  ): {
    meanReward: number;
    stdReward: number;
    successRate: number;
  };
}
```

---

## **6.2 ExperienceReplay.ts**

```ts
export interface ReplayBuffer {
  push(episode: Episode): void;
  sample(batchSize: number): Episode[];
  size(): number;
  clear(): void;
}

export interface PrioritizedReplayBuffer {
  push(episode: Episode, priority: number): void;
  sample(batchSize: number): Episode[];
  updatePriorities(
    episodeIds: string[],
    priorities: number[]
  ): void;
}
```

---

# **7. PHASE 2 TRAINING LOOP CONTRACT**

Directory: `cic-os/src/learning/training/`

## **7.1 TrainingLoop.ts**

```ts
export interface TrainingConfig {
  maxEpochs: number;
  targetMetric: "meanReward" | "successRate" | "costEfficiency";
  targetThreshold: number;
  earlyStoppingPatience: number; // stop if no improvement X epochs
}

export interface TrainingMetrics {
  epoch: number;
  trainingLoss: number;
  trainingReward: number;
  evalReward: number;
  evalSuccessRate: number;
  policyVersion: string;
  timestamp: number;
}

export interface TrainingLoop {
  // Main training harness
  run(
    config: TrainingConfig
  ): {
    finalPolicy: PolicyNetwork;
    metrics: TrainingMetrics[];
    converged: boolean;
  };
  
  // Checkpoint policy
  checkpoint(policy: PolicyNetwork, metrics: TrainingMetrics): void;
  
  // Load best policy from checkpoints
  loadBestPolicy(targetMetric: string): PolicyNetwork;
}
```

---

# **8. PHASE 2 TRAINING TELEMETRY**

Directory: `postgres/ledgers/` (extension to Phase 1)

## **8.1 training_runs.sql**

```sql
CREATE TABLE training_runs (
  id SERIAL PRIMARY KEY,
  training_run_id TEXT UNIQUE NOT NULL,
  policy_version TEXT NOT NULL,
  config JSONB NOT NULL,
  start_timestamp BIGINT NOT NULL,
  end_timestamp BIGINT,
  status TEXT,  -- "running" | "completed" | "failed"
  final_metric JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## **8.2 training_metrics.sql**

```sql
CREATE TABLE training_metrics (
  id SERIAL PRIMARY KEY,
  training_run_id TEXT NOT NULL,
  epoch INT NOT NULL,
  training_loss FLOAT NOT NULL,
  training_reward FLOAT NOT NULL,
  eval_reward FLOAT NOT NULL,
  eval_success_rate FLOAT NOT NULL,
  gradient_norm FLOAT,
  entropy FLOAT,
  timestamp BIGINT NOT NULL,
  FOREIGN KEY (training_run_id) REFERENCES training_runs(training_run_id)
);
```

---

## **8.3 policy_checkpoints.sql**

```sql
CREATE TABLE policy_checkpoints (
  id SERIAL PRIMARY KEY,
  policy_version TEXT UNIQUE NOT NULL,
  training_run_id TEXT NOT NULL,
  epoch INT NOT NULL,
  weights BYTEA NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (training_run_id) REFERENCES training_runs(training_run_id)
);
```

---

## **8.4 evaluation_results.sql**

```sql
CREATE TABLE evaluation_results (
  id SERIAL PRIMARY KEY,
  policy_version TEXT NOT NULL,
  eval_timestamp BIGINT NOT NULL,
  test_size INT NOT NULL,
  mean_reward FLOAT NOT NULL,
  std_reward FLOAT NOT NULL,
  success_rate FLOAT NOT NULL,
  holdout_dataset TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# **9. PHASE 2 INTEGRATION WITH PHASE 1**

Directory: `cic-ingestion/src/learning/` (new)

## **9.1 LedgerEventConsumer.ts**

```ts
export interface LedgerEventConsumer {
  // Poll ledger, convert events → states
  consumeEvents(
    since: number,
    limit: number
  ): RouteState[];
  
  // Convert ledger outcome → RouteOutcome
  extractOutcome(event: LedgerEvent): RouteOutcome;
}
```

---

## **9.2 OfflineLearningService.ts**

```ts
export interface OfflineLearningServiceConfig {
  ledgerPollIntervalMs: number;
  trainingCadenceMs: number;    // e.g., every 1 hour
  minLedgerEventsPerTraining: number;
}

export interface OfflineLearningService {
  start(config: OfflineLearningServiceConfig): void;
  stop(): void;
  
  // Called periodically
  trainNewPolicy(): PolicyNetwork;
  
  // Read current policy (immutable from Phase 1 perspective)
  getCurrentPolicy(): PolicyNetwork;
}
```

---

# **10. PHASE 2 NO OTHER FILES**

Same zero-drift constraint as Phase 1.

If Claude/Gemini tries to:
- add state encoders  
- add action decoders  
- add neural network frameworks  
- add new directories beyond contract  
- add SPL-specific training code not in contract  
- add fallback simulation code  

**Reject the diff.**

---

# **11. PHASE 2 ACCEPTANCE CRITERIA**

Phase 2 PR is valid only if:

- All files match this contract exactly
- No additional files exist
- No implementation logic (scaffolding) OR full implementation
- All ledger extensions match SQL schema
- All policy learner signatures match contract
- StateFeaturizer produces fixed-size vectors
- RewardFunction deterministic (same input → same reward)
- SimulationEngine does NOT call Phase 1 online (offline only)
- TrainingLoop implements early stopping
- Training telemetry writes to Postgres
- No phase bleed (Phase 2 does not modify Phase 1)
- OfflineLearningService runs independently of BridgeOrchestrator

---

# **12. PHASE 2 INTEGRATION CHECKPOINTS**

Phase 2 training harness must:

1. **Read Phase 1 ledger** (routing_history, model_performance_ledger)
2. **Convert events to RouteState** (deterministic)
3. **Run offline simulation** (no impact on live traffic)
4. **Write training telemetry** (training_runs, training_metrics, policy_checkpoints, evaluation_results)
5. **Store policy checkpoints** (BYTEA in database)
6. **Provide policy interface** (PolicyNetwork.forward() for Phase 3 canary)
7. **Implement early stopping** (no runaway training)

---

# **13. PHASE 2 TESTING CONTRACTS**

By Phase 2 completion:

```
StateFeaturizer
- [ ] Deterministic: same state → same vector
- [ ] Fixed-size: all vectors have stateSpaceDim() elements
- [ ] Normalized: feature ranges are bounded

RewardFunction
- [ ] Deterministic: same (state, action, outcome) → same reward
- [ ] Clipped: rewards in [-1, +1] range
- [ ] Component validation: cost/latency/success penalties non-zero

PolicyNetwork
- [ ] Forward pass works end-to-end
- [ ] Action logits sum to 1 (softmax)
- [ ] Entropy bounded (0 to log(A))
- [ ] Weight updates converge (loss decreases)

RouteSimulator
- [ ] Generates valid episodes (terminal states)
- [ ] Respects constraints (no policy violations)
- [ ] Evaluation metric improves with training

TrainingLoop
- [ ] Converges on synthetic data
- [ ] Early stopping triggers (patience timeout)
- [ ] Checkpoints save + load correctly
- [ ] Metrics logged to Postgres

Integration
- [ ] Ledger consumer reads Phase 1 events
- [ ] OfflineLearningService runs without blocking BridgeOrchestrator
- [ ] Policy checkpoint tables populated
```

---

# **14. PHASE 2 FREEZE & HANDOFF TO PHASE 3**

After Phase 2 completion:

1. All ledger tables populated with training runs
2. Best policy checkpoint locked
3. Evaluation metrics meet target threshold
4. Tag: `v0.2.0-spl-rl-foundation`
5. Handoff to Phase 3 (Canary Gate)

---

End Phase 2 Simulation Harness Contract.
