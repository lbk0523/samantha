import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type LessonRecommendedAction = "promote_playbook" | "reject" | "manual_review";
export type LessonReviewClassification =
  | "auto_rejected"
  | "needs_more_evidence"
  | "promotion_candidate"
  | "manual_review";

export interface LessonRecurrence {
  taskFamily: string;
  outcome: string;
  count: number;
  threshold: number;
  thresholdMet: boolean;
}

export interface LessonReviewInput {
  candidatePath: string;
}

export interface LessonReviewArtifact {
  schemaVersion: 1;
  candidatePath: string;
  reviewedAt: string;
  runId: string;
  taskId: string;
  observedOutcome: string;
  suggestedArtifactType: string;
  superseded: {
    stale: boolean;
    status: string;
    supersedingRunId?: string;
  };
  recurrence: LessonRecurrence;
  recommendedAction: LessonRecommendedAction;
  classification: LessonReviewClassification;
  reason: string;
}

export interface LessonReviewArtifactResult {
  path: string;
  review: LessonReviewArtifact;
}

export interface LessonReview {
  runId: string;
  sourcePath: string;
  taskId: string;
  taskTitle: string;
  runLogPath: string;
  observedOutcome: string;
  failureReason?: string;
  suggestedArtifactType: string;
  superseded: {
    stale: boolean;
    status: string;
    supersedingRunId?: string;
  };
  recurrence: LessonRecurrence;
  recommendedAction: LessonRecommendedAction;
  proposedLesson: string;
  affectedLayer: string;
  riskIfAdopted: string;
}

function bulletValue(markdown: string, label: string): string | undefined {
  const prefix = `- ${label}: `;
  const line = markdown.split("\n").find((item) => item.startsWith(prefix));
  return line?.slice(prefix.length).trim();
}

function titleRunId(markdown: string): string | undefined {
  const line = markdown.split("\n").find((item) => item.startsWith("# Lesson Candidate: "));
  return line?.slice("# Lesson Candidate: ".length).trim();
}

