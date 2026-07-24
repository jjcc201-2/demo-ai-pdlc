---
name: ado-work-item-generator
description: 'Generate AND create a realistic Azure DevOps backlog (Epics, Features, User Stories, Tasks, Bugs) directly in an ADO project. Use when: creating ADO work items, populating a backlog, generating Epics/Features/User Stories/Tasks/Bugs from repo docs or a spec, seeding a demo ADO project, or turning a plan into real work items. Actually writes items via the Azure DevOps MCP (or az boards CLI) — not planning-only.'
argument-hint: 'Optional: ADO org URL, project name, and source (README or specs/<dir>)'
---

# ADO Work Item Generator

Turn repository documentation (or a feature spec) into a real Azure DevOps backlog by
**creating** the work items in the target project — Epics → Features → User Stories → Tasks,
with Bugs linked to the most relevant Feature or User Story.

This skill goes beyond planning: after drafting the hierarchy, it writes the items to ADO
and links them into a correct parent/child structure.

## When to Use
- "Create ADO work items", "populate the backlog", "seed the ADO project"
- Turning a plan, README, or `specs/<dir>/spec.md` into real Epics/Features/Stories/Tasks/Bugs
- Making a demo ADO project feel active and credible with a consistent hierarchy

## Mandatory Preconditions
Confirm ALL of the following **before creating anything**. Stop and ask if any are missing:
1. **ADO organization URL** (e.g., `https://dev.azure.com/<org>`).
2. **ADO project name** (e.g., `OctoCAT Supply`). If provided, it must match exactly — if not, stop and ask.
3. **Source material** — either the repo docs (start at [README](../../../README.md)) or a specific `specs/<dir>/spec.md`.
4. **Write path** — how items will be created (see [Creation Path](#creation-path)). Confirm one is available.

Do NOT invent requirements — every work item must trace back to the source material.

## Procedure

### Step 1 — Gather Source Context
- If a spec directory/file was given (or one is open in the editor), read that `spec.md` fully.
- Otherwise, read the [README](../../../README.md) and follow its links (architecture, deployment, docs, workflows) for scope and architecture.
- Extract: features/capabilities, user stories with priorities, acceptance criteria (Given/When/Then), functional requirements, edge cases, assumptions, success criteria, and key entities.

### Step 2 — Draft the Hierarchy (for approval)
Assign short, friendly placeholder IDs so the user can review before anything is written.
Use a single letter per type plus a running number: `E1` (Epic), `F1` (Feature), `S1` (Story),
`T1` (Task), `B1` (Bug). Numbers increment per type across the whole backlog — they do NOT
encode the parent. Show the parent link with a plain "→ parent" note instead of nesting numbers.

Examples: `E1`, `F3` (→ E1), `S7` (→ F3), `T12` (→ S7), `B2` (→ S7).

Target scale (adjust to source): 5–8 Epics, 20–40 User Stories, supporting Tasks and Bugs, with a
balanced mix of product, platform/reliability, security/compliance, and documentation/enablement work.

Draft each item using the field templates in [work-item-templates](./references/work-item-templates.md).
Present the tree as markdown and **get explicit confirmation before writing to ADO**:

```
## E1 — Epic: [Title]
├── F1 — Feature: [Title]
│   ├── S1 — User Story: [Title] (P1)
│   │   ├── T1 — Task: [Title]
│   │   └── T2 — Task: [Title]
│   └── S2 — User Story: [Title] (P2)
└── F2 — Feature: [Title]
    └── B1 — Bug: [Title] (→ S2)
```

Use the todo tool to track progress across each level as you build and then create it.

### Step 3 — Create Work Items in ADO
Create in dependency order so links resolve correctly:
1. **Epics** first.
2. **Features**, each linked as a child of its Epic.
3. **User Stories**, each linked as a child of its Feature.
4. **Tasks**, each linked as a child of its User Story.
5. **Bugs**, linked to the most relevant Feature or User Story.

For each created item, capture the returned **ADO work item ID** and map it to your placeholder ID
so later links use the real parent ID. See [Creation Path](#creation-path) for exact tool/CLI calls.

Populate the standard fields per type (title, description, acceptance criteria, priority, tags, area/iteration
if provided). Keep acceptance criteria in Given/When/Then and follow the quality rules in the templates.

### Step 4 — Verify and Report
After creation, output:
- **Creation Summary**: counts by type and confirmation the hierarchy links are intact.
- **ID Map**: placeholder ID → real ADO ID (with direct work item URLs when available).
- **Follow-ups**: any items skipped, assumptions made, or fields that need PO/architecture confirmation.

## Creation Path
Use whichever write path is available, in this order of preference:

1. **Azure DevOps MCP server** (preferred). Typical tools:
   - `wit_create_work_item` — create an Epic/Feature/User Story/Task/Bug with fields.
   - `wit_add_child_work_items` or `wit_update_work_item` (add a `System.LinkTypes.Hierarchy-Reverse` parent link) — establish parent/child links.
   - `core_list_projects` — validate the project name before writing.
   Confirm the exact available tool names in this session before calling them.

2. **Azure CLI `az boards`** (fallback). Requires the `azure-devops` extension and a signed-in session:
   ```bash
   az boards work-item create \
     --org "https://dev.azure.com/<org>" \
     --project "<Project>" \
     --title "<Title>" \
     --type "Epic|Feature|User Story|Task|Bug" \
     --fields "Microsoft.VSTS.Common.Priority=2" "System.Tags=demo; security"

   # Link a child to its parent (parent-child hierarchy)
   az boards work-item relation add \
     --org "https://dev.azure.com/<org>" \
     --id <childId> --relation-type parent --target-id <parentId>
   ```

3. **DevOps Work Item Agent** (`wi2`). If direct MCP/CLI access is unavailable, delegate creation to the
   `wi2` / "DevOps Work Item Agent" subagent, passing the confirmed org, project, and the approved hierarchy.

## Guardrails
- Never create items until the project name and org are confirmed and the hierarchy is approved.
- Create parents before children so hierarchy links resolve.
- If a create call fails, stop, report which item failed and why, and do not continue silently.
- Do not modify source code, specs, or infrastructure — only create/link ADO work items.
- Keep naming consistent and repository-specific; avoid generic agile filler.
