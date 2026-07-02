# PDLC — AI-Assisted Product Development Lifecycle Workflow

An AI workflow, built on the [GitHub Copilot SDK](https://github.com/github/copilot-sdk), that turns a Teams meeting into a Business Requirements Document (BRD).

## Flow

1. **Ingest** — pull the transcript from Microsoft Graph, or upload a `.vtt` / `.docx` / `.txt` file.
2. **Analyze** — extract goals, actors, pain points, and open questions (business value only).
3. **Grill** — the AI asks the product team a focused Q&A loop to lock down what & why.
4. **Draft** — fill a standard BRD from a Zod-validated template.
5. **Review** — schema + LLM review; publish is blocked on critical findings.
6. **Publish** — write BRD markdown to `./out/` and (optionally) commit to a GitHub repo.

## Structure

```
apps/
  api/            Express API + CLI (workflow orchestration)
  web/            Next.js UI (upload, grill, review, publish)
packages/
  workflow/       Typed WorkflowState, JSON store, stage orchestrator
  agents/         Copilot SDK client + Analyzer/Griller/Drafter/Reviewer
  brd/            BRD template + Zod schema + markdown renderer
  transcript/     Graph fetcher + .vtt / .docx parsers + PII redactor
  publisher/      Pluggable Publisher interface + Local + GitHub impls
```

## Prerequisites

- Node.js `>=22.12.0`
- pnpm `>=9`
- A GitHub Copilot subscription (or BYOK — see the SDK docs) — the SDK signs in via `copilot` CLI OAuth, or set `COPILOT_GITHUB_TOKEN`.
- (Optional) Microsoft Graph app registration with `OnlineMeetingTranscript.Read.All` for transcript fetch.
- (Optional) A GitHub PAT with `contents:write` on the target repo for the GitHub publisher.

## Setup

```bash
pnpm install
cp .env.example .env    # fill in what you have
pnpm build
```

## Run

Open two terminals in the project root.

**Terminal 1 — API server** (must show `[pdlc-api] listening on http://localhost:4000`):

```powershell
pnpm dev-api
```

**Terminal 2 — Next.js UI** (opens on http://localhost:3000):

```powershell
pnpm dev-web
```

> **PowerShell tip:** if `pnpm dev-api` prints `>>` and hangs, your shell is waiting for you to close a quote — usually because a non-ASCII character got pasted with the command. Retype the command by hand, or use the fully-qualified equivalent:
>
> ```powershell
> pnpm --filter @pdlc/api run dev
> ```
>
> The colon-suffixed aliases (`pnpm dev:api`, `pnpm dev:web`) also work but are more prone to shell-parsing quirks on Windows PowerShell.

## Non-interactive CLI

```powershell
pnpm cli tests/fixtures/sample.vtt --subject "Portal ideation"
```

## Tests

```bash
pnpm --filter @pdlc/api test
```

The e2e test uses `MockAgentClient` with canned JSON — no Copilot subscription required.

## Extending the publisher

`packages/publisher` exports the `Publisher` interface. Add a Wiki or Confluence adapter by implementing:

```ts
class ConfluencePublisher implements Publisher {
  readonly name = "confluence";
  async publish(target) { /* ... */ }
}
```

then register it in `apps/api/src/workflow.ts`.

## Notes

- Business-value guardrail is enforced in the analyzer and griller system prompts; the reviewer flags any solutioning language it sees.
- Every run is persisted to `runs/<id>/state.json` so a crashed stage can be resumed.
- Set `PDLC_REDACT_PII=true` to strip emails, phone numbers, and speaker names before sending transcripts to the LLM.
- Never commit `.env` — the GitHub publisher also refuses to commit content that matches obvious secret patterns.
