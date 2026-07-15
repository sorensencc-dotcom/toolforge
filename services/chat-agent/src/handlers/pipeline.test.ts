import axios from "axios";
import { executePipeline } from "./pipeline";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("executePipeline", () => {
  afterEach(() => jest.resetAllMocks());

  it("routes to the cheapest model when CIC reports a healthy hit rate", async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        data: { name: "Ancestor" },
        driftSignals: [],
        hydrationFailures: [],
        stats: { hitRate: 0.95 },
      },
    });

    const result = await executePipeline({ adapter: "familysearch", key: "KWZ3-123" });

    expect(result.success).toBe(true);
    expect(result.model.modelId).toBe("local:llama-8b");
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining("/execute/familysearch"),
      expect.objectContaining({ key: "KWZ3-123" }),
      expect.any(Object)
    );
  });

  it("escalates to the premium model when CIC reports a CRITICAL drift signal", async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        data: { name: "Ancestor" },
        driftSignals: [{ severity: "CRITICAL" }],
        hydrationFailures: [],
        stats: { hitRate: 0.95 },
      },
    });

    const result = await executePipeline({ adapter: "familysearch", key: "KWZ3-123" });

    expect(result.model.modelId).toBe("premium:opus");
  });

  it("defaults hitRate to 0 when CIC omits stats", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { success: false, data: null, driftSignals: [], hydrationFailures: [] },
    });

    const result = await executePipeline({ adapter: "familysearch", key: "KWZ3-123" });

    expect(result.quality.hitRate).toBe(0);
  });
});
