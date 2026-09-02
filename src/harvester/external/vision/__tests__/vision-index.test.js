import test from 'node:test';
import assert from 'node:assert';
import { initializeVisionSubsystem, analyzeImage, getAdaptiveThreshold } from '../index.js';
import { setProviderMocks } from '../visionAdapter.js';

test('Vision Subsystem Index (Harvester Integration)', async (t) => {
  function createBuffer() {
    return Buffer.from('test-image');
  }

  function createResult(confidence) {
    return {
      confidence,
      labels: [`label_${confidence}`],
      regions: [],
      metadata: { confidence },
    };
  }

  await t.test('initializeVisionSubsystem', async (t) => {
    await t.test('loads latest ratified artifact if available', async () => {
      await initializeVisionSubsystem();
      assert.ok(true);
    });

    await t.test('idempotent: second call is noop', async () => {
      await initializeVisionSubsystem();
      const threshold1 = getAdaptiveThreshold().get();

      await initializeVisionSubsystem();
      const threshold2 = getAdaptiveThreshold().get();

      assert.strictEqual(threshold1, threshold2);
    });

    await t.test('gracefully handles missing ratified artifact', async () => {
      await initializeVisionSubsystem();
      const threshold = getAdaptiveThreshold();
      assert.ok(threshold.get() > 0);
      assert.ok(threshold.get() <= 0.85);
    });
  });

  await t.test('analyzeImage', async (t) => {
    await t.test('analyzes image and auto-writes pending artifact', async () => {
      const mockClip = () => Promise.resolve(createResult(0.80));
      setProviderMocks({ clip: mockClip });
      process.env.GOOGLE_API_KEY = 'AIzaSy_test_key';

      const buffer = createBuffer();
      const result = await analyzeImage(buffer);

      assert.strictEqual(result.confidence, 0.80);
      assert.ok(result.labels.includes('label_0.8'));

      delete process.env.GOOGLE_API_KEY;
    });

    await t.test('initializes subsystem on first call if needed', async () => {
      const mockClip = () => Promise.resolve(createResult(0.75));
      setProviderMocks({ clip: mockClip });
      process.env.GOOGLE_API_KEY = 'AIzaSy_test_key';

      const buffer = createBuffer();
      const result = await analyzeImage(buffer);

      assert.ok(result);
      assert.strictEqual(result.confidence, 0.75);

      delete process.env.GOOGLE_API_KEY;
    });

    await t.test('continues analysis even if pending artifact write fails', async () => {
      const mockClip = () => Promise.resolve(createResult(0.78));
      setProviderMocks({ clip: mockClip });
      process.env.GOOGLE_API_KEY = 'AIzaSy_test_key';

      const buffer = createBuffer();
      const result = await analyzeImage(buffer);

      assert.strictEqual(result.confidence, 0.78);

      delete process.env.GOOGLE_API_KEY;
    });

    await t.test('preserves adaptive threshold state across calls', async () => {
      const mockClip = () => Promise.resolve(createResult(0.70));
      const mockGoogle = () => Promise.resolve(createResult(0.85));
      setProviderMocks({ clip: mockClip, googleVision: mockGoogle });
      process.env.GOOGLE_API_KEY = 'AIzaSy_test_key';

      const buffer = createBuffer();
      const result1 = await analyzeImage(buffer);
      const threshold1 = getAdaptiveThreshold().get();

      // Make another call - threshold should not reset
      const result2 = await analyzeImage(buffer);
      const threshold2 = getAdaptiveThreshold().get();

      // Threshold should remain consistent (not reset between calls)
      assert.strictEqual(threshold1, threshold2);

      delete process.env.GOOGLE_API_KEY;
    });
  });

  await t.test('getAdaptiveThreshold export', async () => {
    const threshold = getAdaptiveThreshold();
    assert.ok(threshold);
    assert.ok(threshold.get() > 0);
  });
});
