import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { AgentAskOptions, AgentClient } from "./client.js";

export interface CopilotAgentClientOptions {
  model?: string;
  gitHubToken?: string;
  workingDirectory?: string;
}

/** Real Copilot SDK-backed AgentClient. Reuses a single CopilotClient across asks. */
export class CopilotAgentClient implements AgentClient {
  private client?: CopilotClient;
  private starting?: Promise<void>;

  constructor(private readonly opts: CopilotAgentClientOptions = {}) {}

  private async ensureStarted(): Promise<CopilotClient> {
    if (this.client) return this.client;
    if (!this.starting) {
      const client = new CopilotClient({
        gitHubToken: this.opts.gitHubToken,
        workingDirectory: this.opts.workingDirectory,
      });
      this.starting = client.start().then(() => {
        this.client = client;
      });
    }
    await this.starting;
    return this.client!;
  }

  async ask(opts: AgentAskOptions): Promise<string> {
    const client = await this.ensureStarted();
    const session = await client.createSession({
      model: this.opts.model ?? "claude-sonnet-4.5",
      systemMessage: { mode: "append", content: opts.systemMessage },
      onPermissionRequest: approveAll,
      ...(opts.mcpServers ? { mcpServers: opts.mcpServers } : {}),
    });
    try {
      const retries = opts.expectJson ? opts.jsonRetries ?? 1 : 0;
      let lastText = "";
      for (let attempt = 0; attempt <= retries; attempt++) {
        const suffix =
          attempt > 0
            ? "\n\nYour previous reply was not valid JSON. Return ONLY a JSON object, no code fences, no commentary."
            : "";
        const event = await session.sendAndWait({ prompt: opts.prompt + suffix }, opts.timeoutMs);
        lastText = event?.data.content ?? "";
        if (!opts.expectJson) return lastText;
        try {
          JSON.parse(stripFences(lastText));
          return stripFences(lastText);
        } catch {
          if (attempt === retries) throw new Error(`Model did not return valid JSON: ${lastText.slice(0, 200)}`);
        }
      }
      return lastText;
    } finally {
      await session.disconnect();
    }
  }

  async close(): Promise<void> {
    if (this.client) await this.client.stop();
    this.client = undefined;
    this.starting = undefined;
  }
}

function stripFences(s: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  return (m ? m[1]! : s).trim();
}
