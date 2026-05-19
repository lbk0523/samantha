import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { runTaskCommand, type RunTaskCommandInput } from "./commands/run-task";
import {
  orchestrateReportOnlyReviews,
  type OrchestrateReportOnlyReviewsInput,
} from "./commands/orchestrate-reports";
import { draftLessonFromRunLog } from "./core/lesson-draft";
import {
  promoteLessonCandidate,
  recordPlaybookEvidence,
  type PlaybookEvidenceAssessment,
} from "./core/lesson-promote";
import { recordLessonReview } from "./core/lesson-review";
import { evaluateMergeGate, readWorkerRunLog } from "./core/merge-gate";
import {
  recordCleanupFinished,
  recordLifecycleMarked,
  recordMergeChecked,
} from "./core/post-run-trajectory";
import {
  lifecycleBaseFromRunLog,
  RunLifecycleStore,
  type RunLifecycleEvent,
} from "./core/run-lifecycle-store";
import { acceptRun, type RunAcceptInput } from "./core/run-accept";
import { listRuns } from "./core/run-list";
import { showRun } from "./core/run-show";
import { createTaskFromTemplate } from "./core/task-from-template";
import { cleanupCompletedWorktree } from "./core/worktree-cleanup";
import { diagnoseRun } from "./core/run-diagnose";
import { createTaskFromRun } from "./core/task-from-run";
import { buildLessonPromotionQueue, reviewLessonInbox } from "./core/lesson-inbox-review";
import { summarizeReportOnlyReviews } from "./core/report-review";
import { preflightBatchSpec, type BatchSpec } from "./core/batch-spec";
import { markBatchSpecRejected } from "./core/batch-spec-mutation";
import { createReplacementBatchSpec } from "./core/batch-spec-replacement";
import { listBatchSpecs, readBatchSpecById, readBatchSpecRecordById } from "./core/batch-spec-store";
import { executeBatch, type ExecuteBatchInput } from "./core/batch-execution";
import { authorBatchPlanDraft, type AuthorBatchPlanDraftInput } from "./core/batch-plan-authoring";
import { listBatchPlanDrafts, readBatchPlanDraftById } from "./core/batch-plan-draft-store";
import { prepareBatchPlan, type PrepareBatchPlanInput } from "./core/batch-plan-operator";
import { reviewStoredBatchPlanDraft, type BatchPlanReviewInput } from "./core/batch-plan-review";
import { buildReadinessReport, type BuildReadinessReportInput, type ReadinessReport } from "./core/readiness";
import {
  buildSequentialContinuationSingleStep,
  buildSequentialContinuationReport,
  buildSequentialContinuationStatusUpdate,
  type SequentialContinuationArtifact,
  type SequentialContinuationSingleStepExecution,
  type SequentialContinuationStatusEvidenceResult,
} from "./core/sequential-ceo-autopilot";
import type { WorkerRuntimeKind } from "./core/worker-runtime-metadata";

export interface ContinuationShowCliArgs {
  command: "continuation:show";
  artifactPath: string;
}

export interface ContinuationUpdateStatusCliArgs {
  command: "continuation:update-status";
  artifactPath: string;
  evidencePath: string;
}

export interface ContinuationStepCliArgs {
  command: "continuation:step";
  artifactPath: string;
}

export interface RunTaskCliArgs extends RunTaskCommandInput {
  command: "run-task";
}

export interface RunsListCliArgs {
  command: "runs:list";
  runsDir?: string;
}

export interface RunsShowCliArgs {
  command: "runs:show";
  runId: string;
  runsDir?: string;
}

export interface MergeCheckCliArgs {
  command: "merge:check";
  runLogPath: string;
  repoRoot: string;
  targetBranch?: string;
}

export interface RunsMarkLifecycleCliArgs {
  command: "runs:mark-lifecycle";
  runLogPath: string;
  repoRoot: string;
  event: RunLifecycleEvent;
  stateDir?: string;
}

export interface WorktreeCleanupCliArgs {
  command: "worktree:cleanup";
  runLogPath: string;
  repoRoot: string;
  targetBranch?: string;
  stateDir?: string;
}

export interface RunsAcceptCliArgs extends RunAcceptInput {
  command: "runs:accept";
}

export interface RunsDiagnoseCliArgs {
  command: "runs:diagnose";
  runLogPath: string;
}

export interface ReportsSummarizeCliArgs {
  command: "reports:summarize";
  runLogPaths: string[];
}

export interface ReportsOrchestrateCliArgs extends OrchestrateReportOnlyReviewsInput {
  command: "reports:orchestrate";
}

export interface ReadinessCheckCliArgs extends BuildReadinessReportInput {
  command: "readiness:check";
}

export interface LessonsDraftCliArgs {
  command: "lessons:draft";
  runLogPath: string;
}

export interface LessonsReviewCliArgs {
  command: "lessons:review";
  candidatePath: string;
}

export interface LessonsReviewInboxCliArgs {
  command: "lessons:review-inbox";
  repoRoot?: string;
}

export interface LessonsPromotionQueueCliArgs {
  command: "lessons:promotion-queue";
  repoRoot?: string;
}

export interface LessonsPromoteCliArgs {
  command: "lessons:promote";
  candidatePath: string;
  playbookId: string;
}

