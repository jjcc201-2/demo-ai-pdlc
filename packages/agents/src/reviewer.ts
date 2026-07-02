import { z } from "zod";
import type { AgentClient } from "./client.js";
import type { BrdDocument, ReviewFinding, ReviewResult } from "@pdlc/workflow";
import { BrdSchema } from "@pdlc/brd";

const SYSTEM = `You are a BRD reviewer. Check the document for:
- Missing or vague sections
- Requirements that describe HOW (tech/solution) instead of WHAT/WHY
- Contradictions with the grilling Q&A
- Weak or unmeasurable success metrics

Return JSON only.`;

const FindingsSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(["critical", "warning", "info"]),
      section: z.string(),
      message: z.string(),
    }),
  ),
});

export async function reviewBrd(
  agent: AgentClient,
  brd: BrdDocument,
): Promise<ReviewResult> {
  const findings: ReviewFinding[] = [];

  // 1. Deterministic schema check
  const parsed = BrdSchema.safeParse(brd);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push({
        severity: "critical",
        section: issue.path.join(".") || "(root)",
        message: issue.message,
      });
    }
  }

  // 2. LLM review
  const prompt = `Review this BRD JSON and return { "findings": [...] } matching:
{ severity: "critical" | "warning" | "info", section: string, message: string }[]

BRD:
${JSON.stringify(brd, null, 2)}`;

  const raw = await agent.ask({ systemMessage: SYSTEM, prompt, expectJson: true, jsonRetries: 2 });
  const llm = FindingsSchema.parse(JSON.parse(raw));
  findings.push(...llm.findings);

  return {
    findings,
    passed: !findings.some((f) => f.severity === "critical"),
  };
}
