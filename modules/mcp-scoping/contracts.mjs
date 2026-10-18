import { z } from 'zod';

export const SideEffect = z.enum(['READ_ONLY', 'MUTATING']);
export const RiskTier = z.enum(['LOW', 'STANDARD', 'HIGH']);

export const ToolDefinitionContract = z.object({
  name: z.string().min(1),
  description: z.string(),
  side_effect: SideEffect,
  risk_tier: RiskTier,
  required_capability: z.string().optional(),
  input_schema: z.record(z.string(), z.unknown()),
});

export const ToolBundleContract = z
  .object({
    bundle_id: z.string().regex(/^bundle:[a-z0-9_]+$/),
    domain: z.string(),
    description: z.string(),
    tools: z.array(ToolDefinitionContract).min(1),
    allowed_roles: z.array(z.string()).min(1), // '*' permits any role
    requires_step_up: z.boolean(), // no default: omission must fail validation
    max_mounted_ttl_ms: z.number().int().positive().nullable(), // null = until span end
  })
  .superRefine((bundle, ctx) => {
    const risky = bundle.tools.some((t) => t.side_effect === 'MUTATING' || t.risk_tier === 'HIGH');
    if (risky && !bundle.requires_step_up) {
      ctx.addIssue({
        code: 'custom',
        message: `${bundle.bundle_id}: a MUTATING or HIGH-risk tool requires requires_step_up=true`,
      });
    }
  });

/** Fail-closed ports. Production adapters live outside this file. */

/** Must be RFC 8785 JCS canonicalization of {tool, args} followed by SHA-256. */

