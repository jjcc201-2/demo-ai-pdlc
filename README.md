# PDLC — AI-Assisted Product Development Lifecycle Workflow

An AI workflow, built on the [GitHub Copilot SDK](https://github.com/github/copilot-sdk), that turns a Teams meeting into a Business Requirements Document (BRD) — and optionally into a series of epics, features and user stories.

## Contents

- [Overview](#overview)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
  - [Option 1: Codespaces (Recommended)](#option-1-codespaces-recommended)
  - [Option 2: Local IDE](#option-2-local-ide)
- [Additional Configuration](#additional-configuration)
  - [Core Environment Variables](#core-environment-variables)
  - [Work Items Stage (Azure DevOps)](#work-items-stage-azure-devops)
- [Expected Costs](#expected-costs)
- [Operational notes](#operational-notes)

---

## Overview

The workflow runs as a pipeline of stages, each backed by a Copilot SDK agent:

1. **Ingest** — pull the transcript from Microsoft Graph, or upload a `.vtt` / `.docx` / `.txt` file.
2. **Analyze** — extract goals, actors, pain points, and open questions (business value only).
3. **Grill** — the AI asks the product team a focused Q&A loop to lock down what & why.
4. **Draft** — fill a standard BRD from a Zod-validated template.
5. **Review** — schema + LLM review; publish is blocked on critical findings.
6. **Publish** — write BRD markdown to `./out/` and (optionally) commit to a GitHub repo.
7. **Work Items** _(optional)_ — turn the BRD into an Epic -> Feature -> User Story tree (currently for Azure DevOps only)

---

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

---

## Prerequisites

**Required:**

- Node.js `>=22.12.0`
- pnpm `>=9`
- A GitHub Copilot subscription (or BYOK - see the SDK docs).

**Optional:**

- An Azure DevOps organisation and project

---

## Getting started

### Option 1: Codespaces (Recommended)

This repo includes a [dev container](.devcontainer/devcontainer.json) that spins up a ready-to-go environment - Node.js, pnpm, and the Azure CLI are preinstalled, and `pnpm install` + `pnpm build` run automatically on creation. This is the fastest way to get started and avoids any local setup.

1. Click **Code -> Codespaces -> Create codespace on main** on GitHub (or run `gh codespace create` from the CLI).

2. (Optional) open up a terminal in the codespace and run:

   ```bash
   az login # Optional - use if you want to integrate with Azure DevOps
   ```

3. Open two terminals in the codespace and run:

   ```bash
   pnpm dev-api # Terminal 1 - the API server
   ```

   ```bash
   pnpm dev-web # Terminal 2 - Next.js UI
   ```

### Option 2: Local IDE

1. Git clone the repository into your local IDE

2. Ensure your local IDE is autheticated with GitHub Copilot (as this is what powers the app)

3. Run the following commands to install dependencies and build the application

   ```bash
   pnpm install
   cp .env.example .env    # No need to add anything here
   pnpm build

   # Optional - only if you want the Work Items stage to create work items in Azure DevOps:
   az login
   ```

4. Open two terminals in the codespace and run:

   ```bash
   pnpm dev-api # Terminal 1 - the API server
   ```

   ```bash
   pnpm dev-web # Terminal 2 - Next.js UI
   ```

---

## Additional Configuration

### Core Environment Variables

These are the main environment variables you can customise to change the behaviour of the application. See `.env.example` for the full list)

| Environment Variable    | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `PDLC_MODEL`            | Set the default large-language model powering the app (e.g. `sonnet 4.5`)                           |
| `PDLC_REDACT_PII`       | Set `true` to strip emails, phone numbers, and speaker names before sending transcripts to the LLM. |
| `PDLC_MAX_GRILL_ROUNDS` | Set the number of turns GitHub Copilot SDK will interview you about the transcript of your meeting  |

### Work Items Stage (Azure DevOps)

The Work Items stage is optional. When enabled, an autonomous Copilot SDK agent runs after
`publish` and turns the finalised BRD into a work-item tree in Azure DevOps.

| Environment Variable       | Purpose                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `PDLC_ADO_ORG`             | Azure DevOps organisation (e.g. `contoso-39811`). Unset -> Work Items stage disabled. |
| `PDLC_ADO_DEFAULT_PROJECT` | Default project. Overridable per run via the dropdown on the ADO page.                |

---

## Expected Costs

This app uses the GitHub Copilot SDK. This means when the app is running locally, it will use your GitHub Copilot account for authentication and will use up AI credits to function.

---

## Operational Notes

**Note**: This is a demonstration repository. For production deployments, consider implementing additional security measures, monitoring, and governance policies according to your organization's requirements.
