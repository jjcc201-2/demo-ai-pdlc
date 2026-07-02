export type StageId =
  | "ingest"
  | "analyze"
  | "grill"
  | "draft"
  | "review"
  | "publish";

export type StageStatus = "pending" | "in_progress" | "done" | "error";

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startedAtSec?: number;
}

export interface NormalizedTranscript {
  source: "graph" | "manual";
  meetingSubject?: string;
  meetingId?: string;
  occurredAt?: string;
  segments: TranscriptSegment[];
  rawText: string;
}

export interface AnalysisResult {
  summary: string;
  goals: string[];
  actors: string[];
  painPoints: string[];
  successMetrics: string[];
  openQuestions: Array<{ question: string; brdSection: string }>;
}

export interface GrillingTurn {
  question: string;
  brdSection: string;
  answer?: string;
  askedAt: string;
  answeredAt?: string;
}

export interface GrillingResult {
  rounds: GrillingTurn[];
  consensusReached: boolean;
  reason: string;
}

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

export interface ReviewFinding {
  severity: "critical" | "warning" | "info";
  section: string;
  message: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  passed: boolean;
}

export interface PublishRefs {
  localPath?: string;
  github?: { owner: string; repo: string; branch: string; path: string; commitSha: string };
}

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
  /** Transient flag consumed by the publish stage to bypass critical-finding blocking. */
  publishForce?: boolean;
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
    },
  };
}