export interface LessonsRecordEvidenceCliArgs {
  command: "lessons:record-evidence";
  playbookPath: string;
  runLogPath: string;
  assessment: PlaybookEvidenceAssessment;
  note: string;
}

export interface TasksFromTemplateCliArgs {
  command: "tasks:from-template";
  templateId: string;
  taskId: string;
  title: string;
  replacements?: Record<string, string>;
  repoRoot?: string;
}

export interface TasksFromRunCliArgs {
  command: "tasks:from-run";
  runLogPath: string;
  taskId: string;
  title: string;
  repoRoot?: string;
}

export interface BatchesPreflightCliArgs {
  command: "batches:preflight";
  batchPath?: string;
  batchId?: string;
  batchesDir?: string;
}

export interface BatchesExecuteCliArgs extends Omit<ExecuteBatchInput, "spec"> {
  command: "batches:execute";
  batchPath?: string;
  batchId?: string;
  batchesDir?: string;
}

export interface BatchesRejectCliArgs {
  command: "batches:reject";
  batchPath?: string;
  batchId?: string;
  batchesDir?: string;
  stateDir?: string;
  reason: string;
}

export interface BatchesReplaceCliArgs {
  command: "batches:replace";
  batchPath?: string;
  batchId?: string;
  batchesDir?: string;
  replacementBatchId: string;
  replacementPath: string;
  replanEvidencePath: string;
  stateDir?: string;
}

export interface BatchesListCliArgs {
  command: "batches:list";
  batchesDir?: string;
}

export interface BatchesShowCliArgs {
  command: "batches:show";
  batchId: string;
  batchesDir?: string;
}

export interface BatchPlansListCliArgs {
  command: "batch-plans:list";
  draftsDir?: string;
}

export interface BatchPlansShowCliArgs {
  command: "batch-plans:show";
  draftId: string;
  draftsDir?: string;
}

export interface BatchPlansReviewCliArgs extends BatchPlanReviewInput {
  command: "batch-plans:review";
}

export interface BatchPlansDraftCliArgs {
  command: "batch-plans:draft";
  inputPath: string;
  draftsDir?: string;
  executionBatchesDir?: string;
}

export interface BatchPlansPrepareCliArgs extends PrepareBatchPlanInput {
  command: "batch-plans:prepare";
}

export type SamanthaCliArgs =
  | ContinuationShowCliArgs
  | ContinuationUpdateStatusCliArgs
  | ContinuationStepCliArgs
  | RunTaskCliArgs
  | RunsListCliArgs
  | RunsShowCliArgs
  | MergeCheckCliArgs
  | RunsMarkLifecycleCliArgs
  | WorktreeCleanupCliArgs
  | RunsAcceptCliArgs
  | RunsDiagnoseCliArgs
  | ReportsSummarizeCliArgs
  | ReportsOrchestrateCliArgs
  | ReadinessCheckCliArgs
  | LessonsDraftCliArgs
  | LessonsReviewCliArgs
  | LessonsReviewInboxCliArgs
  | LessonsPromotionQueueCliArgs
  | LessonsPromoteCliArgs
  | LessonsRecordEvidenceCliArgs
  | TasksFromTemplateCliArgs
  | TasksFromRunCliArgs
  | BatchesPreflightCliArgs
  | BatchesExecuteCliArgs
  | BatchesRejectCliArgs
  | BatchesReplaceCliArgs
  | BatchesListCliArgs
  | BatchesShowCliArgs
  | BatchPlansListCliArgs
  | BatchPlansShowCliArgs
  | BatchPlansReviewCliArgs
  | BatchPlansDraftCliArgs
  | BatchPlansPrepareCliArgs;

function parseFlags(args: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      throw new Error(`flag requires --name=value form: ${arg}`);
    }
    flags.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  return flags;
}

function parseTemplateReplacements(args: string[]): Record<string, string> | undefined {
  const replacements: Record<string, string> = {};
  for (const arg of args) {
    if (!arg.startsWith("--set=")) continue;
    const raw = arg.slice("--set=".length);
    const sep = raw.indexOf(":");
    if (sep <= 0 || sep === raw.length - 1) {
      throw new Error("usage: --set requires --set=<placeholder>:<value>");
    }
    const key = raw.slice(0, sep);
    if (!/^[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error("template placeholder names must contain only letters, numbers, underscores, or dashes");
    }
    replacements[key] = raw.slice(sep + 1);
  }
  return Object.keys(replacements).length > 0 ? replacements : undefined;
}

function parseRepeatedFlag(args: string[], name: string): string[] {
  const prefix = `--${name}=`;
  return args.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length));
}

function parseWorkerRuntimeKind(value: string | undefined): WorkerRuntimeKind | undefined {
  if (!value) return undefined;
  if (value === "exec-json" || value === "codex-sdk") return value;
  throw new Error("runtime must be exec-json or codex-sdk");
}

