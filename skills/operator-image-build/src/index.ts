/**
 * operator-image-build
 * Docker image build for harness-v3 and onnx-sidecar
 */

export async function main(input: {
  action?: "build" | "tag" | "push" | "verify" | "import" | "all";
  registry?: string;
  workdir?: string;
  dryRun?: boolean;
}): Promise<{ status: string; images?: string[] }> {
  console.log(`Building operator images with action: ${input.action || "all"}`);

  return {
    status: "stub",
    images: [],
  };
}

export default main;
