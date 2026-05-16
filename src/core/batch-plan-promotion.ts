import type { BatchPlanDraft, BatchPlanDraftClassification } from "./batch-plan-draft";
import { canPromoteBatchPlanDraft } from "./batch-plan-draft";
import type { BatchPlanDraftStoreInput } from "./batch-plan-draft-store";
import { readBatchPlanDraftRecordById } from "./batch-plan-draft-store";

export type BatchPlanPromotionClassification = BatchPlanDraftClassification | "invalid";
export type BatchPlanPromotionReadinessStatus = BatchPlanDraft["promotionReadiness"]["status"] | "invalid";

export interface BatchPlanPromotionPreflightResult {
  mayPromote: boolean;
  violations: string[];
  draftId: string;
  draftPath?: string;
  classification: BatchPlanPromotionClassification;
  promotionReadinessStatus: BatchPlanPromotionReadinessStatus;
  proposedTaskCount: number;
  blockedPlaceholderCount: number;
  nextAction: string;
}

export interface PreflightBatchPlanPromotionOptions {
  draftPath?: string;
}

export type PreflightStoredBatchPlanPromotionInput = BatchPlanDraftStoreInput & {
  draftId: string;
};

const ROUTINE_WRITER_NEXT_ACTION = "run deterministic assembly next";
const PLACEHOLDER_NEXT_ACTION = "resolve structured placeholders before promotion";
const REWORK_NEXT_ACTION = "rework the BatchPlanDraft before promotion";

export function preflightBatchPlanPromotion(
  draft: BatchPlanDraft,
  options: PreflightBatchPlanPromotionOptions = {},
): BatchPlanPromotionPreflightResult {
  const promotion = canPromoteBatchPlanDraft(draft);
  const candidate: Record<string, unknown> = isRecord(draft) ? draft : {};
  const classification = classificationForResult(candidate.classification);
  const blockedPlaceholderCount = countBlockingPlaceholders(candidate.structuredPlaceholders);
  const result: BatchPlanPromotionPreflightResult = {
    mayPromote: promotion.mayPromote,
    violations: promotion.violations,
    draftId: stringForResult(candidate.draftId, "(invalid draftId)"),
    classification,
    promotionReadinessStatus: promotionReadinessStatusForResult(candidate.promotionReadiness),
    proposedTaskCount: Array.isArray(candidate.proposedTasks) ? candidate.proposedTasks.length : 0,
    blockedPlaceholderCount,
    nextAction: nextActionFor({
      mayPromote: promotion.mayPromote,
      classification,
      blockedPlaceholderCount,
    }),
  };

  if (options.draftPath !== undefined) {
    result.draftPath = options.draftPath;
  }

  return result;
}

export async function preflightStoredBatchPlanPromotion(
  input: PreflightStoredBatchPlanPromotionInput,
): Promise<BatchPlanPromotionPreflightResult> {
  const record = await readBatchPlanDraftRecordById(input);
  return preflightBatchPlanPromotion(record.draft, { draftPath: record.path });
}

function nextActionFor(input: {
  mayPromote: boolean;
  classification: BatchPlanPromotionClassification;
  blockedPlaceholderCount: number;
}): string {
  if (input.mayPromote) {
    return ROUTINE_WRITER_NEXT_ACTION;
  }
  if (input.classification !== "routine_writer_batch" && input.classification !== "invalid") {
    return `route to ${routePathForClassification(input.classification)} path before routine writer dispatch`;
  }
  if (input.blockedPlaceholderCount > 0) {
    return PLACEHOLDER_NEXT_ACTION;
  }
  return REWORK_NEXT_ACTION;
}

function routePathForClassification(classification: Exclude<BatchPlanDraftClassification, "routine_writer_batch">): string {
  if (classification === "report_only") {
    return "report";
  }
  return classification;
}

function classificationForResult(value: unknown): BatchPlanPromotionClassification {
  if (
    value === "routine_writer_batch" ||
    value === "report_only" ||
    value === "recovery" ||
    value === "doctrine" ||
    value === "product_boundary" ||
    value === "architecture" ||
    value === "roadmap" ||
    value === "blocked"
  ) {
    return value;
  }
  return "invalid";
}

function promotionReadinessStatusForResult(value: unknown): BatchPlanPromotionReadinessStatus {
  if (!isRecord(value)) {
    return "invalid";
  }
  if (value.status === "ready" || value.status === "needs_placeholders_resolved" || value.status === "blocked") {
    return value.status;
  }
  return "invalid";
}

function countBlockingPlaceholders(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }
  return value.filter((placeholder) => isRecord(placeholder) && placeholder.blocksPromotion === true).length;
}

function stringForResult(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
