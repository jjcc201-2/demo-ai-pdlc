import {
  createOrchestrator,
  WorkflowStore,
  type Orchestrator,
  type StageHandler,
  type StageId,
  type WorkflowState,
} from "@pdlc/workflow";
import {
  analyzeTranscript,
  draftBrd,
  nextGrillingQuestion,
  planAdoWorkItems,
  reviewBrd,
  type AgentClient,
} from "@pdlc/agents";
import { renderBrdMarkdown } from "@pdlc/brd";
import { redactPii } from "@pdlc/transcript";
import {
  GitHubPublisher,
  LocalPublisher,
  type Publisher,
} from "@pdlc/publisher";
import { adoAgentConfigured, config, githubPublisherConfigured } from "./config.js";
import { slugify } from "./util.js";

export interface WorkflowServices {
  store: WorkflowStore;
  agent: AgentClient;
  orchestrator: Orchestrator;
  publishers: Publisher[];
}

export function buildWorkflow(agent: AgentClient): WorkflowServices {
  const store = new WorkflowStore(config.runsDir);

  const publishers: Publisher[] = [new LocalPublisher(config.outDir)];
  if (githubPublisherConfigured()) {
    publishers.push(
      new GitHubPublisher({
        token: config.github.token!,
        owner: config.github.owner!,
        repo: config.github.repo!,
        branch: config.github.branch,
        pathPrefix: config.github.pathPrefix,
      }),
    );
  }

  const handlers: Record<StageId, StageHandler> = {
    ingest: async (state) => {
      if (!state.transcript) {
        throw new Error(
          "Ingest stage requires state.transcript to be populated (via upload or Graph fetch) before running.",
        );
      }
      if (config.redactPii) {
        state.transcript = redactPii(state.transcript);
      }
      return state;
    },
    analyze: async (state) => {
      if (!state.transcript) throw new Error("analyze: transcript missing");
      state.analysis = await analyzeTranscript(agent, state.transcript);
      return state;
    },
    grill: async (state) => {
      if (!state.analysis) throw new Error("grill: analysis missing");
      if (!state.grilling) {
        state.grilling = { rounds: [], consensusReached: false, reason: "" };
      }
      // Emit ONE question per invocation. The web UI/CLI must supply the
      // answer for the pending question (last round without answer) before
      // calling runStage('grill') again.
      const rounds = state.grilling.rounds;
      const pending = rounds[rounds.length - 1];
      if (pending && !pending.answer) {
        throw new Error(
          "grill: pending question has no answer yet — submit an answer before advancing this stage.",
        );
      }
      const next = await nextGrillingQuestion(
        agent,
        state.analysis,
        rounds,
        config.maxGrillRounds,
      );
      if (next.done) {
        state.grilling.consensusReached = true;
        state.grilling.reason = next.reason;
      } else {
        rounds.push({
          question: next.question,
          brdSection: next.brdSection,
          askedAt: new Date().toISOString(),
        });
      }
      return state;
    },
    draft: async (state) => {
      if (!state.analysis || !state.grilling) throw new Error("draft: missing prerequisites");
      state.brd = await draftBrd(agent, {
        analysis: state.analysis,
        grilling: state.grilling,
        title: state.transcript?.meetingSubject
          ? `BRD — ${state.transcript.meetingSubject}`
          : "Business Requirements Document",
        author: "PDLC AI Workflow",
      });
      state.brdMarkdown = renderBrdMarkdown(state.brd);
      return state;
    },
    review: async (state) => {
      if (!state.brd) throw new Error("review: brd missing");
      state.review = await reviewBrd(agent, state.brd);
      return state;
    },
    publish: async (state) => {
      if (!state.brdMarkdown || !state.brd) throw new Error("publish: nothing to publish");
      const critical = state.review?.findings.filter((f) => f.severity === "critical") ?? [];
      if (critical.length > 0 && !state.publishForce) {
        throw new Error(
          `publish: blocked by ${critical.length} critical review finding(s). ` +
            `Edit the BRD or retry with force=true to override.`,
        );
      }
      const slug = slugify(state.brd.title);
      const refs = {};
      for (const p of publishers) {
        Object.assign(refs, await p.publish({ slug, markdown: state.brdMarkdown }));
      }
      state.publish = refs;
      state.publishForce = false;
      return state;
    },
    ado: async (state) => {
      // Stage 7 is a no-op when the ADO integration is not configured.
      // The stage still marks itself "done" so the workflow can complete.
      if (!adoAgentConfigured()) return state;
      if (!state.brd || !state.brdMarkdown) {
        throw new Error("ado: BRD missing — publish must complete first");
      }
      if (state.stages.publish.status !== "done") {
        throw new Error("ado: publish must complete before stage 7 can plan");
      }
      const project = state.adoTargetProject ?? config.ado.defaultProject;
      if (!project) {
        throw new Error(
          "ado: no target project — set PDLC_ADO_DEFAULT_PROJECT or POST /api/runs/:id/ado/target before running this stage.",
        );
      }
      state.adoPlan = await planAdoWorkItems(agent, state.brd, {
        organization: config.ado.organization!,
        project,
        runId: state.runId,
      });
      state.adoPlansByProject = {
        ...(state.adoPlansByProject ?? {}),
        [project]: state.adoPlan,
      };
      return state;
    },
  };

  const orchestrator = createOrchestrator(store, handlers);
  return { store, agent, orchestrator, publishers };
}

export type { WorkflowState };
