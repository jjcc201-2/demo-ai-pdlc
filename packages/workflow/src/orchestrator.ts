import type { StageId, WorkflowState } from "./state.js";
import { WorkflowStore } from "./store.js";

export type StageHandler = (state: WorkflowState) => Promise<WorkflowState>;

export interface Orchestrator {
  runStage(runId: string, stage: StageId): Promise<WorkflowState>;
  runAll(runId: string, opts?: { stopBefore?: StageId }): Promise<WorkflowState>;
}

const ORDER: StageId[] = ["ingest", "analyze", "grill", "draft", "review", "publish"];

export function createOrchestrator(
  store: WorkflowStore,
  handlers: Record<StageId, StageHandler>,
): Orchestrator {
  async function runStage(runId: string, stage: StageId): Promise<WorkflowState> {
    let state = await store.load(runId);
    const stageInfo = state.stages[stage];
    stageInfo.status = "in_progress";
    stageInfo.updatedAt = new Date().toISOString();
    stageInfo.error = undefined;
    await store.save(state);

    try {
      state = await handlers[stage](state);
      state.stages[stage] = {
        status: "done",
        updatedAt: new Date().toISOString(),
      };
      await store.save(state);
      return state;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      state.stages[stage] = {
        status: "error",
        error: message,
        updatedAt: new Date().toISOString(),
      };
      await store.save(state);
      throw err;
    }
  }

  async function runAll(runId: string, opts?: { stopBefore?: StageId }): Promise<WorkflowState> {
    let state = await store.load(runId);
    for (const stage of ORDER) {
      if (opts?.stopBefore === stage) break;
      if (state.stages[stage].status === "done") continue;
      state = await runStage(runId, stage);
    }
    return state;
  }

  return { runStage, runAll };
}
