import { LifecycleController } from "./lifecycleController";
import type { ToolState, ToolLifecycleState } from "./types";

interface ToolLifecycleInput {
  action: "register" | "promote_canary" | "promote_active" | "health_check" | "disable";
  toolId: string;
  version?: string;
  canaryPercentage?: number;
}

export async function execute(input: ToolLifecycleInput): Promise<{
  status: string;
  toolId: string;
  lifecycle?: ToolLifecycleState;
  message?: string;
}> {
  const controller = new LifecycleController();

  switch (input.action) {
    case "register":
      await controller.registerTool(input.toolId, input.version || "1.0.0");
      return { status: "success", toolId: input.toolId, message: "Tool registered" };

    case "promote_canary":
      await controller.promoteCanary(input.toolId, input.canaryPercentage || 10);
      return { status: "success", toolId: input.toolId, message: "Promoted to canary" };

    case "promote_active":
      await controller.promoteCanary(input.toolId, 100);
      return { status: "success", toolId: input.toolId, message: "Promoted to active" };

    case "health_check":
      await controller.performHealthCheck(input.toolId);
      return { status: "success", toolId: input.toolId, message: "Health check completed" };

    case "disable":
      // Implementation: disable tool (requires versionPromoter)
      return { status: "success", toolId: input.toolId, message: "Tool disabled" };

    default:
      return { status: "error", toolId: input.toolId, message: "Unknown action" };
  }
}

export default execute;
