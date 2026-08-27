import crypto from 'node:crypto';
import { BudgetExhaustedError } from './ledger.js';

export class GuardedProviderError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GuardedProviderError';
    this.code = details.code || 'GUARDED_PROVIDER_ERROR';
    this.model = details.model;
    this.reservationId = details.reservationId;
    this.cause = details.cause;
    this.result = details.result;
    this.actualCost = details.actualCost;
    this.reservedAmount = details.reservedAmount;
    this.releaseError = details.releaseError;
    this.isBudgetExhausted = Boolean(details.isBudgetExhausted || details.code === 'BUDGET_EXHAUSTED' || details.cause instanceof BudgetExhaustedError);
    this.details = details;
  }
}

export class UnknownModelError extends GuardedProviderError {
  constructor(model) {
    super(`Unknown model "${model}": cannot determine rate card for dispatch`, {
      code: 'UNKNOWN_MODEL',
      model,
    });
    this.name = 'UnknownModelError';
  }
}

export class ModelRegistryConflictError extends GuardedProviderError {
  constructor(normalizedModelId, message) {
    super(`Model registry conflict for "${normalizedModelId}": ${message}`, {
      code: 'MODEL_REGISTRY_CONFLICT',
      model: normalizedModelId,
    });
    this.name = 'ModelRegistryConflictError';
  }
}

export function normalizeModelId(modelId) {
  if (typeof modelId !== 'string' || modelId.trim().length === 0) {
    return 'unknown';
  }
  return modelId.trim().toLowerCase().replace(/^openrouter\//, '');
}

export function buildNormalizedModelMap(modelRegistry = {}) {
  const map = new Map();

  for (const [key, meta] of Object.entries(modelRegistry)) {
    if (!meta || typeof meta !== 'object') continue;
    const normalizedKey = normalizeModelId(key);

    if (map.has(normalizedKey)) {
      const existing = map.get(normalizedKey);
      const isFreeSame = Boolean(existing.isFree) === Boolean(meta.isFree);
      const inputCostSame = existing.inputCostPer1M === meta.inputCostPer1M;
      const outputCostSame = existing.outputCostPer1M === meta.outputCostPer1M;

      if (!isFreeSame || !inputCostSame || !outputCostSame) {
        throw new ModelRegistryConflictError(
          normalizedKey,
          `conflicting rate cards detected between alias "${key}" and existing definition`,
        );
      }
    } else {
      map.set(normalizedKey, meta);
    }
  }

  return map;
}

export function estimateModelCost(query, modelRegistry = {}) {
  const normalizedMap = modelRegistry instanceof Map
    ? modelRegistry
    : buildNormalizedModelMap(modelRegistry);

  const modelKey = normalizeModelId(query.model);
  const meta = normalizedMap.get(modelKey);

  if (!meta) {
    throw new UnknownModelError(query.model);
  }

  if (meta.isFree || (meta.inputCostPer1M === 0 && meta.outputCostPer1M === 0)) {
    return 0.0;
  }

  const promptText = typeof query.prompt === 'string' ? query.prompt : '';
  const inputTokens = Math.ceil(promptText.length / 4);

  let outputTokens = 4096;
  if (typeof query.maxTokens === 'number' && query.maxTokens > 0) {
    outputTokens = query.maxTokens;
    if (typeof meta.maxOutputTokens === 'number' && meta.maxOutputTokens > 0) {
      outputTokens = Math.min(outputTokens, meta.maxOutputTokens);
    }
  } else if (typeof meta.maxOutputTokens === 'number' && meta.maxOutputTokens > 0) {
    outputTokens = meta.maxOutputTokens;
  }

  const inputCost = (inputTokens * (meta.inputCostPer1M || 0)) / 1_000_000;
  const outputCost = (outputTokens * (meta.outputCostPer1M || 0)) / 1_000_000;

  // Conservative upper estimate rounded up to 6 decimal places
  return Math.ceil((inputCost + outputCost) * 1e6) / 1e6;
}

export function createGuardedProvider(provider, options = {}) {
  if (!provider || typeof provider.execute !== 'function') {
    throw new Error('createGuardedProvider requires a provider with an execute() method');
  }

  const ledger = options.ledger;
  const providerName = options.providerName || 'unknown-provider';
  const modelRegistry = options.modelRegistry || {};
  const normalizedRegistry = buildNormalizedModelMap(modelRegistry);

  return {
    async execute(query) {
      const normalizedModel = normalizeModelId(query.model);
      const modelMeta = normalizedRegistry.get(normalizedModel);

      if (!modelMeta) {
        throw new UnknownModelError(query.model);
      }

      const estimatedCost = estimateModelCost(query, normalizedRegistry);

      // Free or local model: bypass budget ledger
      if (estimatedCost === 0.0) {
        return provider.execute(query);
      }

      if (!ledger) {
        throw new GuardedProviderError(
          'Paid dispatch requires a configured budget ledger',
          { code: 'LEDGER_REQUIRED', model: normalizedModel }
        );
      }

      // Paid model: atomic reservation
      const reservationId = query.reservationId || crypto.randomUUID();
      try {
        ledger.reserveBudget({
          amount: estimatedCost,
          reservationId,
          provider: providerName,
          model: normalizedModel,
          metadata: query.meta || {},
        });
      } catch (err) {
        if (err instanceof BudgetExhaustedError) {
          throw new GuardedProviderError(`Dispatch blocked: budget exhausted for model "${query.model}"`, {
            code: 'BUDGET_EXHAUSTED',
            model: normalizedModel,
            reservationId,
            cause: err,
            isBudgetExhausted: true,
          });
        }
        throw new GuardedProviderError(`Reservation failed: ${err.message}`, {
          code: 'RESERVATION_FAILED',
          model: normalizedModel,
          reservationId,
          cause: err,
        });
      }

      let result;
      try {
        result = await provider.execute(query);
      } catch (dispatchErr) {
        // Dispatch failed -> release reservation
        let releaseError;
        try {
          ledger.releaseReservation({
            reservationId,
            reason: dispatchErr.message,
          });
        } catch (relErr) {
          releaseError = relErr;
        }

        throw new GuardedProviderError(`Dispatch failed: ${dispatchErr.message}`, {
          code: 'DISPATCH_FAILED',
          model: normalizedModel,
          reservationId,
          cause: dispatchErr,
          releaseError,
        });
      }

      // Dispatch succeeded -> settle reservation
      const actualCost = typeof result.usage?.costUsd === 'number'
        ? Math.round(result.usage.costUsd * 1e6) / 1e6
        : estimatedCost;

      const isOverrun = actualCost > estimatedCost;
      const overrunAmount = isOverrun ? Math.round((actualCost - estimatedCost) * 1e6) / 1e6 : 0;

      try {
        ledger.settleReservation({
          reservationId,
          actualCost,
          metadata: {
            estimatedCost,
            overrun: isOverrun,
            overrunAmount,
            queryId: query.queryId,
          },
        });
      } catch (settleErr) {
        throw new GuardedProviderError(`Settlement failed for reservation ${reservationId}: ${settleErr.message}`, {
          code: 'SETTLEMENT_FAILED',
          model: normalizedModel,
          reservationId,
          actualCost,
          reservedAmount: estimatedCost,
          result,
          cause: settleErr,
        });
      }

      return result;
    },
  };
}
