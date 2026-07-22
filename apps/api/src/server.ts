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
import { adoAgentConfigured, config } from "./config.js";
import { buildWorkflow } from "./workflow.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const agent = new CopilotAgentClient({
  model: config.model,
  gitHubToken: config.copilot.gitHubToken,
});
const { store, orchestrator } = buildWorkflow(agent);

const app = express();

// CORS: default to the local web app origin. Set PDLC_ALLOWED_ORIGINS to a
// comma-separated list to allow additional origins (e.g. a deployed web UI).
// This is important because mutating routes (transcript upload, publish,
// Azure DevOps apply) trigger real side effects using the server-side
// identity — a wildcard CORS policy would let any page the user visits abuse
// those routes via cross-origin fetch.
const allowedOrigins = (process.env.PDLC_ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
// When running in a GitHub Codespace, the web UI is served from a forwarded
// origin like https://<name>-3000.app.github.dev. Auto-allow it so a browser
// that talks to the API directly (i.e. NEXT_PUBLIC_API_BASE points at the
// forwarded API URL, bypassing the same-origin proxy) isn't blocked by CORS.
// The default path uses Next.js's same-origin /api proxy and never hits this.
const codespaceName = process.env.CODESPACE_NAME;
const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
if (codespaceName && codespaceDomain) {
  allowedOrigins.push(`https://${codespaceName}-3000.${codespaceDomain}`);
}
app.use(
  cors({
    origin(origin, cb) {
      // Same-origin / non-browser (curl, server-to-server) requests have no
      // Origin header — allow those; they can't be triggered by another site.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
  }),
);
app.use(express.json({ limit: "5mb" }));

// Optional shared-secret guard on mutating routes. When PDLC_API_TOKEN is set,
// non-GET requests must include `Authorization: Bearer <token>`. Read-only GETs
// remain unauthenticated so browsers can still load the health endpoint etc.
const apiToken = process.env.PDLC_API_TOKEN;
if (apiToken) {
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "OPTIONS" || req.path === "/health") return next();
    const header = req.header("authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (provided !== apiToken) return res.status(401).json({ error: "unauthorized" });
    return next();
  });
}

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
      adoAgent: Boolean(config.ado.organization),
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
    const stage = req.params.stage as any;
    // Allow `{force: true}` on the publish stage to bypass critical-finding blocking.
    if (stage === "publish" && req.body?.force === true) {
      const s = await store.load(req.params.id);
      s.publishForce = true;
      // Reset a previously errored publish stage so the orchestrator will re-run it.
      if (s.stages.publish.status === "error" || s.stages.publish.status === "done") {
        s.stages.publish = { status: "pending" };
      }
      await store.save(s);
    }
    const state = await orchestrator.runStage(req.params.id, stage);
    // After analyze finishes, automatically kick off the grill stage so the
    // first question is ready — saves the user a manual click.
    if (stage === "analyze" && state.stages.analyze.status === "done") {
      try {
        const grilled = await orchestrator.runStage(req.params.id, "grill");
        return res.json(grilled);
      } catch {
        // If auto-advance fails, fall back to returning the analyze result;
        // the UI can still surface the error via a manual grill run.
      }
    }
    // After publish finishes, automatically run the Work Items plan phase so
    // the user lands on the Work Items page with a preview ready to review.
    if (stage === "publish" && state.stages.publish.status === "done" && adoAgentConfigured()) {
      try {
        const planned = await orchestrator.runStage(req.params.id, "ado");
        return res.json(planned);
      } catch {
        // Fall back to publish result; the Work Items stage can be retried manually.
      }
    }
    res.json(state);
  } catch (e) { next(e); }
});

// --- Work Items stage (Azure DevOps) -----------------------------------
app.get("/api/ado/config", (_req, res) => {
  res.json({
    configured: adoAgentConfigured(),
    organization: config.ado.organization ?? null,
    defaultProject: config.ado.defaultProject ?? null,
  });
});

