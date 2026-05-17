import {
  preflightStoredBatchPlanPromotion,
  type BatchPlanPromotionClassification,
  type BatchPlanPromotionReadinessStatus,
} from "./batch-plan-promotion";
import type { BatchPlanDraftStoreInput } from "./batch-plan-draft-store";

export type BatchPlanReviewInput = BatchPlanDraftStoreInput & {
  draftId: string;
};

export interface BatchPlanReviewReport {
  reviewed: true;
  draftId: string;
  draftPath?: string;
  classification: BatchPlanPromotionClassification;
  promotionReadiness: {
    status: BatchPlanPromotionReadinessStatus;
  };
  prepareEligible: boolean;
  trustedForDispatch: false;
  pushPerformed: false;
  findings: string[];
  violations: string[];
  nextAction: string;
}

export async function reviewStoredBatchPlanDraft(input: BatchPlanReviewInput): Promise<BatchPlanReviewReport> {
  const preflight = await preflightStoredBatchPlanPromotion(input);
  const report: BatchPlanReviewReport = {
    reviewed: true,
    draftId: preflight.draftId,
    classification: preflight.classification,
    promotionReadiness: {
      status: preflight.promotionReadinessStatus,
    },
    prepareEligible: preflight.mayPromote,
    trustedForDispatch: false,
    pushPerformed: false,
    findings: findingsFor(preflight),
    violations: [...preflight.violations],
    nextAction: nextActionFor(preflight),
  };

  if (preflight.draftPath !== undefined) {
    report.draftPath = preflight.draftPath;
  }

  return report;
}

function findingsFor(preflight: Awaited<ReturnType<typeof preflightStoredBatchPlanPromotion>>): string[] {
  const findings = [
    `classification: ${preflight.classification}`,
    `promotionReadiness.status: ${preflight.promotionReadinessStatus}`,
    `proposedTaskCount: ${preflight.proposedTaskCount}`,
    `blockedPlaceholderCount: ${preflight.blockedPlaceholderCount}`,
  ];

  if (preflight.mayPromote) {
    findings.push("review is prepare-eligible but not trusted for dispatch");
  }

  return findings;
}

function nextActionFor(preflight: Awaited<ReturnType<typeof preflightStoredBatchPlanPromotion>>): string {
  if (preflight.mayPromote) {
    return `run batch-plans:prepare --draft-id=${preflight.draftId} with an explicit execution batch store; prepare remains the deterministic gate`;
  }
  if (preflight.classification !== "routine_writer_batch" && preflight.classification !== "invalid") {
    return preflight.nextAction;
  }
  return "rework the BatchPlanDraft before batch-plans:prepare";
}