function taskFamily(taskId: string): string {
  return taskId.replace(/-v\d+$/, "");
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isPlaybookLessonCandidate(suggestedArtifactType: string): boolean {
  const artifactType = suggestedArtifactType.toLowerCase();
  return artifactType === "playbook" || artifactType === "playbook promotion candidate";
}

function recommendedAction(input: {
  stale: boolean;
  suggestedArtifactType: string;
  recurrence: LessonRecurrence;
}): LessonRecommendedAction {
  const artifactType = input.suggestedArtifactType.toLowerCase();
  if (input.stale || artifactType.includes("no promotion")) return "reject";
  if (isPlaybookLessonCandidate(input.suggestedArtifactType) && input.recurrence.thresholdMet) {
    return "promote_playbook";
  }
  return "manual_review";
}

function recommendationReason(review: LessonReview): string {
  const reasons: string[] = [];
  if (review.superseded.stale && review.superseded.status !== "not detected") {
    reasons.push(`superseded: ${review.superseded.status}`);
  }
  if (review.suggestedArtifactType.toLowerCase().includes("no promotion")) {
    reasons.push("suggested artifact type marks no promotion");
  }
  if (reasons.length > 0) return reasons.join("; ");
  if (review.recommendedAction === "promote_playbook") return "playbook candidate is ready for manual promotion";
  if (isPlaybookLessonCandidate(review.suggestedArtifactType)) {
    return `playbook candidate needs more evidence before promotion (${review.recurrence.count}/${review.recurrence.threshold})`;
  }
  return "suggested artifact type requires manual review";
}

function reviewArtifactPath(input: { candidatePath: string; runId: string }): string {
  return join(dirname(dirname(input.candidatePath)), "reviews", `${input.runId}.json`);
}

export function classifyLessonReview(review: LessonReview): LessonReviewClassification {
  if (review.recommendedAction === "reject") return "auto_rejected";
  if (review.recommendedAction === "promote_playbook") return "promotion_candidate";
  if (isPlaybookLessonCandidate(review.suggestedArtifactType)) return "needs_more_evidence";
  return "manual_review";
}

function toReviewArtifact(input: { review: LessonReview; reviewedAt: string }): LessonReviewArtifact {
  return {
    schemaVersion: 1,
    candidatePath: input.review.sourcePath,
    reviewedAt: input.reviewedAt,
    runId: input.review.runId,
    taskId: input.review.taskId,
    observedOutcome: input.review.observedOutcome,
    suggestedArtifactType: input.review.suggestedArtifactType,
    superseded: input.review.superseded,
    recurrence: input.review.recurrence,
    recommendedAction: input.review.recommendedAction,
    classification: classifyLessonReview(input.review),
    reason: recommendationReason(input.review),
  };
}

export function reviewLessonCandidateMarkdown(input: {
  markdown: string;
  sourcePath: string;
}): LessonReview {
  const taskId = bulletValue(input.markdown, "Task id") ?? "";
  const observedOutcome = bulletValue(input.markdown, "Observed outcome") ?? "";
  const suggestedArtifactType = bulletValue(input.markdown, "Suggested artifact type") ?? "";
  const supersededStatus = bulletValue(input.markdown, "Superseded status") ?? "not detected";
  const stale = supersededStatus !== "not detected" || suggestedArtifactType.toLowerCase().includes("no promotion");
  const recurrenceCount = positiveInt(bulletValue(input.markdown, "Recurrence count"), 1);
  const recurrenceThreshold = positiveInt(bulletValue(input.markdown, "Promotion threshold"), 2);
  const recurrence: LessonRecurrence = {
    taskFamily: bulletValue(input.markdown, "Task family") ?? taskFamily(taskId),
    outcome: bulletValue(input.markdown, "Recurrence outcome") ?? observedOutcome,
    count: recurrenceCount,
    threshold: recurrenceThreshold,
    thresholdMet: recurrenceCount >= recurrenceThreshold,
  };

  return {
    runId: bulletValue(input.markdown, "Source run id") ?? titleRunId(input.markdown) ?? "",
    sourcePath: input.sourcePath,
    taskId,
    taskTitle: bulletValue(input.markdown, "Task title") ?? "",
    runLogPath: bulletValue(input.markdown, "Run log") ?? "",
    observedOutcome,
    ...(bulletValue(input.markdown, "Failure reason")
      ? { failureReason: bulletValue(input.markdown, "Failure reason") }
      : {}),
    suggestedArtifactType,
    superseded: {
      stale,
      status: supersededStatus,
      ...(bulletValue(input.markdown, "Superseding run id")
        ? { supersedingRunId: bulletValue(input.markdown, "Superseding run id") }
        : {}),
    },
    recurrence,
    recommendedAction: recommendedAction({ stale, suggestedArtifactType, recurrence }),
    proposedLesson: bulletValue(input.markdown, "Proposed lesson") ?? "",
    affectedLayer: bulletValue(input.markdown, "Affected layer") ?? "",
    riskIfAdopted: bulletValue(input.markdown, "Risk if adopted") ?? "",
  };
}

export async function reviewLessonCandidate(input: LessonReviewInput): Promise<LessonReview> {
  const sourcePath = resolve(input.candidatePath);
  return reviewLessonCandidateMarkdown({
    markdown: await readFile(sourcePath, "utf8"),
    sourcePath,
  });
}

export async function recordLessonReview(input: LessonReviewInput): Promise<LessonReviewArtifactResult> {
  const review = await reviewLessonCandidate(input);
  const artifact = toReviewArtifact({ review, reviewedAt: new Date().toISOString() });
  const path = reviewArtifactPath({ candidatePath: review.sourcePath, runId: review.runId });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { path, review: artifact };
}
