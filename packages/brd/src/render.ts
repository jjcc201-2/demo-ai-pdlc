import type { BrdDocument } from "@pdlc/workflow";

const bullets = (items: string[]) =>
  items.length === 0 ? "_None_" : items.map((s) => `- ${s}`).join("\n");

export function renderBrdMarkdown(brd: BrdDocument): string {
  const stakeholders =
    brd.stakeholders.length === 0
      ? "_None_"
      : [
          "| Name | Role | Interest |",
          "| --- | --- | --- |",
          ...brd.stakeholders.map(
            (s) => `| ${s.name} | ${s.role} | ${s.interest} |`,
          ),
        ].join("\n");

  const requirements =
    brd.businessRequirements.length === 0
      ? "_None_"
      : [
          "| ID | Priority | Description | Rationale |",
          "| --- | --- | --- | --- |",
          ...brd.businessRequirements.map(
            (r) =>
              `| ${r.id} | ${r.priority.toUpperCase()} | ${r.description} | ${r.rationale} |`,
          ),
        ].join("\n");

  const risks =
    brd.risks.length === 0
      ? "_None_"
      : [
          "| Risk | Mitigation |",
          "| --- | --- |",
          ...brd.risks.map((r) => `| ${r.risk} | ${r.mitigation} |`),
        ].join("\n");

  return `# ${brd.title}

- **Version:** ${brd.version}
- **Author:** ${brd.author}
- **Created:** ${brd.createdAt}

## 1. Executive Summary
${brd.executiveSummary}

## 2. Business Objectives
${bullets(brd.businessObjectives)}

## 3. Scope
### 3.1 In Scope
${bullets(brd.scope.inScope)}

### 3.2 Out of Scope
${bullets(brd.scope.outOfScope)}

## 4. Stakeholders
${stakeholders}

## 5. Business Requirements
${requirements}

## 6. Success Metrics
${bullets(brd.successMetrics)}

## 7. Assumptions
${bullets(brd.assumptions)}

## 8. Constraints
${bullets(brd.constraints)}

## 9. Risks & Mitigations
${risks}

## 10. Open Questions
${bullets(brd.openQuestions)}
`;
}