export function parseCliArgs(argv: string[]): SamanthaCliArgs {
  const [command, first, ...rest] = argv;

  if (command === "continuation:show") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const artifactPath = flags.get("artifact");
    if (!artifactPath) {
      throw new Error("usage: bun run samantha continuation:show --artifact=<path>");
    }
    return {
      command: "continuation:show",
      artifactPath,
    };
  }

  if (command === "continuation:update-status") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const artifactPath = flags.get("artifact");
    const evidencePath = flags.get("evidence");
    if (!artifactPath || !evidencePath) {
      throw new Error(
        "usage: bun run samantha continuation:update-status --artifact=<path> --evidence=<path>",
      );
    }
    return {
      command: "continuation:update-status",
      artifactPath,
      evidencePath,
    };
  }

  if (command === "continuation:step") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const artifactPath = flags.get("artifact");
    if (!artifactPath) {
      throw new Error("usage: bun run samantha continuation:step --artifact=<path>");
    }
    return {
      command: "continuation:step",
      artifactPath,
    };
  }

  if (command === "run-task") {
    if (!first) {
      throw new Error("usage: bun run samantha run-task <task.json> --repo-root=<repo> [--agent=<profile.json>] [--worktrees-dir=<dir>] [--runs-dir=<dir>] [--codex-bin=<path>] [--runtime=exec-json|codex-sdk]");
    }
    const flags = parseFlags(rest);
    const repoRoot = flags.get("repo-root");
    if (!repoRoot) {
      throw new Error("usage: run-task requires --repo-root=<repo>");
    }
    const runtimeKind = parseWorkerRuntimeKind(flags.get("runtime"));

    return {
      command: "run-task",
      taskPath: first,
      repoRoot,
      ...(flags.get("agent") ? { agentPath: flags.get("agent") } : {}),
      ...(flags.get("worktrees-dir") ? { worktreesDir: flags.get("worktrees-dir") } : {}),
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
      ...(flags.get("codex-bin") ? { codexBin: flags.get("codex-bin") } : {}),
      ...(runtimeKind ? { runtimeKind } : {}),
    };
  }

  if (command === "runs:list") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    return {
      command: "runs:list",
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
    };
  }

  if (command === "runs:show") {
    if (!first) {
      throw new Error("usage: bun run samantha runs:show <run-id> [--runs-dir=<dir>]");
    }
    const flags = parseFlags(rest);
    return {
      command: "runs:show",
      runId: first,
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
    };
  }

  if (command === "merge:check") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!runLogPath || !repoRoot) {
      throw new Error("usage: bun run samantha merge:check --run-log=<path> --repo-root=<repo> [--target-branch=<branch>]");
    }
    return {
      command: "merge:check",
      runLogPath,
      repoRoot,
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
    };
  }

  if (command === "runs:mark-lifecycle") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    const event = flags.get("event");
    if (!runLogPath || !repoRoot || !isRunLifecycleEvent(event)) {
      throw new Error("usage: bun run samantha runs:mark-lifecycle --run-log=<path> --repo-root=<repo> --event=merged|cleaned [--state-dir=<dir>]");
    }
    return {
      command: "runs:mark-lifecycle",
      runLogPath,
      repoRoot,
      event,
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
    };
  }

  if (command === "worktree:cleanup") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!runLogPath || !repoRoot) {
      throw new Error("usage: bun run samantha worktree:cleanup --run-log=<path> --repo-root=<repo> [--target-branch=<branch>] [--state-dir=<dir>]");
    }
    return {
      command: "worktree:cleanup",
      runLogPath,
      repoRoot,
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
    };
  }

  if (command === "runs:accept") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!runLogPath || !repoRoot) {
      throw new Error("usage: bun run samantha runs:accept --run-log=<path> --repo-root=<repo> [--target-branch=<branch>] [--state-dir=<dir>]");
    }
    return {
      command: "runs:accept",
      runLogPath,
      repoRoot,
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
    };
  }

  if (command === "runs:diagnose") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    if (!runLogPath) {
      throw new Error("usage: bun run samantha runs:diagnose --run-log=<path>");
    }
    return {
      command: "runs:diagnose",
      runLogPath,
    };
  }

  if (command === "reports:summarize") {
    const runLogPaths = parseRepeatedFlag(
      [first, ...rest].filter((arg): arg is string => Boolean(arg)),
      "run-log",
    );
    if (runLogPaths.length === 0) {
      throw new Error("usage: bun run samantha reports:summarize --run-log=<path> [--run-log=<path>]...");
    }
    return {
      command: "reports:summarize",
      runLogPaths,
    };
  }

  if (command === "reports:orchestrate") {
    const args = [first, ...rest].filter((arg): arg is string => Boolean(arg));
    const flags = parseFlags(args);
    const taskPaths = parseRepeatedFlag(args, "task");
    const repoRoot = flags.get("repo-root");
    if (!repoRoot || taskPaths.length < 2) {
      throw new Error("usage: bun run samantha reports:orchestrate --repo-root=<repo> --task=<task.json> --task=<task.json>... [--agent=<profile.json>] [--runs-dir=<dir>] [--codex-bin=<path>]");
    }
    return {
      command: "reports:orchestrate",
      repoRoot,
      taskPaths,
      ...(flags.get("agent") ? { agentPath: flags.get("agent") } : {}),
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
      ...(flags.get("codex-bin") ? { codexBin: flags.get("codex-bin") } : {}),
    };
  }

  if (command === "readiness:check") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const initiativePath = flags.get("initiative");
    const taskPath = flags.get("task");
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!initiativePath && !taskPath && !runLogPath && !repoRoot) {
      throw new Error("usage: bun run samantha readiness:check [--initiative=<path>] [--task=<task.json>] [--run-log=<path>] [--repo-root=<repo>]");
    }
    return {
      command: "readiness:check",
      ...(initiativePath ? { initiativePath } : {}),
      ...(taskPath ? { taskPath } : {}),
      ...(runLogPath ? { runLogPath } : {}),
      ...(repoRoot ? { repoRoot } : {}),
    };
  }

  if (command === "lessons:draft") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    if (!runLogPath) {
      throw new Error("usage: bun run samantha lessons:draft --run-log=<path>");
    }
    return {
      command: "lessons:draft",
      runLogPath,
    };
  }

  if (command === "lessons:review") {
    if (!first) {
      throw new Error("usage: bun run samantha lessons:review <candidate.md>");
    }
    return {
      command: "lessons:review",
      candidatePath: first,
    };
  }

  if (command === "lessons:review-inbox") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    return {
      command: "lessons:review-inbox",
      ...(flags.get("repo-root") ? { repoRoot: flags.get("repo-root") } : {}),
    };
  }

  if (command === "lessons:promotion-queue") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    return {
      command: "lessons:promotion-queue",
      ...(flags.get("repo-root") ? { repoRoot: flags.get("repo-root") } : {}),
    };
  }

  if (command === "lessons:promote") {
    if (!first) {
      throw new Error("usage: bun run samantha lessons:promote <candidate.md> --playbook-id=<id>");
    }
    const flags = parseFlags(rest);
    const playbookId = flags.get("playbook-id");
    if (!playbookId) {
      throw new Error("usage: bun run samantha lessons:promote <candidate.md> --playbook-id=<id>");
    }
    return {
      command: "lessons:promote",
      candidatePath: first,
      playbookId,
    };
  }

  if (command === "lessons:record-evidence") {
    if (!first) {
      throw new Error("usage: bun run samantha lessons:record-evidence <playbook.md> --run-log=<path> --assessment=helped|not-helped|unclear --note=<note>");
    }
    const flags = parseFlags(rest);
    const runLogPath = flags.get("run-log");
    const assessment = flags.get("assessment");
    const note = flags.get("note");
    if (!runLogPath || !isPlaybookEvidenceAssessment(assessment) || !note) {
      throw new Error("usage: bun run samantha lessons:record-evidence <playbook.md> --run-log=<path> --assessment=helped|not-helped|unclear --note=<note>");
    }
    return {
      command: "lessons:record-evidence",
      playbookPath: first,
      runLogPath,
      assessment,
      note,
    };
  }

  if (command === "tasks:from-template") {
    if (!first) {
      throw new Error("usage: bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title> [--set=<placeholder>:<value>]... [--repo-root=<repo>]");
    }
    const flags = parseFlags(rest);
    const replacements = parseTemplateReplacements(rest);
    const taskId = flags.get("task-id");
    const title = flags.get("title");
    if (!taskId || !title) {
      throw new Error("usage: bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title> [--set=<placeholder>:<value>]... [--repo-root=<repo>]");
    }
    return {
      command: "tasks:from-template",
      templateId: first,
      taskId,
      title,
      ...(replacements ? { replacements } : {}),
      ...(flags.get("repo-root") ? { repoRoot: flags.get("repo-root") } : {}),
    };
  }

  if (command === "tasks:from-run") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const taskId = flags.get("task-id");
    const title = flags.get("title");
    if (!runLogPath || !taskId || !title) {
      throw new Error("usage: bun run samantha tasks:from-run --run-log=<path> --task-id=<id> --title=<title> [--repo-root=<repo>]");
    }
    return {
      command: "tasks:from-run",
      runLogPath,
      taskId,
      title,
      ...(flags.get("repo-root") ? { repoRoot: flags.get("repo-root") } : {}),
    };
  }

  if (command === "batches:list") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    return {
      command: "batches:list",
      ...(flags.get("batches-dir") ? { batchesDir: flags.get("batches-dir") } : {}),
    };
  }

  if (command === "batches:show") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const batchId = flags.get("batch-id");
    if (!batchId) {
      throw new Error("usage: bun run samantha batches:show --batch-id=<id> [--batches-dir=<dir>]");
    }
    return {
      command: "batches:show",
      batchId,
      ...(flags.get("batches-dir") ? { batchesDir: flags.get("batches-dir") } : {}),
    };
  }

  if (command === "batch-plans:list") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    return {
      command: "batch-plans:list",
      ...(flags.get("drafts-dir") ? { draftsDir: flags.get("drafts-dir") } : {}),
    };
  }

  if (command === "batch-plans:show") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const draftId = flags.get("draft-id");
    if (!draftId) {
      throw new Error("usage: bun run samantha batch-plans:show --draft-id=<id> [--drafts-dir=<dir>]");
    }
    return {
      command: "batch-plans:show",
      draftId,
      ...(flags.get("drafts-dir") ? { draftsDir: flags.get("drafts-dir") } : {}),
    };
  }

  if (command === "batch-plans:review") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const draftId = flags.get("draft-id");
    if (!draftId) {
      throw new Error("usage: bun run samantha batch-plans:review --draft-id=<id> [--drafts-dir=<dir>]");
    }
    return {
      command: "batch-plans:review",
      draftId,
      ...(flags.get("drafts-dir") ? { draftsDir: flags.get("drafts-dir") } : {}),
    };
  }

  if (command === "batch-plans:draft") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const inputPath = flags.get("input");
    if (!inputPath) {
      throw new Error("usage: bun run samantha batch-plans:draft --input=<json> [--drafts-dir=<dir>] [--execution-batches-dir=<dir>]");
    }
    return {
      command: "batch-plans:draft",
      inputPath,
      ...(flags.get("drafts-dir") ? { draftsDir: flags.get("drafts-dir") } : {}),
      ...(flags.get("execution-batches-dir") ? { executionBatchesDir: flags.get("execution-batches-dir") } : {}),
    };
  }

  if (command === "batch-plans:prepare") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const draftId = flags.get("draft-id");
    const executionBatchesDir = flags.get("execution-batches-dir");
    if (!draftId || !executionBatchesDir) {
      throw new Error("usage: bun run samantha batch-plans:prepare --draft-id=<id> --execution-batches-dir=<dir> [--drafts-dir=<dir>] [--repo-root=<repo>] [--task-spec-dir=<dir>] [--batch-id=<id>]");
    }
    return {
      command: "batch-plans:prepare",
      draftId,
      executionBatchesDir,
      ...(flags.get("drafts-dir") ? { draftsDir: flags.get("drafts-dir") } : {}),
      ...(flags.get("repo-root") ? { repoRoot: flags.get("repo-root") } : {}),
      ...(flags.get("task-spec-dir") ? { taskSpecDir: flags.get("task-spec-dir") } : {}),
      ...(flags.get("batch-id") ? { batchId: flags.get("batch-id") } : {}),
    };
  }

  if (command === "batches:preflight") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const batchPath = flags.get("batch");
    const batchId = flags.get("batch-id");
    if (batchPath && batchId) {
      throw new Error("usage: batches:preflight accepts either --batch=<path> or --batch-id=<id>, not both");
    }
    if (!batchPath && !batchId) {
      throw new Error("usage: bun run samantha batches:preflight --batch=<path> OR --batch-id=<id> [--batches-dir=<dir>]");
    }
    return {
      command: "batches:preflight",
      ...(batchPath ? { batchPath } : {}),
      ...(batchId ? { batchId } : {}),
      ...(flags.get("batches-dir") ? { batchesDir: flags.get("batches-dir") } : {}),
    };
  }

  if (command === "batches:execute") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const batchPath = flags.get("batch");
    const batchId = flags.get("batch-id");
    if (batchPath && batchId) {
      throw new Error("usage: batches:execute accepts either --batch=<path> or --batch-id=<id>, not both");
    }
    if (!batchPath && !batchId) {
      throw new Error("usage: bun run samantha batches:execute --batch=<path> OR --batch-id=<id> [--batches-dir=<dir>] [--agent=<profile.json>] [--worktrees-dir=<dir>] [--runs-dir=<dir>] [--state-dir=<dir>] [--target-branch=<branch>] [--codex-bin=<path>] [--runtime=exec-json|codex-sdk]");
    }
    const runtimeKind = parseWorkerRuntimeKind(flags.get("runtime"));
    return {
      command: "batches:execute",
      ...(batchPath ? { batchPath } : {}),
      ...(batchId ? { batchId } : {}),
      ...(flags.get("batches-dir") ? { batchesDir: flags.get("batches-dir") } : {}),
      ...(flags.get("agent") ? { agentPath: flags.get("agent") } : {}),
      ...(flags.get("worktrees-dir") ? { worktreesDir: flags.get("worktrees-dir") } : {}),
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
      ...(flags.get("codex-bin") ? { codexBin: flags.get("codex-bin") } : {}),
      ...(runtimeKind ? { runtimeKind } : {}),
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
    };
  }

  if (command === "batches:reject") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const batchPath = flags.get("batch");
    const batchId = flags.get("batch-id");
    const reason = flags.get("reason");
    if (batchPath && batchId) {
      throw new Error("usage: batches:reject accepts either --batch=<path> or --batch-id=<id>, not both");
    }
    if ((!batchPath && !batchId) || !reason) {
      throw new Error("usage: bun run samantha batches:reject --batch=<path> OR --batch-id=<id> --reason=<reason> [--batches-dir=<dir>] [--state-dir=<dir>]");
    }
    return {
      command: "batches:reject",
      ...(batchPath ? { batchPath } : {}),
      ...(batchId ? { batchId } : {}),
      ...(flags.get("batches-dir") ? { batchesDir: flags.get("batches-dir") } : {}),
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
      reason,
    };
  }

  if (command === "batches:replace") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const batchPath = flags.get("batch");
    const batchId = flags.get("batch-id");
    const replacementBatchId = flags.get("replacement-batch-id");
    const replacementPath = flags.get("replacement");
    const replanEvidencePath = flags.get("replan-evidence");
    if (batchPath && batchId) {
      throw new Error("usage: batches:replace accepts either --batch=<path> or --batch-id=<id>, not both");
    }
    if ((!batchPath && !batchId) || !replacementBatchId || !replacementPath || !replanEvidencePath) {
      throw new Error("usage: bun run samantha batches:replace --batch=<path> OR --batch-id=<id> --replacement-batch-id=<id> --replacement=<path> --replan-evidence=<path> [--batches-dir=<dir>] [--state-dir=<dir>]");
    }
    return {
      command: "batches:replace",
      ...(batchPath ? { batchPath } : {}),
      ...(batchId ? { batchId } : {}),
      ...(flags.get("batches-dir") ? { batchesDir: flags.get("batches-dir") } : {}),
      replacementBatchId,
      replacementPath,
      replanEvidencePath,
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
    };
  }

  throw new Error("usage: bun run samantha continuation:show|continuation:update-status|continuation:step|run-task|runs:list|runs:show|merge:check|runs:mark-lifecycle|worktree:cleanup|runs:accept|runs:diagnose|reports:summarize|reports:orchestrate|readiness:check|lessons:draft|lessons:review|lessons:review-inbox|lessons:promotion-queue|lessons:promote|lessons:record-evidence|tasks:from-template|tasks:from-run|batches:list|batches:show|batches:preflight|batches:execute|batches:reject|batches:replace|batch-plans:list|batch-plans:show|batch-plans:review|batch-plans:draft|batch-plans:prepare");
}

