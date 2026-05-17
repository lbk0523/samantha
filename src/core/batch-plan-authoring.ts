import type {
  BatchPlanDraft,
  BatchPlanDraftClassification,
  DependencyHint,
  ParallelizationHint,
  ProposedTask,
  RepoInspectionEvidence,
  StructuredPlaceholder,
} from "./batch-plan-draft";
import { writeBatchPlanDraft } from "./batch-plan-draft-store";

export interface AuthorBatchPlanDraftInput {
  draftId: string;
  createdAt?: string;
  sourceGoal: string;
  classification: BatchPlanDraftClassification;
  repoInspection: RepoInspectionEvidence;
  proposedTasks: ProposedTask[];
  dependencyHints?: DependencyHint[];
  parallelizationHints?: ParallelizationHint[];
  structuredPlaceholders?: StructuredPlaceholder[];
  draftsDir?: string;
  executionBatchesDirHint?: string;
}

export interface AuthorBatchPlanDraftReport {
  pass: boolean;
  written: boolean;
  draftId: string;
  draftPath?: string;
  classification: BatchPlanDraftClassification;
  promotionReadiness: BatchPlanDraft["promotionReadiness"];
  proposedTaskCount: number;
  blockedPlaceholderCount: number;
  pushPerformed: false;
  violations: string[];
  nextAction: string;
}

const DEFAULT_CREATED_AT = "1970-01-01T00:00:00.000Z";

export async function authorBatchPlanDraft(input: AuthorBatchPlanDraftInput): Promise<AuthorBatchPlanDraftReport> {
  const structuredPlaceholders = input.structuredPlaceholders ?? [];
  const blockedPlaceholderCount = countBlockingPlaceholders(structuredPlaceholders);
  const promotionReadiness = promotionReadinessFor({
    classification: input.classification,
    proposedTaskCount: input.proposedTasks.length,
    blockedPlaceholderCount,
  });
  const nextAction = nextActionFor({
    draftId: input.draftId,
    classification: input.classification,
    promotionReadinessStatus: promotionReadiness.status,
    executionBatchesDirHint: input.executionBatchesDirHint,
  });
  const draft: BatchPlanDraft = {
    schemaVersion: 1,
    draftId: input.draftId,
    createdAt: input.createdAt ?? DEFAULT_CREATED_AT,
    sourceGoal: input.sourceGoal,
    classification: input.classification,
    repoInspection: input.repoInspection,
    proposedTasks: input.proposedTasks,
    dependencyHints: input.dependencyHints ?? [],
    parallelizationHints: input.parallelizationHints ?? [],
    structuredPlaceholders,
    autonomyEnvelope: {
      localCommitAllowed: true,
      pushAllowed: false,
      maxReworkCycles: 1,
    },
    promotionReadiness,
    report: {
      summary: "Untrusted BatchPlanDraft planning evidence authored from the source goal.",
      nextAction,
    },
  };

  try {
    const record = await writeBatchPlanDraft({ draftsDir: input.draftsDir, draft });
    return {
      pass: true,
      written: true,
      draftId: input.draftId,
      draftPath: record.path,
      classification: input.classification,
      promotionReadiness,
      proposedTaskCount: input.proposedTasks.length,
      blockedPlaceholderCount,
      pushPerformed: false,
      violations: [],
      nextAction,
    };
  } catch (err) {
    return {
      pass: false,
      written: false,
      draftId: input.draftId,
      classification: input.classification,
      promotionReadiness,
      proposedTaskCount: input.proposedTasks.length,
      blockedPlaceholderCount,
      pushPerformed: false,
      violations: [(err as Error).message],
      nextAction,
    };
  }
}

function promotionReadinessFor(input: {
  classification: BatchPlanDraftClassification;
  proposedTaskCount: number;
  blockedPlaceholderCount: number;
}): BatchPlanDraft["promotionReadiness"] {
  if (input.classification !== "routine_writer_batch") {
    return {
      status: "blocked",
      reasons: [`${input.classification} requests must route before routine writer batch promotion.`],
    };
  }
  if (input.blockedPlaceholderCount > 0) {
    return {
      status: "needs_placeholders_resolved",
      reasons: ["Blocking structured placeholders must be resolved before promotion."],
    };
  }
  if (input.proposedTaskCount > 0) {
    return {
      status: "ready",
      reasons: ["Routine writer batch has proposed tasks and no blocking structured placeholders."],
    };
  }
  return {
    status: "blocked",
    reasons: ["Routine writer batch authoring requires at least one proposed task."],
  };
}

function nextActionFor(input: {
  draftId: string;
  classification: BatchPlanDraftClassification;
  promotionReadinessStatus: BatchPlanDraft["promotionReadiness"]["status"];
  executionBatchesDirHint?: string;
}): string {
  if (input.classification === "routine_writer_batch" && input.promotionReadinessStatus === "ready") {
    return (
      `run batch-plans:prepare --draft-id=${input.draftId} ` +
      `--execution-batches-dir=${input.executionBatchesDirHint ?? "../samantha-execution-batches"}`
    );
  }
  if (input.classification !== "routine_writer_batch") {
    return `route to ${routePathForClassification(input.classification)} path before routine writer dispatch`;
  }
  if (input.promotionReadinessStatus === "needs_placeholders_resolved") {
    return "resolve structured placeholders before batch-plans:prepare";
  }
  return "rework the BatchPlanDraft before batch-plans:prepare";
}

function routePathForClassification(classification: Exclude<BatchPlanDraftClassification, "routine_writer_batch">): string {
  if (classification === "report_only") {
    return "report";
  }
  return classification;
}

function countBlockingPlaceholders(placeholders: StructuredPlaceholder[]): number {
  return placeholders.filter((placeholder) => placeholder.blocksPromotion).length;
}
