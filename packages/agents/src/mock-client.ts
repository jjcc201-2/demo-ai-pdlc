import type { AgentClient, AgentAskOptions } from "./client.js";

/** In-memory canned client used for tests and offline development. */
export class MockAgentClient implements AgentClient {
  public calls: AgentAskOptions[] = [];
  constructor(private readonly responses: string[]) {}

  async ask(opts: AgentAskOptions): Promise<string> {
    this.calls.push(opts);
    const next = this.responses.shift();
    if (next === undefined) throw new Error("MockAgentClient: no more canned responses");
    return next;
  }

  async close(): Promise<void> {}
}
