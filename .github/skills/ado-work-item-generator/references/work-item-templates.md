# Work Item Templates & Quality Rules

Field guidance for each work item type. Draft every item against these before creating it in ADO.

## Epic

| Field | Guidance |
|-------|----------|
| **Title** | Outcome-oriented and measurable (e.g., "Enable Shopping Cart Experience for Customers") |
| **Problem Statement** | Current pain or opportunity the source addresses |
| **Business Value** | Expected impact and who benefits |
| **Scope Boundaries** | What is in scope and explicitly out of scope |
| **Success Metrics** | 2–4 measurable KPIs drawn from success criteria |
| **Risks & Dependencies** | Top delivery constraints and assumptions |

## Feature

| Field | Guidance |
|-------|----------|
| **Title** | Capability being introduced (group related user stories) |
| **Capability Statement** | What capability this feature delivers |
| **User/Business Impact** | Why this feature matters |
| **Dependency Map** | Upstream/downstream dependencies |
| **Non-Functional Needs** | Security, performance, reliability, compliance |
| **Acceptance Scope** | Clear entry/exit criteria for completion |

## User Story

| Field | Guidance |
|-------|----------|
| **Title** | Short summary of the story |
| **Story Statement** | "As a \<persona\>, I want \<need\>, so that \<value\>" |
| **Context Links** | Likely repo docs, components, routes, or files impacted |
| **Acceptance Criteria** | Given/When/Then; each criterion testable and atomic |
| **Edge Cases** | Include at least one unhappy path where relevant |
| **Priority** | P1/P2/... mapped from the source |
| **Definition of Done** | Code complete, tests passing, docs updated, peer reviewed |

## Task

| Field | Guidance |
|-------|----------|
| **Title** | Action-oriented (e.g., "Implement CartContext with localStorage persistence") |
| **Description** | What specifically needs to be built or changed |
| **Acceptance Criteria** | Explicit validation checks — each maps to a test case |
| **Estimated Effort** | T-shirt size (S/M/L) based on complexity |

## Bug

| Field | Guidance |
|-------|----------|
| **Title / Problem Summary** | Concise and user-impacting |
| **Reproduction** | Deterministic steps; expected vs actual behavior |
| **Severity & Priority** | Include rationale |
| **Suspected Area** | Likely component/service/location |
| **Fix Acceptance Criteria** | Explicit validation checks after remediation |
| **Link** | Attach to the most relevant Feature or User Story |

## Acceptance Criteria Quality Rules
- Use specific, observable outcomes — avoid vague wording like "works" or "fast".
- Keep each criterion atomic — one behavior per criterion.
- Include both positive and negative scenarios where relevant.
- Include data, permission, and error-handling expectations when applicable.
- Ensure each criterion maps directly to a test case.

## Story Sizing & Readiness Rules
- Prefer stories completable within one sprint; split multi-behavior stories.
- Mark blocked items with explicit dependency references.
- Flag assumptions needing product/architecture confirmation.
- Avoid implementation tasks disguised as user stories.

## Field Mapping Hints (ADO)
Common fields when creating via MCP/CLI:
- Title → `System.Title`
- Description → `System.Description`
- Acceptance Criteria → `Microsoft.VSTS.Common.AcceptanceCriteria`
- Priority → `Microsoft.VSTS.Common.Priority`
- Tags → `System.Tags` (semicolon-separated)
- Area / Iteration → `System.AreaPath` / `System.IterationPath`
- Parent link → relation `System.LinkTypes.Hierarchy-Reverse` (child → parent)
