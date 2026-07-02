import express from "express";
import cors from "cors";
import multer from "multer";
import { nanoid } from "nanoid";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createInitialState,
  WorkflowStore,
  type WorkflowState,
} from "@pdlc/workflow";
import { CopilotAgentClient } from "@pdlc/agents";
import { parseDocxBuffer, parseVtt, fetchGraphTranscript } from "@pdlc/transcript";
import { config } from "./config.js";
import { buildWorkflow } from "./workflow.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const agent = new CopilotAgentClient({
  model: config.model,
  gitHubToken: config.copilot.gitHubToken,
});
const { store, orchestrator } = buildWorkflow(agent);

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    features: {
      graphTranscript: Boolean(
        config.graph.tenantId && config.graph.clientId && config.graph.clientSecret,
      ),
      githubPublisher: Boolean(
        config.github.token && config.github.owner && config.github.repo,
      ),
    },
  }),
);

// --- Runs ---------------------------------------------------------------
app.post("/api/runs", async (_req, res, next) => {
  try {
    const runId = nanoid(10);
    const state = createInitialState(runId, config.model);
    await store.save(state);
    res.status(201).json(state);
  } catch (e) { next(e); }
});

app.get("/api/runs", async (_req, res, next) => {
  try {
    const ids = await store.list();
    const states = await Promise.all(ids.map((id) => store.load(id).catch(() => null)));
    res.json(states.filter(Boolean));
  } catch (e) { next(e); }
});

app.get("/api/runs/:id", async (req, res, next) => {
  try {
    const state = await store.load(req.params.id);
    res.json(state);
  } catch (e) { next(e); }
});

// --- Ingest: upload transcript -----------------------------------------
app.post("/api/runs/:id/transcript/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const state = await store.load(req.params.id);
    const meta = { meetingSubject: req.body.subject as string | undefined };
    const filename = req.file.originalname.toLowerCase();
    if (filename.endsWith(".vtt")) {
      state.transcript = parseVtt(req.file.buffer.toString("utf8"), meta);
    } else if (filename.endsWith(".docx")) {
      state.transcript = await parseDocxBuffer(req.file.buffer, meta);
    } else if (filename.endsWith(".txt")) {
      state.transcript = {
        source: "manual", segments: [], rawText: req.file.buffer.toString("utf8"), ...meta,
      };
    } else {
      return res.status(415).json({ error: "Supported: .vtt, .docx, .txt" });
    }
    await store.save(state);
    res.json(state);
  } catch (e) { next(e); }
});

// --- Ingest: fetch via Graph -------------------------------------------
app.post("/api/runs/:id/transcript/graph", async (req, res, next) => {
  try {
    const { userId, onlineMeetingId, transcriptId } = req.body ?? {};
    if (!userId || !onlineMeetingId) {
      return res.status(400).json({ error: "userId and onlineMeetingId required" });
    }
    const g = config.graph;
    if (!g.tenantId || !g.clientId || !g.clientSecret) {
      return res.status(503).json({
        error:
          "Graph transcript fetch is not configured on this server. Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET, or use manual upload instead.",
      });
    }
    const state = await store.load(req.params.id);
    state.transcript = await fetchGraphTranscript(
      { tenantId: g.tenantId, clientId: g.clientId, clientSecret: g.clientSecret },
      { userId, onlineMeetingId, transcriptId },
    );
    await store.save(state);
    res.json(state);
  } catch (e) { next(e); }
});

// --- Advance a stage ---------------------------------------------------
app.post("/api/runs/:id/stages/:stage/run", async (req, res, next) => {
  try {
    const state = await orchestrator.runStage(req.params.id, req.params.stage as any);
    res.json(state);
  } catch (e) { next(e); }
});

// --- Answer a pending grilling question --------------------------------
app.post("/api/runs/:id/grill/answer", async (req, res, next) => {
  try {
    const { answer } = req.body ?? {};
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(400).json({ error: "answer required" });
    }
    const state = await store.load(req.params.id);
    const pending = state.grilling?.rounds.at(-1);
    if (!pending || pending.answer) return res.status(400).json({ error: "no pending question" });
    pending.answer = answer.trim();
    pending.answeredAt = new Date().toISOString();
    await store.save(state);
    res.json(state);
  } catch (e) { next(e); }
});

// --- Error handler -----------------------------------------------------
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? String(err) });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[pdlc-api] listening on http://localhost:${config.port}`);
});

process.on("SIGINT", async () => {
  await agent.close();
  process.exit(0);
});

// Ensure dirs exist on boot
await fs.mkdir(config.runsDir, { recursive: true });
await fs.mkdir(config.outDir, { recursive: true });

export type { WorkflowState };
