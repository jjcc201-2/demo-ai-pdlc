import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { nanoid } from "nanoid";
import {
  createInitialState,
  WorkflowStore,
  createOrchestrator,
  type StageHandler,
  type StageId,
} from "@pdlc/workflow";
import { MockAgentClient, analyzeTranscript, nextGrillingQuestion, draftBrd, reviewBrd } from "@pdlc/agents";
import { renderBrdMarkdown } from "@pdlc/brd";
import { parseVtt } from "@pdlc/transcript";
import { LocalPublisher } from "@pdlc/publisher";

const FIXTURE = path.resolve(__dirname, "..", "..", "..", "tests", "fixtures", "sample.vtt");

describe("PDLC e2e happy path", () => {
  it("runs ingest → publish with mocked agent", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pdlc-e2e-"));
    const runsDir = path.join(tmp, "runs");
    const outDir = path.join(tmp, "out");
    const store = new WorkflowStore(runsDir);
    const publisher = new LocalPublisher(outDir);

    const analyzerJson = JSON.stringify({
      summary: "Customers want self-service invoice access to cut support calls.",
      goals: ["Enable self-service invoice viewing", "Reduce inbound support volume"],
      actors: ["Customer", "Support agent"],
      painPoints: ["High call volume for invoice status"],
      successMetrics: ["30% drop in invoice-related tickets in Q1"],
      openQuestions: [
        { question: "Do enterprise multi-account users need consolidated views?", brdSection: "Scope" },
      ],
    });

    const grillDone = JSON.stringify({ done: true, reason: "Enough business value clarified for MVP." });

    const brdJson = JSON.stringify({
      title: "BRD — Customer self-service portal",
      version: "0.1.0",
      author: "PDLC AI Workflow",
      createdAt: new Date().toISOString(),
      executiveSummary: "Provide customers a self-service portal to view and pay invoices, reducing support load.",
      businessObjectives: ["Reduce invoice-related support tickets by 30% in Q1", "Accelerate cash collection"],
      scope: {
        inScope: ["Invoice viewing", "Online payment", "Multi-account for enterprise"],
        outOfScope: ["Refund workflows"],
      },
      stakeholders: [
        { name: "Alex Chen", role: "Product", interest: "Owns the portal roadmap" },
        { name: "Priya Rao", role: "Support Lead", interest: "Ticket reduction" },
      ],
      businessRequirements: [
        { id: "BR-1", description: "Customers can view invoices online", rationale: "Reduces calls", priority: "must" },
        { id: "BR-2", description: "Customers can pay invoices online", rationale: "Speeds collection", priority: "must" },
      ],
      successMetrics: ["30% drop in invoice-related tickets in Q1"],
      assumptions: ["Customers have valid accounts"],
      constraints: ["Must respect existing billing system of record"],
      risks: [{ risk: "Low adoption", mitigation: "In-app nudges" }],
      openQuestions: ["Multi-account UX pattern"],
    });

    const reviewJson = JSON.stringify({ findings: [] });

    const agent = new MockAgentClient([analyzerJson, grillDone, brdJson, reviewJson]);

    const handlers: Record<StageId, StageHandler> = {
      ingest: async (s) => s,
      analyze: async (s) => ({ ...s, analysis: await analyzeTranscript(agent, s.transcript!) }),
      grill: async (s) => {
        const next = await nextGrillingQuestion(agent, s.analysis!, [], 6);
        if (!("done" in next) || !next.done) throw new Error("expected done");
        return { ...s, grilling: { rounds: [], consensusReached: true, reason: next.reason } };
      },
      draft: async (s) => {
        const brd = await draftBrd(agent, {
          analysis: s.analysis!, grilling: s.grilling!, title: "BRD — Test", author: "Test",
        });
        return { ...s, brd, brdMarkdown: renderBrdMarkdown(brd) };
      },
      review: async (s) => ({ ...s, review: await reviewBrd(agent, s.brd!) }),
      publish: async (s) => ({
        ...s,
        publish: await publisher.publish({ slug: "test", markdown: s.brdMarkdown! }),
      }),
    };

    const orch = createOrchestrator(store, handlers);

    const runId = nanoid(8);
    const state = createInitialState(runId, "mock");
    state.transcript = parseVtt(await fs.readFile(FIXTURE, "utf8"), { meetingSubject: "Portal" });
    await store.save(state);

    const final = await orch.runAll(runId);

    expect(final.stages.publish.status).toBe("done");
    expect(final.review?.passed).toBe(true);
    expect(final.publish?.localPath).toMatch(/BRD-test-.*\.md$/);
    const written = await fs.readFile(final.publish!.localPath!, "utf8");
    expect(written).toContain("# BRD — Customer self-service portal");
    expect(written).toContain("BR-1");
  });
});
