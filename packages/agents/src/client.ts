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
}

export interface AgentClient {
  ask(opts: AgentAskOptions): Promise<string>;
  close(): Promise<void>;
}
