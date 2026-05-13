import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type LessonRecommendedAction = "promote_playbook" | "reject" | "manual_review";

export interface LessonReviewInput {
  candidatePath: string;
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

function recommendedAction(input: {
  stale: boolean;
  suggestedArtifactType: string;
}): LessonRecommendedAction {
  const artifactType = input.suggestedArtifactType.toLowerCase();
  if (input.stale || artifactType.includes("no promotion")) return "reject";
  if (artifactType === "playbook") return "promote_playbook";
  return "manual_review";
}

export function reviewLessonCandidateMarkdown(input: {
  markdown: string;
  sourcePath: string;
}): LessonReview {
  const suggestedArtifactType = bulletValue(input.markdown, "Suggested artifact type") ?? "";
  const supersededStatus = bulletValue(input.markdown, "Superseded status") ?? "not detected";
  const stale = supersededStatus !== "not detected" || suggestedArtifactType.toLowerCase().includes("no promotion");

  return {
    runId: bulletValue(input.markdown, "Source run id") ?? titleRunId(input.markdown) ?? "",
    sourcePath: input.sourcePath,
    taskId: bulletValue(input.markdown, "Task id") ?? "",
    taskTitle: bulletValue(input.markdown, "Task title") ?? "",
    runLogPath: bulletValue(input.markdown, "Run log") ?? "",
    observedOutcome: bulletValue(input.markdown, "Observed outcome") ?? "",
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
    recommendedAction: recommendedAction({ stale, suggestedArtifactType }),
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
