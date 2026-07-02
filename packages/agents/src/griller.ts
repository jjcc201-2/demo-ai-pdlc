import { z } from "zod";
import type { AgentClient } from "./client.js";
import type { AnalysisResult, GrillingTurn } from "@pdlc/workflow";

const SYSTEM = `You are a rigorous business analyst running a "grilling" session with a product team.
Your job: eliminate ambiguity in BUSINESS VALUE (what & why). Never ask about implementation, tools, or tech.
Ask ONE focused question at a time. Prefer questions that unblock a specific BRD section.
When you believe the team has consensus on business value across all BRD sections, respond with {"done": true, "reason": "..."}.`;

const Schema = z.union([
  z.object({
    done: z.literal(true),
    reason: z.string(),
  }),
  z.object({
    done: z.literal(false),
    question: z.string(),
    brdSection: z.string(),
  }),
]);

export type NextQuestion =
  | { done: true; reason: string }
  | { done: false; question: string; brdSection: string };

export async function nextGrillingQuestion(
  agent: AgentClient,
  analysis: AnalysisResult,
  history: GrillingTurn[],
  maxRounds: number,
): Promise<NextQuestion> {
  if (history.length >= maxRounds) {
    return { done: true, reason: `Reached max rounds (${maxRounds})` };
  }
  const prompt = `Analyzer output:
${JSON.stringify(analysis, null, 2)}

Conversation so far (previous Q&A):
${JSON.stringify(history, null, 2)}

Decide the next action and return JSON matching one of:
{ "done": true, "reason": string }
{ "done": false, "question": string, "brdSection": string }`;

  const raw = await agent.ask({ systemMessage: SYSTEM, prompt, expectJson: true, jsonRetries: 2 });
  return Schema.parse(JSON.parse(raw)) as NextQuestion;
}
