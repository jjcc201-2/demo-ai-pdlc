import { promises as fs } from "node:fs";
import path from "node:path";
import type { WorkflowState } from "./state.js";

/**
 * Persistent storage layer for workflow run states.
 *
 * Manages serialization and persistence of WorkflowState objects to disk,
 * organizing each run in its own directory with a state.json file. Provides
 * methods to save, load, and enumerate workflow runs.
 */
export class WorkflowStore {
  /**
   * Initialize the workflow store with a root directory.
   *
   * @param rootDir Base directory where all run directories will be created
   */
  constructor(private readonly rootDir: string) {}

  private runDir(runId: string) {
    return path.join(this.rootDir, runId);
  }

  private statePath(runId: string) {
    return path.join(this.runDir(runId), "state.json");
  }

  /**
   * Persist a workflow run state to disk.
   *
   * Creates the run directory if it doesn't exist, updates the state's
   * `updatedAt` timestamp, and writes the state as formatted JSON.
   *
   * @param state The WorkflowState to persist
   */
  async save(state: WorkflowState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await fs.mkdir(this.runDir(state.runId), { recursive: true });
    await fs.writeFile(this.statePath(state.runId), JSON.stringify(state, null, 2), "utf8");
  }

  /**
   * Load a workflow run state from disk.
   *
   * Reads the state.json file for the given run ID and deserializes it.
   *
   * @param runId The unique identifier of the run to load
   * @returns The deserialized WorkflowState
   * @throws Will throw if the run directory or state file does not exist
   */
  async load(runId: string): Promise<WorkflowState> {
    const raw = await fs.readFile(this.statePath(runId), "utf8");
    return JSON.parse(raw) as WorkflowState;
  }

  /**
   * List all workflow run IDs.
   *
   * Returns a list of all directories in the root store directory, each
   * representing a distinct workflow run. Returns an empty array if the
   * root directory does not exist.
   *
   * @returns Array of run IDs
   */
  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.rootDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
}
