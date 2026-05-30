import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { summarizeWorkerRun, type RunOutcome } from "./ledger";
import type { LessonInboxReviewIndexEntry } from "./lesson-inbox-review";
import { isPlaybookLessonCandidate, reviewLessonCandidate, type LessonReview } from "./lesson-review";
import type { WorkerRunLog } from "./run-log";

export type PlaybookEvidenceAssessment = "helped" | "not-helped" | "unclear";

const execFileAsync = promisify(execFile);

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

export interface LessonAutoPromotionEntry {
  candidatePath: string;
  reviewPath: string;
  runId: string;
  taskId: string;
  playbookId: string;
  artifactPath: string;
  reason: string;
}

export interface LessonAutoPromotionReport {
  schemaVersion: 1;
  targetDate: string;
  dirtyTreeBlocked: boolean;
  promoted: LessonAutoPromotionEntry[];
  skipped: LessonAutoPromotionEntry[];
  blocked: LessonAutoPromotionEntry[];
  summary: {
    total: number;
    promoted: number;
    skipped: number;
    blocked: number;
  };
}

export interface PlaybookEvidenceInput {
  playbookPath: string;
  runLogPath: string;
  assessment: PlaybookEvidenceAssessment;
  note: string;
}

export interface PlaybookEvidenceRecord {
  recorded: true;
  playbookPath: string;
  runLogPath: string;
  runId: string;
  taskId: string;
  outcome: RunOutcome;
  assessment: PlaybookEvidenceAssessment;
}

function assertPlaybookId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error("playbook id must use lowercase letters, numbers, and dashes");
  }
}

function normalizePlaybookId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function derivePlaybookId(input: { taskFamily?: string; taskId: string }): string {
  return normalizePlaybookId(input.taskFamily ?? "") || normalizePlaybookId(input.taskId);
}

