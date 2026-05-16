import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { recordLessonReview, type LessonReviewArtifact, type LessonReviewClassification } from "./lesson-review";

export interface LessonInboxReviewInput {
  repoRoot?: string;
}

export interface LessonInboxReviewIndexEntry {
  candidatePath: string;
  reviewPath: string;
  runId: string;
  taskId: string;
  suggestedArtifactType: string;
  recurrence: {
    taskFamily: string;
    outcome: string;
    count: number;
    threshold: number;
    thresholdMet: boolean;
  };
  recommendedAction: string;
  classification: LessonReviewClassification;
  reason: string;
}

export type LessonPromotionQueueAction =
  | "promote_candidate"
  | "needs_more_evidence"
  | "reject_candidate"
  | "manual_review";

export interface LessonPromotionQueueEntry {
  candidatePath: string;
  reviewPath: string;
  runId: string;
  taskId: string;
  action: LessonPromotionQueueAction;
  reason: string;
}

export interface LessonInboxReviewIndex {
  schemaVersion: 1;
  reviewedAt: string;
  inboxPath: string;
  reviewsPath: string;
  summary: {
    total: number;
    autoRejected: number;
    needsMoreEvidence: number;
    promotionCandidates: number;
    manualReview: number;
  };
  queue: LessonPromotionQueueEntry[];
  candidates: LessonInboxReviewIndexEntry[];
}

export interface LessonInboxReviewResult {
  indexPath: string;
  index: LessonInboxReviewIndex;
}

export interface LessonPromotionQueueReport {
  indexPath: string;
  reviewedAt: string;
  summary: LessonInboxReviewIndex["summary"];
  queue: LessonPromotionQueueEntry[];
}

function isMissingDirectory(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function listInboxCandidates(inboxPath: string): Promise<string[]> {
  try {
    const entries = await readdir(inboxPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => join(inboxPath, entry.name))
      .sort();
  } catch (error) {
    if (isMissingDirectory(error)) return [];
    throw error;
  }
}

function repoRelativePath(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

function indexEntry(input: {
  candidatePath: string;
  reviewPath: string;
  review: LessonReviewArtifact;
}): LessonInboxReviewIndexEntry {
  return {
    candidatePath: input.candidatePath,
    reviewPath: input.reviewPath,
    runId: input.review.runId,
    taskId: input.review.taskId,
    suggestedArtifactType: input.review.suggestedArtifactType,
    recurrence: input.review.recurrence,
    recommendedAction: input.review.recommendedAction,
    classification: input.review.classification,
    reason: input.review.reason,
  };
}

function countClassification(
  entries: LessonInboxReviewIndexEntry[],
  classification: LessonReviewClassification,
): number {
  return entries.filter((entry) => entry.classification === classification).length;
}

function queueAction(classification: LessonReviewClassification): LessonPromotionQueueAction {
  if (classification === "promotion_candidate") return "promote_candidate";
  if (classification === "needs_more_evidence") return "needs_more_evidence";
  if (classification === "auto_rejected") return "reject_candidate";
  return "manual_review";
}

function promotionQueue(entries: LessonInboxReviewIndexEntry[]): LessonPromotionQueueEntry[] {
  const order: Record<LessonPromotionQueueAction, number> = {
    promote_candidate: 0,
    manual_review: 1,
    needs_more_evidence: 2,
    reject_candidate: 3,
  };
  return entries
    .map((entry) => ({
      candidatePath: entry.candidatePath,
      reviewPath: entry.reviewPath,
      runId: entry.runId,
      taskId: entry.taskId,
      action: queueAction(entry.classification),
      reason: entry.reason,
    }))
    .sort(
      (left, right) =>
        order[left.action] - order[right.action] ||
        left.candidatePath.localeCompare(right.candidatePath),
    );
}

export async function reviewLessonInbox(input: LessonInboxReviewInput = {}): Promise<LessonInboxReviewResult> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const inboxPath = join(repoRoot, "references", "lessons", "inbox");
  const reviewsPath = join(repoRoot, "references", "lessons", "reviews");
  const candidates = await listInboxCandidates(inboxPath);
  const entries: LessonInboxReviewIndexEntry[] = [];

  for (const candidatePath of candidates) {
    const result = await recordLessonReview({ candidatePath, repoRoot });
    entries.push(
      indexEntry({
        candidatePath: repoRelativePath(repoRoot, candidatePath),
        reviewPath: repoRelativePath(repoRoot, result.path),
        review: result.review,
      }),
    );
  }

  const index: LessonInboxReviewIndex = {
    schemaVersion: 1,
    reviewedAt: new Date().toISOString(),
    inboxPath: repoRelativePath(repoRoot, inboxPath),
    reviewsPath: repoRelativePath(repoRoot, reviewsPath),
    summary: {
      total: entries.length,
      autoRejected: countClassification(entries, "auto_rejected"),
      needsMoreEvidence: countClassification(entries, "needs_more_evidence"),
      promotionCandidates: countClassification(entries, "promotion_candidate"),
      manualReview: countClassification(entries, "manual_review"),
    },
    queue: promotionQueue(entries),
    candidates: entries,
  };
  const indexPath = join(reviewsPath, "index.json");
  await mkdir(reviewsPath, { recursive: true });
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  return { indexPath, index };
}

export async function buildLessonPromotionQueue(
  input: LessonInboxReviewInput = {},
): Promise<LessonPromotionQueueReport> {
  const result = await reviewLessonInbox(input);
  return {
    indexPath: result.indexPath,
    reviewedAt: result.index.reviewedAt,
    summary: result.index.summary,
    queue: result.index.queue,
  };
}
