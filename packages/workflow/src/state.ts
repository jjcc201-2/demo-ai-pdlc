export type StageId =
  | "ingest"
  | "analyze"
  | "grill"
  | "draft"
  | "review"
  | "publish"
  | "ado";

export type StageStatus = "pending" | "in_progress" | "done" | "error";

/**
 * Represents a single segment or turn in a meeting transcript.
 */
export interface TranscriptSegment {
  speaker: string;
  text: string;
  startedAtSec?: number;
}

/**
 * A normalized representation of a meeting transcript with metadata.
 *
 * Provides a consistent interface for transcripts sourced from different origins
 * (e.g., Microsoft Graph, manual upload) and includes optional meeting context.
 */
export interface NormalizedTranscript {
  source: "graph" | "manual";
  meetingSubject?: string;
  meetingId?: string;
  occurredAt?: string;
  segments: TranscriptSegment[];
  rawText: string;
}

/**
 * Results from analyzing a transcript to extract key business information.
 *
 * Contains the high-level summary, stakeholders, objectives, and identified gaps
 * that feed into the BRD generation and grilling phases.
 */
export interface AnalysisResult {
  summary: string;
  goals: string[];
  actors: string[];
  painPoints: string[];
  successMetrics: string[];
  openQuestions: Array<{ question: string; brdSection: string }>;
}

/**
 * A single question-answer exchange during the grilling (clarification) phase.
 *
 * Tracks when a question was asked, which BRD section it relates to, and when
 * and how it was answered.
 */
export interface GrillingTurn {
  question: string;
  brdSection: string;
  answer?: string;
  askedAt: string;
  answeredAt?: string;
}

/**
 * Results from the grilling (clarification) phase.
 *
 * Contains all rounds of questions asked and answered, and indicates whether
 * sufficient consensus was reached to proceed to BRD drafting.
 */
export interface GrillingResult {
  rounds: GrillingTurn[];
  consensusReached: boolean;
  reason: string;
}


/**
 * A complete Business Requirements Document (BRD).
 *
 * Contains all sections of a professional BRD including executive summary,
 * business objectives, scope, stakeholders, requirements, success metrics,
 * assumptions, constraints, risks, and open questions.
 *
 * This structure is designed to be rendered into markdown and can be reviewed
 * and edited by stakeholders. Priority levels follow the MoSCoW method
 * (Must, Should, Could, Won't).
 */
export interface BrdDocument {
  title: string;
  version: string;
  author: string;
  createdAt: string;
  executiveSummary: string;
  businessObjectives: string[];
  scope: { inScope: string[]; outOfScope: string[] };
  stakeholders: Array<{ name: string; role: string; interest: string }>;
  businessRequirements: Array<{
    id: string;
    description: string;
    rationale: string;
    priority: "must" | "should" | "could" | "wont";
  }>;
  successMetrics: string[];
  assumptions: string[];
  constraints: string[];
  risks: Array<{ risk: string; mitigation: string }>;
  openQuestions: string[];
}

/**
 * A single finding from BRD review/validation.
 *
 * Represents an issue, suggestion, or observation about a specific section
 * of the generated BRD.
 */
export interface ReviewFinding {
  severity: "critical" | "warning" | "info";
  section: string;
  message: string;
}

/**
 * Results from reviewing and validating the generated BRD.
 *
 * Contains all findings from the review process and an overall pass/fail status.
 * Critical findings typically cause the review to fail.
 *
 * The workflow can be configured to bypass critical findings if the user
 * explicitly approves via the `publishForce` flag in WorkflowState.
 */
export interface ReviewResult {
  findings: ReviewFinding[];
  passed: boolean;
}

/**
 * References for where a generated BRD has been or should be published.
 *
 * Supports multiple publishing destinations, including local filesystem
 * and GitHub repositories.
 */
export interface PublishRefs {
  localPath?: string;
  github?: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
    commitSha: string;
  };
}

/**
 * A single work item proposed by the ADO planner agent (preview phase — nothing
 * is written to Azure DevOps yet).
 */
export interface AdoPlannedWorkItem {
  type: "Epic" | "Feature" | "User Story";
  title: string;
  description: string;
  acceptanceCriteria?: string;
  tags?: string[];
  children?: AdoPlannedWorkItem[];
}

/**
 * Output of the ADO plan phase — a tree of work items and the target project.
 */
export interface AdoPlan {
  project: string;
  organization: string;
  hierarchy: AdoPlannedWorkItem[];
  notes?: string;
  generatedAt: string;
}

/**
 * A single work item that was actually created in Azure DevOps during the
 * apply phase.
 */
export interface AdoCreatedWorkItem {
  id: number;
  type: string;
  title: string;
  url: string;
  parentId?: number;
}

/**
 * Result of running the ADO apply phase.
 */
export interface AdoApplyResult {
  project: string;
  organization: string;
  workItems: AdoCreatedWorkItem[];
  appliedAt: string;
}

/**
 * Complete state of a BRD generation workflow run.
 *
 * Tracks the progression through all pipeline stages (ingest → analyze → grill →
 * draft → review → publish), maintains state for each stage, and stores intermediate
 * results at each phase.
 *
 * Each run has a unique `runId` and maintains a complete audit trail including
 * creation and update timestamps. The `stages` record tracks status and errors
 * for each pipeline phase independently.
 */
export interface WorkflowState {
  runId: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  stages: Record<StageId, { status: StageStatus; error?: string; updatedAt?: string }>;
  transcript?: NormalizedTranscript;
  analysis?: AnalysisResult;
  grilling?: GrillingResult;
  brd?: BrdDocument;
  brdMarkdown?: string;
  brdEditedByUser?: boolean;
  review?: ReviewResult;
  publish?: PublishRefs;
  publishForce?: boolean;
  adoTargetProject?: string;
  adoPlan?: AdoPlan;
  adoResult?: AdoApplyResult;
  /** All plans generated during this run, keyed by ADO project name. */
  adoPlansByProject?: Record<string, AdoPlan>;
  /** All apply results during this run, keyed by ADO project name. */
  adoResultsByProject?: Record<string, AdoApplyResult>;
}

export function createInitialState(runId: string, model: string): WorkflowState {
  const now = new Date().toISOString();
  const stage = { status: "pending" as StageStatus };
  return {
    runId,
    createdAt: now,
    updatedAt: now,
    model,
    stages: {
      ingest: { ...stage },
      analyze: { ...stage },
      grill: { ...stage },
      draft: { ...stage },
      review: { ...stage },
      publish: { ...stage },
      ado: { ...stage },
    },
  };
}