function repoRelativePath(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

function repoAbsolutePath(repoRoot: string, path: string): string {
  return isAbsolute(path) ? path : join(repoRoot, path);
}

function playbookPath(repoRoot: string, playbookId: string): string {
  return join(repoRoot, "references", "playbooks", `${playbookId}.md`);
}

function isNotGitRepositoryError(error: unknown): boolean {
  const stderr = typeof (error as { stderr?: unknown }).stderr === "string" ? (error as { stderr: string }).stderr : "";
  return stderr.includes("not a git repository");
}

export async function isGitWorkTreeDirty(repoRoot: string): Promise<boolean> {
  try {
    const result = await execFileAsync("git", ["-C", repoRoot, "status", "--porcelain"], {
      encoding: "utf8",
    });
    return result.stdout.trim().length > 0;
  } catch (error) {
    if (isNotGitRepositoryError(error)) return false;
    throw error;
  }
}

function autoPromotionEntry(input: {
  repoRoot: string;
  candidate: LessonInboxReviewIndexEntry;
  playbookId: string;
  reason: string;
  artifactPath?: string;
}): LessonAutoPromotionEntry {
  const artifactPath = input.artifactPath ?? playbookPath(input.repoRoot, input.playbookId);
  return {
    candidatePath: input.candidate.candidatePath,
    reviewPath: input.candidate.reviewPath,
    runId: input.candidate.runId,
    taskId: input.candidate.taskId,
    playbookId: input.playbookId,
    artifactPath: repoRelativePath(input.repoRoot, artifactPath),
    reason: input.reason,
  };
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
- Task family: ${input.review.recurrence.taskFamily}
- Recurrence outcome: ${input.review.recurrence.outcome}
- Recurrence count: ${input.review.recurrence.count}
- Promotion threshold: ${input.review.recurrence.threshold}
## Later Evidence
- none recorded

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
      reason:
        isPlaybookLessonCandidate(review.suggestedArtifactType)
          ? "candidate needs more evidence before playbook promotion"
          : "only playbook promotion is supported",
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

export async function autoPromoteLessonPlaybooks(input: {
  repoRoot: string;
  candidates: LessonInboxReviewIndexEntry[];
  dirtyTreeBlocked: boolean;
  targetDate: string;
}): Promise<LessonAutoPromotionReport> {
  const repoRoot = resolve(input.repoRoot);
  const promoted: LessonAutoPromotionEntry[] = [];
  const skipped: LessonAutoPromotionEntry[] = [];
  const blocked: LessonAutoPromotionEntry[] = [];

  for (const candidate of input.candidates) {
    const playbookId = derivePlaybookId({
      taskFamily: candidate.recurrence.taskFamily,
      taskId: candidate.taskId,
    });
    if (!playbookId) {
      skipped.push(
        autoPromotionEntry({
          repoRoot,
          candidate,
          playbookId: "unknown",
          reason: "could not derive playbook id",
        }),
      );
      continue;
    }

    if (candidate.recommendedAction !== "promote_playbook") {
      skipped.push(
        autoPromotionEntry({
          repoRoot,
          candidate,
          playbookId,
          reason: `not eligible for auto-promotion: ${candidate.reason}`,
        }),
      );
      continue;
    }

    if (input.dirtyTreeBlocked) {
      blocked.push(
        autoPromotionEntry({
          repoRoot,
          candidate,
          playbookId,
          reason: "dirty target repo",
        }),
      );
      continue;
    }

    const result = await promoteLessonCandidate({
      candidatePath: repoAbsolutePath(repoRoot, candidate.candidatePath),
      repoRoot,
      playbookId,
    });
    const entry = autoPromotionEntry({
      repoRoot,
      candidate,
      playbookId,
      reason: result.reason,
      artifactPath: result.artifactPath,
    });
    if (result.promoted) {
      promoted.push(entry);
    } else {
      skipped.push(entry);
    }
  }

  return {
    schemaVersion: 1,
    targetDate: input.targetDate,
    dirtyTreeBlocked: input.dirtyTreeBlocked,
    promoted,
    skipped,
    blocked,
    summary: {
      total: input.candidates.length,
      promoted: promoted.length,
      skipped: skipped.length,
      blocked: blocked.length,
    },
  };
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function appendLaterEvidence(markdown: string, entry: string): string {
  const heading = "## Later Evidence\n";
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex === -1) {
    throw new Error("playbook is missing ## Later Evidence section");
  }

  const contentStart = headingIndex + heading.length;
  const nextHeadingIndex = markdown.indexOf("\n## ", contentStart);
  const contentEnd = nextHeadingIndex === -1 ? markdown.length : nextHeadingIndex;
  const before = markdown.slice(0, contentStart);
  const content = markdown.slice(contentStart, contentEnd).trim();
  const after = markdown.slice(contentEnd);
  const updatedContent = content === "- none recorded" ? entry : `${content}\n${entry}`;

  return `${before}${updatedContent}\n${after}`;
}

export async function recordPlaybookEvidence(input: PlaybookEvidenceInput): Promise<PlaybookEvidenceRecord> {
  const playbookPath = resolve(input.playbookPath);
  const runLogPath = resolve(input.runLogPath);
  const [markdown, rawLog] = await Promise.all([
    readFile(playbookPath, "utf8"),
    readFile(runLogPath, "utf8"),
  ]);
  const log = JSON.parse(rawLog) as WorkerRunLog;
  const summary = summarizeWorkerRun({
    task: log.task,
    agent: log.agent,
    repoRoot: log.input.repoRoot,
    worktreesDir: log.input.worktreesDir,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    execution: log.result,
    runId: log.runId,
    logPath: runLogPath,
  });
  const entry = [
    `- Run id: ${summary.runId}`,
    `  - Run log: ${runLogPath}`,
    `  - Task id: ${summary.taskId}`,
    `  - Task title: ${summary.taskTitle}`,
    `  - Outcome: ${summary.outcome}`,
    `  - Assessment: ${input.assessment}`,
    `  - Note: ${oneLine(input.note)}`,
  ].join("\n");

  await writeFile(playbookPath, appendLaterEvidence(markdown, entry), "utf8");

  return {
    recorded: true,
    playbookPath,
    runLogPath,
    runId: summary.runId,
    taskId: summary.taskId,
    outcome: summary.outcome,
    assessment: input.assessment,
  };
}
