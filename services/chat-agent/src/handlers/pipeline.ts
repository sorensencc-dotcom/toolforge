import axios from "axios";
import { getQualitySignal } from "../quality/qualityRoutingSignals";
import { selectModel, ModelSelection } from "../models/ModelSelector";
import { QualityMetrics } from "../quality/types";

const CIC_INGESTION_URL =
  process.env.CIC_INGESTION_URL || "http://localhost:3000";

export interface PipelineRequest {
  adapter: string;
  key: string;
  context?: any;
}

export interface PipelineResponse {
  success: boolean;
  result: any;
  quality: QualityMetrics;
  model: ModelSelection;
  executionTime: number;
}

/**
 * Execute a CIC adapter query, then use its quality metrics
 * (drift signals, hydration failures, warm-pool hit rate) to pick
 * the cheapest model tier that still meets the confidence bar,
 * escalating to the top tier on CRITICAL/HIGH quality signals.
 */
export async function executePipeline(
  request: PipelineRequest
): Promise<PipelineResponse> {
  const startTime = Date.now();

  const adapterResult = await axios.post(
    `${CIC_INGESTION_URL}/execute/${request.adapter}`,
    { key: request.key, payload: request.context || {} },
    { timeout: 15000 }
  );

  const quality: QualityMetrics = {
    driftSignals: adapterResult.data.driftSignals || [],
    hydrationFailures: adapterResult.data.hydrationFailures || [],
    hitRate: adapterResult.data.stats?.hitRate ?? 0,
  };

  const qualitySignal = getQualitySignal(request.adapter, quality);
  const model = selectModel(qualitySignal);

  return {
    success: adapterResult.data.success,
    result: adapterResult.data.data,
    quality,
    model,
    executionTime: Date.now() - startTime,
  };
}
