# PDLC — AI-Assisted Product Development Lifecycle Workflow

An AI workflow, built on the [GitHub Copilot SDK](https://github.com/github/copilot-sdk), that turns a Teams meeting into a Business Requirements Document (BRD) — and optionally into a ready-to-groom Azure DevOps backlog.

## Contents

- [Overview](#overview)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
  - [Setup](#setup)
  - [Run the app](#run-the-app)
  - [Non-interactive CLI](#non-interactive-cli)
- [Testing](#testing)
- [Configuration](#configuration)
  - [Core env vars](#core-env-vars)
  - [Azure DevOps (stage 7)](#azure-devops-stage-7)
  - [API access control](#api-access-control)
- [Extending the publisher](#extending-the-publisher)
- [Operational notes](#operational-notes)

## Overview

The workflow runs as a pipeline of stages, each backed by a Copilot SDK agent:

1. **Ingest** — pull the transcript from Microsoft Graph, or upload a `.vtt` / `.docx` / `.txt` file.
2. **Analyze** — extract goals, actors, pain points, and open questions (business value only).
3. **Grill** — the AI asks the product team a focused Q&A loop to lock down what & why.
4. **Draft** — fill a standard BRD from a Zod-validated template.
5. **Review** — schema + LLM review; publish is blocked on critical findings.
6. **Publish** — write BRD markdown to `./out/` and (optionally) commit to a GitHub repo.
7. **Azure DevOps** *(optional)* — turn the BRD into an Epic -> Feature -> User Story tree in Azure DevOps.

## Project structure

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

**Required:**
- Node.js `>=22.12.0`
- pnpm `>=9`
- A GitHub Copilot subscription (or BYOK - see the SDK docs) - the SDK signs in via `copilot` CLI OAuth, or set `COPILOT_GITHUB_TOKEN`.

**Optional, depending on which features you use:**
- Microsoft Graph app registration with `OnlineMeetingTranscript.Read.All`, for automatic transcript fetch (otherwise, upload a file manually).
- A GitHub PAT with `contents:write` on the target repo, for the GitHub publisher.
- The [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) plus a signed-in session (`az login`), to push work items into Azure DevOps. Stage 7 uses `DefaultAzureCredential`, which picks up your `az login` credentials automatically in local dev.

## Getting started

### Setup

```bash
pnpm install
cp .env.example .env    # fill in what you have
pnpm build

# Optional - only if you want stage 7 to create work items in Azure DevOps:
az login
```

### Run the app

Open two terminals in the project root.

**Terminal 1 - API server** (must show `[pdlc-api] listening on http://localhost:4000`):

```powershell
pnpm dev-api
```

**Terminal 2 - Next.js UI** (opens on http://localhost:3000):

```powershell
pnpm dev-web
```

> **PowerShell tip:** if `pnpm dev-api` prints `>>` and hangs, your shell is waiting for you to close a quote - usually because a non-ASCII character got pasted with the command. Retype the command by hand, or use the fully-qualified equivalent:
>
> ```powershell
> pnpm --filter @pdlc/api run dev
> ```
>
> The colon-suffixed aliases (`pnpm dev:api`, `pnpm dev:web`) also work but are more prone to shell-parsing quirks on Windows PowerShell.

### Non-interactive CLI

```powershell
pnpm cli tests/fixtures/sample.vtt --subject "Portal ideation"
```

## Testing

```bash
pnpm --filter @pdlc/api test
```

The e2e test uses `MockAgentClient` with canned JSON responses, so it runs the full `ingest -> publish` pipeline without needing a Copilot subscription.

## Configuration

### Core env vars

| Env var | Purpose |
| --- | --- |
| `PDLC_REDACT_PII` | Set `true` to strip emails, phone numbers, and speaker names before sending transcripts to the LLM. |
| `COPILOT_GITHUB_TOKEN` | Alternative to interactive `copilot` CLI OAuth for Copilot SDK auth. |

See `.env.example` for the full list, including Microsoft Graph and GitHub publisher settings.

### Azure DevOps (stage 7)

Stage 7 is optional. When enabled, an autonomous Copilot SDK agent runs after
`publish` and turns the finalised BRD into a work-item tree in Azure DevOps.
It has two sub-phases:

1. **Plan** - the agent reads the BRD and drafts an Epic -> Feature -> User Story
   tree (no writes). The plan appears in the UI at `/runs/<id>/ado`.
2. **Apply** - clicking **Apply** attaches the [Azure DevOps MCP
   server](https://github.com/microsoft/azure-devops-mcp) to a fresh Copilot
   session and lets the agent execute the plan through its tools, creating
   and linking each work item with tags `pdlc` and `run:<runId>`.

Configuration:

| Env var | Purpose |
| --- | --- |
| `PDLC_ADO_ORG` | Azure DevOps organisation (e.g. `contoso-39811`). Unset -> stage 7 disabled. |
| `PDLC_ADO_DEFAULT_PROJECT` | Default project. Overridable per run via the dropdown on the ADO page. |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | Service principal (prod). Optional in dev. |

Authentication uses `@azure/identity`'s `DefaultAzureCredential`:

- **Local dev**: `az login` - no extra config, the CLI credential is picked up.
- **Deployed to Azure**: use a managed identity, or set the three
  `AZURE_*` service-principal env vars as secrets.

Same code path in both environments - no branching required.

### API access control

The API applies two defence-in-depth controls, both configurable via env vars:

- **Origin allowlist** - cross-origin browser requests are rejected unless the
  `Origin` header is in `PDLC_ALLOWED_ORIGINS` (comma-separated). Defaults to
  `http://localhost:3000` when unset. Non-browser callers (no `Origin` header)
  are always allowed.
- **Token auth (optional)** - set `PDLC_API_TOKEN` on the API and
  `NEXT_PUBLIC_API_TOKEN` on the web app to require a matching bearer
  credential on every non-`GET` request. Recommended whenever the API is
  exposed beyond localhost.

## Extending the publisher

`packages/publisher` exports the `Publisher` interface. Add a Wiki or Confluence adapter by implementing:

```ts
class ConfluencePublisher implements Publisher {
  readonly name = "confluence";
  async publish(target) { /* ... */ }
}
```

then register it in `apps/api/src/workflow.ts`.

## Operational notes

- Business-value guardrail is enforced in the analyzer and griller system prompts; the reviewer flags any solutioning language it sees.
- Every run is persisted to `runs/<id>/state.json` so a crashed stage can be resumed.
- Never commit `.env` - the GitHub publisher also refuses to commit content that matches obvious secret patterns.