import type { AgentClient } from "./client.js";
import type { AnalysisResult, BrdDocument, GrillingResult } from "@pdlc/workflow";
import { BrdSchema } from "@pdlc/brd";

const SYSTEM = `You are a senior business analyst drafting a Business Requirements Document (BRD).
Fill EVERY required field of the schema. Requirements are BUSINESS requirements only (what & why). No technical detail, no solutioning.
Business requirement IDs must be sequential like "BR-1", "BR-2".
Return JSON only. No commentary, no code fences.`;

export interface DraftContext {
  analysis: AnalysisResult;
  grilling: GrillingResult;
  title: string;
  author: string;
}

export async function draftBrd(
  agent: AgentClient,
  ctx: DraftContext,
): Promise<BrdDocument> {
  const prompt = `Produce a JSON BRD matching this TypeScript type:
{
  title: string;
  version: string;                 // start at "0.1.0"
  author: string;
  createdAt: string;               // ISO datetime
  executiveSummary: string;        // >= 40 chars
  businessObjectives: string[];    // >= 1
  scope: { inScope: string[]; outOfScope: string[] };
  stakeholders: { name: string; role: string; interest: string }[];
  businessRequirements: { id: "BR-<n>"; description: string; rationale: string; priority: "must"|"should"|"could"|"wont" }[];
  successMetrics: string[];
  assumptions: string[];
  constraints: string[];
  risks: { risk: string; mitigation: string }[];
  openQuestions: string[];
}

Use these inputs:
Title: ${ctx.title}
Author: ${ctx.author}

Analyzer output:
${JSON.stringify(ctx.analysis, null, 2)}

Grilling Q&A:
${JSON.stringify(ctx.grilling, null, 2)}`;

  const raw = await agent.ask({ systemMessage: SYSTEM, prompt, expectJson: true, jsonRetries: 2 });
  const parsed = BrdSchema.parse(JSON.parse(raw));
  return parsed as BrdDocument;
}