function lifecyclePath(input: { runLogPath: string; stateDir?: string }): string {
  return join(resolve(input.stateDir ?? dirname(resolve(input.runLogPath))), "run-lifecycle.jsonl");
}

function isRunLifecycleEvent(value: unknown): value is RunLifecycleEvent {
  return value === "merged" || value === "cleaned";
}

function isPlaybookEvidenceAssessment(value: unknown): value is PlaybookEvidenceAssessment {
  return value === "helped" || value === "not-helped" || value === "unclear";
}

async function readBatchSpec(batchPath: string): Promise<BatchSpec> {
  return JSON.parse(await readFile(batchPath, "utf8")) as BatchSpec;
}

function artifactReadViolation(err: unknown): string {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    return "artifact could not be read: file not found";
  }
  if (err instanceof SyntaxError) {
    return `artifact JSON could not be parsed: ${err.message}`;
  }
  return `artifact could not be read: ${err instanceof Error ? err.message : String(err)}`;
}

function evidenceReadViolation(err: unknown): string {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    return "evidence could not be read: file not found";
  }
  if (err instanceof SyntaxError) {
    return `evidence JSON could not be parsed: ${err.message}`;
  }
  return `evidence could not be read: ${err instanceof Error ? err.message : String(err)}`;
}

function readinessStatusEvidenceResult(status: ReadinessReport["overallStatus"]): SequentialContinuationStatusEvidenceResult {
  if (status === "clear") return "clear";
  if (status === "blocked") return "blocked";
  return "failed";
}

