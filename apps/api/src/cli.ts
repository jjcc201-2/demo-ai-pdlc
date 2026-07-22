/**
 * CLI: run the workflow end-to-end from a local transcript file.
 * Usage: pnpm run:cli -- <path-to-.vtt|.docx|.txt> [--subject "Meeting subject"]
 *
 * Grilling answers are read from stdin (one line per question) so the CLI can
 * be piped or used interactively for smoke tests.
 */
import "./load-env.js";
import path from "node:path";
import readline from "node:readline/promises";
import { promises as fs } from "node:fs";
import { nanoid } from "nanoid";
import { createInitialState } from "@pdlc/workflow";
import { CopilotAgentClient } from "@pdlc/agents";
import { parseDocxBuffer, parseVtt } from "@pdlc/transcript";
import { config } from "./config.js";
import { buildWorkflow } from "./workflow.js";

async function main() {
  const [, , file, ...rest] = process.argv;
  if (!file) {
    console.error("Usage: pnpm run:cli -- <transcript.vtt|.docx|.txt> [--subject \"...\"]");
    process.exit(1);
  }
  const subjectIdx = rest.indexOf("--subject");
  const subject = subjectIdx >= 0 ? rest[subjectIdx + 1] : undefined;

  const buf = await fs.readFile(file);
  const lower = file.toLowerCase();
  const transcript = lower.endsWith(".vtt")
    ? parseVtt(buf.toString("utf8"), { meetingSubject: subject })
    : lower.endsWith(".docx")
      ? await parseDocxBuffer(buf, { meetingSubject: subject })
      : {
          source: "manual" as const,
          segments: [],
          rawText: buf.toString("utf8"),
          meetingSubject: subject,
        };

  const agent = new CopilotAgentClient({
    model: config.model,
    gitHubToken: config.copilot.gitHubToken,
  });
  const { store, orchestrator } = buildWorkflow(agent);

  const runId = nanoid(10);
  const state = createInitialState(runId, config.model);
  state.transcript = transcript;
  await store.save(state);

  console.log(`[pdlc] run ${runId}`);

  await orchestrator.runStage(runId, "ingest");
  console.log("[pdlc] ingest ✓");
  await orchestrator.runStage(runId, "analyze");
  console.log("[pdlc] analyze ✓");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    const s = await orchestrator.runStage(runId, "grill");
    if (s.grilling?.consensusReached) {
      console.log(`[pdlc] grill ✓ (${s.grilling.reason})`);
      break;
    }
    const q = s.grilling!.rounds.at(-1)!;
    const answer = await rl.question(`Q [${q.brdSection}]: ${q.question}\n> `);
    const cur = await store.load(runId);
    const pending = cur.grilling!.rounds.at(-1)!;
    pending.answer = answer.trim();
    pending.answeredAt = new Date().toISOString();
    await store.save(cur);
  }
  rl.close();

  await orchestrator.runStage(runId, "draft");
  console.log("[pdlc] draft ✓");
  const reviewed = await orchestrator.runStage(runId, "review");
  console.log(`[pdlc] review ✓ (${reviewed.review!.findings.length} findings, passed=${reviewed.review!.passed})`);

  if (!reviewed.review!.passed) {
    console.error("[pdlc] blocked by critical review findings — see state.json");
    await agent.close();
    process.exit(2);
  }

  const published = await orchestrator.runStage(runId, "publish");
  console.log(`[pdlc] publish ✓`, published.publish);

  await agent.close();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
