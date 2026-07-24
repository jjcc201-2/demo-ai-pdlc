import type { MCPServerConfig } from "@github/copilot-sdk";

/**
 * Thin, mockable interface over the Copilot SDK.
 * Anything the workflow needs from an LLM goes through here so tests can
 * inject a canned client without spawning the CLI.
 */
export interface AgentAskOptions {
  systemMessage: string;
  prompt: string;
  /** When provided, the runner will retry up to N times if JSON.parse fails. */
  expectJson?: boolean;
  jsonRetries?: number;
  /** Optional MCP servers to attach to this session (e.g. Azure DevOps). */
  mcpServers?: Record<string, MCPServerConfig>;
  /**
   * Hard cap on the number of assistant turns for tool-using sessions.
   * Ignored for plain single-shot asks.
   */
  maxTurns?: number;
  /**
   * Per-call idle timeout in milliseconds (default 60_000 in the SDK).
   * Increase for long JSON generations or tool-using sessions.
   */
  timeoutMs?: number;
}

export interface AgentClient {
  ask(opts: AgentAskOptions): Promise<string>;
  close(): Promise<void>;
}