function buildReadinessCheckSingleStepExecution(input: {
  artifact: SequentialContinuationArtifact;
  readiness: ReadinessReport;
}): SequentialContinuationSingleStepExecution {
  const summary = `Readiness check returned ${input.readiness.overallStatus}: ${input.readiness.recommendation}`;
  const passed = input.readiness.overallStatus === "clear";

  return {
    evidence: {
      schemaVersion: 1,
      currentSliceId: input.artifact.currentSlice.id,
      outcome: passed ? "completed" : "failed",
      updatedAt: input.artifact.updatedAt,
      evidenceReferences: [
        {
          kind: "readiness_report",
          path: `inline:readiness:${input.artifact.initiativePath}`,
          summary,
          result: readinessStatusEvidenceResult(input.readiness.overallStatus),
        },
      ],
      nextStep: passed
        ? {
            kind: "samantha_command",
            value: `sam c: ${input.artifact.initiativePath} review next single-step continuation after ${input.artifact.currentSlice.id}`,
          }
        : {
            kind: "blocked_report",
            value: `Blocked: ${summary}`,
          },
    },
    inlineEvidenceSummary: summary,
  };
}

async function markLifecycle(input: {
  runLogPath: string;
  repoRoot: string;
  event: RunLifecycleEvent;
  stateDir?: string;
}) {
  const runLogPath = resolve(input.runLogPath);
  const repoRoot = resolve(input.repoRoot);
  const log = await readWorkerRunLog(runLogPath);
  const at = new Date().toISOString();
  const record = await new RunLifecycleStore(lifecyclePath({ runLogPath, stateDir: input.stateDir })).mark(
    lifecycleBaseFromRunLog({ log, runLogPath, repoRoot, updatedAt: at }),
    input.event,
    at,
  );
  await recordLifecycleMarked(runLogPath, input.event, record);
  return record;
}

