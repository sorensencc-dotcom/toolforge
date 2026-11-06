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

  it("sends x-cic-route-key when CIC_CREDENTIALED_ROUTE_KEY is set", async () => {
    process.env.CIC_CREDENTIALED_ROUTE_KEY = "fixture-route-key";
    try {
      mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true, data: {} } });
      await executePipeline({ adapter: "familysearch", key: "LV7Q-DGW" });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ headers: { "x-cic-route-key": "fixture-route-key" } })
      );
    } finally {
      delete process.env.CIC_CREDENTIALED_ROUTE_KEY;
    }
  });

  it("omits the header when no route key is configured", async () => {
    delete process.env.CIC_CREDENTIALED_ROUTE_KEY;
    mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true, data: {} } });
    await executePipeline({ adapter: "familysearch", key: "LV7Q-DGW" });
    expect(mockedAxios.post.mock.calls[0][2]).toEqual(expect.objectContaining({ headers: {} }));
  });

  it("validateStatus accepts 2xx, 400, 404, 502 and rejects 401 and 500", async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true, data: {} } });
    await executePipeline({ adapter: "familysearch", key: "LV7Q-DGW" });
    const { validateStatus } = mockedAxios.post.mock.calls[0][2] as any;
    for (const ok of [200, 204, 400, 404, 502]) expect(validateStatus(ok)).toBe(true);
    for (const bad of [401, 403, 500, 503]) expect(validateStatus(bad)).toBe(false);
  });

  it.each([
    [400, "Invalid person id"],
    [404, "Adapter not found: familysearch"],
    [502, "FamilySearch upstream error"],
  ])("returns the structured error for HTTP %i instead of throwing", async (status, error) => {
    mockedAxios.post.mockResolvedValue({
      status,
      data: { success: false, error, driftSignals: [], hydrationFailures: [], stats: { hitRate: 0 } },
    });

    const result = await executePipeline({ adapter: "familysearch", key: "LV7Q-DGW" });

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.httpStatus).toBe(status);
    expect(result.result).toBeUndefined();
  });

  it("propagates other HTTP failures (401, 500) as thrown errors", async () => {
    mockedAxios.post.mockRejectedValue(new Error("Request failed with status code 401"));
    await expect(executePipeline({ adapter: "familysearch", key: "LV7Q-DGW" })).rejects.toThrow("401");
  });
});
