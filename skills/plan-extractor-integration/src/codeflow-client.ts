// codeflow-client.ts
// HTTP client for CodeFlow analyzer API

export class CodeFlowClient {
  constructor(private codeflowUrl: string) {}

  async analyze(repoPath: string): Promise<any> {
    const url = `${this.codeflowUrl.replace(/\/$/, '')}/analyze`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoPath }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CodeFlow analysis failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;
    if (!data.success) {
      throw new Error(`CodeFlow analysis failed: ${data.error || 'unknown error'}`);
    }

    return data.result;
  }
}