export async function main(argv: string[]): Promise<number> {
  const args = parseCliArgs(argv);
  if (args.command === "continuation:show") {
    const artifactPath = resolve(args.artifactPath);
    const report = await (async () => {
      try {
        return buildSequentialContinuationReport({
          artifactPath,
          artifact: JSON.parse(await readFile(artifactPath, "utf8")) as unknown,
        });
      } catch (err) {
        return buildSequentialContinuationReport({
          artifactPath,
          artifact: undefined,
          violations: [artifactReadViolation(err)],
        });
      }
    })();
    console.log(JSON.stringify(report, null, 2));
    return report.status === "accepted" ? 0 : 1;
  }

  if (args.command === "continuation:update-status") {
    const artifactPath = resolve(args.artifactPath);
    const evidencePath = resolve(args.evidencePath);
    const violations: string[] = [];
    let artifact: unknown;
    let evidence: unknown;
    try {
      artifact = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;
    } catch (err) {
      violations.push(artifactReadViolation(err));
    }
    try {
      evidence = JSON.parse(await readFile(evidencePath, "utf8")) as unknown;
    } catch (err) {
      violations.push(evidenceReadViolation(err));
    }

    const result = buildSequentialContinuationStatusUpdate({
      artifactPath,
      evidencePath,
      artifact,
      evidence,
      violations,
    });
    if (result.updatedArtifact) {
      await writeFile(artifactPath, `${JSON.stringify(result.updatedArtifact, null, 2)}\n`, "utf8");
    }
    console.log(JSON.stringify(result.report, null, 2));
    return result.report.status === "accepted" ? 0 : 1;
  }

  if (args.command === "continuation:step") {
    const artifactPath = resolve(args.artifactPath);
    const violations: string[] = [];
    let artifact: unknown;
    try {
      artifact = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;
    } catch (err) {
      violations.push(artifactReadViolation(err));
    }

    const result = await buildSequentialContinuationSingleStep({
      artifactPath,
      artifact,
      violations,
      executeAction: async ({ artifact: acceptedArtifact }) => {
        const readiness = await buildReadinessReport({
          initiativePath: acceptedArtifact.initiativePath,
        });
        return buildReadinessCheckSingleStepExecution({
          artifact: acceptedArtifact,
          readiness,
        });
      },
    });
    if (result.updatedArtifact) {
      await writeFile(artifactPath, `${JSON.stringify(result.updatedArtifact, null, 2)}\n`, "utf8");
    }
    console.log(JSON.stringify(result.report, null, 2));
    return result.report.status === "accepted" ? 0 : 1;
  }

  if (args.command === "run-task") {
    const result = await runTaskCommand(args);
    console.log(
      JSON.stringify(
        {
          pass: result.execution.pass,
          runLog: result.runLog.path,
          runSummary: result.runSummary,
          commit: result.execution.commit?.commitHash ?? "",
        },
        null,
        2,
      ),
    );
    return result.execution.pass ? 0 : 1;
  }

  if (args.command === "runs:list") {
    console.log(JSON.stringify(await listRuns(args), null, 2));
    return 0;
  }

  if (args.command === "runs:show") {
    console.log(JSON.stringify(await showRun(args), null, 2));
    return 0;
  }

  if (args.command === "merge:check") {
    const runLogPath = resolve(args.runLogPath);
    const result = await evaluateMergeGate({
      runLogPath,
      repoRoot: resolve(args.repoRoot),
      targetBranch: args.targetBranch,
    });
    await recordMergeChecked(runLogPath, result);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  if (args.command === "runs:mark-lifecycle") {
    console.log(JSON.stringify(await markLifecycle(args), null, 2));
    return 0;
  }

  if (args.command === "lessons:draft") {
    console.log(
      JSON.stringify(
        await draftLessonFromRunLog({
          runLogPath: resolve(args.runLogPath),
        }),
        null,
        2,
      ),
    );
    return 0;
  }

  if (args.command === "lessons:review") {
    console.log(JSON.stringify(await recordLessonReview({ candidatePath: resolve(args.candidatePath) }), null, 2));
    return 0;
  }

  if (args.command === "lessons:review-inbox") {
    console.log(JSON.stringify(await reviewLessonInbox({ repoRoot: args.repoRoot }), null, 2));
    return 0;
  }

  if (args.command === "lessons:promotion-queue") {
    console.log(JSON.stringify(await buildLessonPromotionQueue({ repoRoot: args.repoRoot }), null, 2));
    return 0;
  }

  if (args.command === "lessons:promote") {
    const result = await promoteLessonCandidate({
      candidatePath: resolve(args.candidatePath),
      playbookId: args.playbookId,
    });
    console.log(JSON.stringify(result, null, 2));
    return result.promoted ? 0 : 1;
  }

  if (args.command === "lessons:record-evidence") {
    console.log(
      JSON.stringify(
        await recordPlaybookEvidence({
          playbookPath: resolve(args.playbookPath),
          runLogPath: resolve(args.runLogPath),
          assessment: args.assessment,
          note: args.note,
        }),
        null,
        2,
      ),
    );
    return 0;
  }

  if (args.command === "runs:diagnose") {
    console.log(JSON.stringify(await diagnoseRun({ runLogPath: resolve(args.runLogPath) }), null, 2));
    return 0;
  }

  if (args.command === "reports:summarize") {
    console.log(JSON.stringify(await summarizeReportOnlyReviews(args), null, 2));
    return 0;
  }

  if (args.command === "reports:orchestrate") {
    console.log(JSON.stringify(await orchestrateReportOnlyReviews(args), null, 2));
    return 0;
  }

  if (args.command === "readiness:check") {
    const result = await buildReadinessReport(args);
    console.log(JSON.stringify(result, null, 2));
    return result.overallStatus === "clear" ? 0 : 1;
  }

  if (args.command === "tasks:from-template") {
    console.log(JSON.stringify(await createTaskFromTemplate(args), null, 2));
    return 0;
  }

  if (args.command === "tasks:from-run") {
    const result = await createTaskFromRun({
      runLogPath: resolve(args.runLogPath),
      taskId: args.taskId,
      title: args.title,
      repoRoot: args.repoRoot,
    });
    console.log(JSON.stringify(result, null, 2));
    return result.created ? 0 : 1;
  }

  if (args.command === "batches:list") {
    console.log(JSON.stringify(await listBatchSpecs(args), null, 2));
    return 0;
  }

  if (args.command === "batches:show") {
    console.log(JSON.stringify(await readBatchSpecById(args), null, 2));
    return 0;
  }

  if (args.command === "batch-plans:list") {
    console.log(JSON.stringify(await listBatchPlanDrafts(args), null, 2));
    return 0;
  }

  if (args.command === "batch-plans:show") {
    console.log(JSON.stringify(await readBatchPlanDraftById(args), null, 2));
    return 0;
  }

  if (args.command === "batch-plans:review") {
    console.log(JSON.stringify(await reviewStoredBatchPlanDraft(args), null, 2));
    return 0;
  }

  if (args.command === "batch-plans:draft") {
    const input = JSON.parse(await readFile(resolve(args.inputPath), "utf8")) as AuthorBatchPlanDraftInput;
    const result = await authorBatchPlanDraft({
      ...input,
      ...(args.draftsDir ? { draftsDir: args.draftsDir } : {}),
      ...(args.executionBatchesDir ? { executionBatchesDirHint: args.executionBatchesDir } : {}),
    });
    console.log(JSON.stringify(result, null, 2));
    return result.pass ? 0 : 1;
  }

  if (args.command === "batch-plans:prepare") {
    const result = await prepareBatchPlan(args);
    console.log(JSON.stringify(result, null, 2));
    return result.pass ? 0 : 1;
  }

  if (args.command === "batches:preflight") {
    if (!args.batchPath && !args.batchId) {
      throw new Error("batches:preflight requires --batch=<path> or --batch-id=<id>");
    }
    let spec: BatchSpec;
    if (args.batchPath) {
      spec = await readBatchSpec(resolve(args.batchPath));
    } else {
      const batchId = args.batchId;
      if (!batchId) {
        throw new Error("batches:preflight requires --batch=<path> or --batch-id=<id>");
      }
      spec = await readBatchSpecById({ batchId, batchesDir: args.batchesDir });
    }
    const result = await preflightBatchSpec(spec);
    console.log(JSON.stringify(result, null, 2));
    return result.mayDispatch ? 0 : 1;
  }

  if (args.command === "batches:execute") {
    if (!args.batchPath && !args.batchId) {
      throw new Error("batches:execute requires --batch=<path> or --batch-id=<id>");
    }
    let spec: BatchSpec;
    if (args.batchPath) {
      spec = await readBatchSpec(resolve(args.batchPath));
    } else {
      const batchId = args.batchId;
      if (!batchId) {
        throw new Error("batches:execute requires --batch=<path> or --batch-id=<id>");
      }
      spec = await readBatchSpecById({ batchId, batchesDir: args.batchesDir });
    }
    const result = await executeBatch({ ...args, spec });
    console.log(JSON.stringify(result, null, 2));
    return result.pass ? 0 : 1;
  }

  if (args.command === "batches:reject") {
    if (!args.batchPath && !args.batchId) {
      throw new Error("batches:reject requires --batch=<path> or --batch-id=<id>");
    }
    const batchPath = args.batchPath
      ? resolve(args.batchPath)
      : (await readBatchSpecRecordById({
          batchId: args.batchId ?? "",
          batchesDir: args.batchesDir,
        })).path;
    console.log(
      JSON.stringify(
        await markBatchSpecRejected({
          batchPath,
          authority: "samantha_cli",
          reason: args.reason,
          stateDir: args.stateDir,
        }),
        null,
        2,
      ),
    );
    return 0;
  }

  if (args.command === "batches:replace") {
    if (!args.batchPath && !args.batchId) {
      throw new Error("batches:replace requires --batch=<path> or --batch-id=<id>");
    }
    const sourceBatchPath = args.batchPath
      ? resolve(args.batchPath)
      : (await readBatchSpecRecordById({
          batchId: args.batchId ?? "",
          batchesDir: args.batchesDir,
        })).path;
    console.log(
      JSON.stringify(
        await createReplacementBatchSpec({
          sourceBatchPath,
          authority: "samantha_cli",
          replacementBatchId: args.replacementBatchId,
          replacementPath: args.replacementPath,
          replanEvidencePath: args.replanEvidencePath,
          stateDir: args.stateDir,
        }),
        null,
        2,
      ),
    );
    return 0;
  }

  if (args.command === "worktree:cleanup") {
    const runLogPath = resolve(args.runLogPath);
    const cleanup = await cleanupCompletedWorktree({
      runLogPath,
      repoRoot: resolve(args.repoRoot),
      targetBranch: args.targetBranch,
    });
    await recordCleanupFinished(runLogPath, cleanup);
    const lifecycle = cleanup.cleaned
      ? await markLifecycle({ ...args, event: "cleaned" })
      : undefined;
    console.log(JSON.stringify({ cleanup, lifecycle }, null, 2));
    return 0;
  }

  if (args.command === "runs:accept") {
    const result = await acceptRun(args);
    console.log(JSON.stringify(result, null, 2));
    return result.accepted ? 0 : 1;
  }

  const exhaustive: never = args;
  throw new Error(`unhandled command: ${JSON.stringify(exhaustive)}`);
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
