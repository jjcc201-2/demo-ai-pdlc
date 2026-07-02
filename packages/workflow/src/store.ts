import { promises as fs } from "node:fs";
import path from "node:path";
import type { WorkflowState } from "./state.js";

export class WorkflowStore {
  constructor(private readonly rootDir: string) {}

  private runDir(runId: string) {
    return path.join(this.rootDir, runId);
  }

  private statePath(runId: string) {
    return path.join(this.runDir(runId), "state.json");
  }

  async save(state: WorkflowState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await fs.mkdir(this.runDir(state.runId), { recursive: true });
    await fs.writeFile(this.statePath(state.runId), JSON.stringify(state, null, 2), "utf8");
  }

  async load(runId: string): Promise<WorkflowState> {
    const raw = await fs.readFile(this.statePath(runId), "utf8");
    return JSON.parse(raw) as WorkflowState;
  }

  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
}
