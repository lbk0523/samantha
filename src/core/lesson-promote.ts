import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { reviewLessonCandidate, type LessonReview } from "./lesson-review";

export interface LessonPromoteInput {
  candidatePath: string;
  repoRoot?: string;
  playbookId: string;
}

export interface LessonPromotion {
  promoted: boolean;
  reason: string;
  sourcePath: string;
  artifactPath?: string;
}

function assertPlaybookId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error("playbook id must use lowercase letters, numbers, and dashes");
  }
}

function renderPlaybook(input: { playbookId: string; review: LessonReview }): string {
  return `# Playbook: ${input.playbookId}

## Source
- Promoted from: ${input.review.sourcePath}
- Source run id: ${input.review.runId}
- Task id: ${input.review.taskId}
- Task title: ${input.review.taskTitle}
- Run log: ${input.review.runLogPath}

## Lesson
- Proposed lesson: ${input.review.proposedLesson}
- Affected layer: ${input.review.affectedLayer}
- Suggested artifact type: ${input.review.suggestedArtifactType}
- Risk if adopted: ${input.review.riskIfAdopted}

## Evidence
- Observed outcome: ${input.review.observedOutcome}
- Superseded status: ${input.review.superseded.status}
${input.review.superseded.supersedingRunId ? `- Superseding run id: ${input.review.superseded.supersedingRunId}\n` : ""}
## Use

Apply this playbook only when new run evidence matches the source pattern.
`;
}

function isFileExistsError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

export async function promoteLessonCandidate(input: LessonPromoteInput): Promise<LessonPromotion> {
  assertPlaybookId(input.playbookId);
  const review = await reviewLessonCandidate({ candidatePath: input.candidatePath });

  if (review.recommendedAction === "reject") {
    return {
      promoted: false,
      reason: "candidate is stale or marked no promotion",
      sourcePath: review.sourcePath,
    };
  }

  if (review.recommendedAction !== "promote_playbook") {
    return {
      promoted: false,
      reason: "only playbook promotion is supported",
      sourcePath: review.sourcePath,
    };
  }

  const repoRoot = resolve(input.repoRoot ?? ".");
  const playbooksDir = join(repoRoot, "references", "playbooks");
  const artifactPath = join(playbooksDir, `${input.playbookId}.md`);
  await mkdir(playbooksDir, { recursive: true });
  try {
    await writeFile(artifactPath, renderPlaybook({ playbookId: input.playbookId, review }), {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (isFileExistsError(error)) {
      return {
        promoted: false,
        reason: "playbook already exists",
        sourcePath: review.sourcePath,
        artifactPath,
      };
    }
    throw error;
  }

  return {
    promoted: true,
    reason: "promoted playbook",
    sourcePath: review.sourcePath,
    artifactPath,
  };
}
