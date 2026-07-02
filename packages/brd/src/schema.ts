import { z } from "zod";

export const BrdSchema = z.object({
  title: z.string().min(3),
  version: z.string().min(1),
  author: z.string().min(1),
  createdAt: z.string().min(1),
  executiveSummary: z.string().min(40, "Executive summary is too short"),
  businessObjectives: z.array(z.string().min(3)).min(1),
  scope: z.object({
    inScope: z.array(z.string().min(3)).min(1),
    outOfScope: z.array(z.string()).default([]),
  }),
  stakeholders: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        interest: z.string().min(1),
      }),
    )
    .min(1),
  businessRequirements: z
    .array(
      z.object({
        id: z.string().regex(/^BR-\d+$/i, "Requirement id must match BR-<n>"),
        description: z.string().min(5),
        rationale: z.string().min(5),
        priority: z.enum(["must", "should", "could", "wont"]),
      }),
    )
    .min(1),
  successMetrics: z.array(z.string().min(3)).min(1),
  assumptions: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  risks: z
    .array(z.object({ risk: z.string().min(3), mitigation: z.string().min(3) }))
    .default([]),
  openQuestions: z.array(z.string()).default([]),
});

export type BrdInput = z.infer<typeof BrdSchema>;
