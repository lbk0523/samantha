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
  candidates: LessonInboxReviewIndexEntry[];
}

export interface LessonInboxReviewResult {
  indexPath: string;
  index: LessonInboxReviewIndex;
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
    candidates: entries,
  };
  const indexPath = join(reviewsPath, "index.json");
  await mkdir(reviewsPath, { recursive: true });
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  return { indexPath, index };
}
