import { z } from "zod";
import type { AgentClient } from "./client.js";
import type { AnalysisResult, NormalizedTranscript } from "@pdlc/workflow";

const SYSTEM = `You are a business analyst helping a product team extract BUSINESS VALUE from a meeting transcript.
STRICT RULES:
- Focus on WHAT the team wants to achieve and WHY. Do NOT propose HOW (no technical solutions, no tech stacks, no APIs).
- If the transcript is ambiguous, list the ambiguity as an open question tagged to a BRD section.
- Return JSON only.`;

const Schema = z.object({
  summary: z.string(),
  goals: z.array(z.string()),
  actors: z.array(z.string()),
  painPoints: z.array(z.string()),
  successMetrics: z.array(z.string()),
  openQuestions: z.array(z.object({ question: z.string(), brdSection: z.string() })),
});

export async function analyzeTranscript(
  agent: AgentClient,
  transcript: NormalizedTranscript,
): Promise<AnalysisResult> {
  const prompt = `Analyze the following meeting transcript and return JSON matching this shape:
{
  "summary": string,
  "goals": string[],
  "actors": string[],
  "painPoints": string[],
  "successMetrics": string[],
  "openQuestions": [{ "question": string, "brdSection": string }]
}

Meeting subject: ${transcript.meetingSubject ?? "(unknown)"}
Occurred at: ${transcript.occurredAt ?? "(unknown)"}

Transcript:
"""
${transcript.rawText}
"""`;

  const raw = await agent.ask({ systemMessage: SYSTEM, prompt, expectJson: true, jsonRetries: 2 });
  return Schema.parse(JSON.parse(raw));
}