app.get("/api/ado/projects", async (_req, res, next) => {
  try {
    if (!adoAgentConfigured()) {
      return res.status(503).json({
        error: "The Work Items stage (Azure DevOps) is not configured. Set PDLC_ADO_ORG.",
      });
    }
    // Minimal, dependency-free: hit the ADO REST API using an Entra token
    // from DefaultAzureCredential. Cheaper than spinning up an MCP subprocess
    // just to list projects for the UI dropdown.
    const { DefaultAzureCredential } = await import("@azure/identity");
    const cred = new DefaultAzureCredential();
    const token = await cred.getToken("499b84ac-1321-427f-aa17-267ca6975798/.default");
    if (!token) throw new Error("Failed to acquire Azure DevOps access token");
    const url = `https://dev.azure.com/${encodeURIComponent(
      config.ado.organization!,
    )}/_apis/projects?api-version=7.1-preview.4&stateFilter=wellFormed&$top=200`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${token.token}` } });
    if (!r.ok) {
      return res.status(r.status).json({ error: `ADO list projects failed: ${r.status} ${r.statusText}` });
    }
    const body = await r.json() as { value: Array<{ id: string; name: string }> };
    res.json({ projects: body.value.map((p) => ({ id: p.id, name: p.name })) });
  } catch (e) { next(e); }
});

app.put("/api/runs/:id/ado/target", async (req, res, next) => {
  try {
    const { project } = req.body ?? {};
    if (typeof project !== "string" || !project.trim()) {
      return res.status(400).json({ error: "project required" });
    }
    const s = await store.load(req.params.id);
    const name = project.trim();
    s.adoTargetProject = name;
    // Restore any previously-generated plan / apply result for this project so
    // switching between projects on the same run doesn't lose their state.
    const prevPlan = s.adoPlansByProject?.[name];
    const prevResult = s.adoResultsByProject?.[name];
    s.adoPlan = prevPlan;
    s.adoResult = prevResult;
    // Stage status reflects the currently-selected project: done if a plan
    // exists, pending otherwise.
    s.stages.ado = { status: prevPlan ? "done" : "pending", updatedAt: new Date().toISOString() };
    await store.save(s);
    res.json(s);
  } catch (e) { next(e); }
});

app.post("/api/runs/:id/ado/apply", async (req, res, next) => {
  try {
    if (!adoAgentConfigured()) {
      return res.status(503).json({ error: "The Work Items stage is not configured (PDLC_ADO_ORG unset)." });
    }
    const s = await store.load(req.params.id);
    if (!s.adoPlan) {
      return res.status(400).json({ error: "No plan to apply — run the ado stage first." });
    }
    const { applyAdoPlan } = await import("@pdlc/agents");
    s.stages.ado = { status: "in_progress", updatedAt: new Date().toISOString() };
    await store.save(s);
    try {
      s.adoResult = await applyAdoPlan(agent, s.adoPlan, {
        organization: s.adoPlan.organization,
        project: s.adoPlan.project,
        runId: s.runId,
      });
      s.adoResultsByProject = {
        ...(s.adoResultsByProject ?? {}),
        [s.adoPlan.project]: s.adoResult,
      };
      s.stages.ado = { status: "done", updatedAt: new Date().toISOString() };
      await store.save(s);
      res.json(s);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      s.stages.ado = { status: "error", error: message, updatedAt: new Date().toISOString() };
      await store.save(s);
      throw err;
    }
  } catch (e) { next(e); }
});

// --- Manually edit the BRD markdown before publishing ------------------
app.put("/api/runs/:id/brd", async (req, res, next) => {
  try {
    const { markdown } = req.body ?? {};
    if (typeof markdown !== "string" || markdown.trim().length === 0) {
      return res.status(400).json({ error: "markdown required" });
    }
    const state = await store.load(req.params.id);
    state.brdMarkdown = markdown;
    state.brdEditedByUser = true;
    // The user just edited: mark review + publish as pending again so they can re-run.
    state.stages.review = { status: "pending" };
    state.stages.publish = { status: "pending" };
    await store.save(state);
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
