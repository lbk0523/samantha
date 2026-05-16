import { join } from "node:path";
import type { BatchPlanDraft } from "./batch-plan-draft";
import type { BatchPlanDraftStoreInput } from "./batch-plan-draft-store";
import { readBatchPlanDraftRecordById } from "./batch-plan-draft-store";
import { preflightBatchPlanPromotion } from "./batch-plan-promotion";

export interface TaskSpecPlan {
  taskId: string;
  taskSpecPath: string;
  title: string;
  targetAgent: "codex-worker";
  targetFiles: string[];
  forbiddenChanges: string[];
  verifyCommands: string[];
  expectedCommitSubject: string;
  status: "pending";
}

export interface BatchSkeletonPlan {
  batchId: string;
  status: "planned";
  requiresBaseCommit: true;
  taskIds: string[];
  dependencyHints: BatchPlanDraft["dependencyHints"];
  parallelizationHints: BatchPlanDraft["parallelizationHints"];
}

export interface BatchPlanAssemblyDryRunResult {
  mayAssemble: boolean;
  violations: string[];
  draftId: string;
  draftPath?: string;
  taskSpecPlans: TaskSpecPlan[];
  batchSkeleton: BatchSkeletonPlan | null;
  nextAction: string;
}

export interface DryRunBatchPlanAssemblyOptions {
  draftPath?: string;
  taskSpecDir?: string;
  batchId?: string;
}

export type DryRunStoredBatchPlanAssemblyInput = BatchPlanDraftStoreInput & {
  draftId: string;
  taskSpecDir?: string;
  batchId?: string;
};

const DEFAULT_TASK_SPEC_DIR = "references/tasks";
const BLOCKED_NEXT_ACTION = "resolve promotion preflight violations before assembly";
const DRY_RUN_NEXT_ACTION = "review assembly dry-run output before artifact creation";

export function dryRunBatchPlanAssembly(
  draft: BatchPlanDraft,
  options: DryRunBatchPlanAssemblyOptions = {},
): BatchPlanAssemblyDryRunResult {
  const preflight = preflightBatchPlanPromotion(draft, { draftPath: options.draftPath });

  if (!preflight.mayPromote) {
    const blockedResult: BatchPlanAssemblyDryRunResult = {
      mayAssemble: false,
      violations: preflight.violations,
      draftId: preflight.draftId,
      taskSpecPlans: [],
      batchSkeleton: null,
      nextAction: preflight.nextAction || BLOCKED_NEXT_ACTION,
    };
    if (preflight.draftPath !== undefined) {
      blockedResult.draftPath = preflight.draftPath;
    }
    return blockedResult;
  }

  const taskSpecPlans = draft.proposedTasks.map((task) => taskSpecPlanFor(task, options.taskSpecDir));
  const result: BatchPlanAssemblyDryRunResult = {
    mayAssemble: true,
    violations: preflight.violations,
    draftId: preflight.draftId,
    taskSpecPlans,
    batchSkeleton: {
      batchId: options.batchId ?? draft.draftId,
      status: "planned",
      requiresBaseCommit: true,
      taskIds: draft.proposedTasks.map((task) => task.id),
      dependencyHints: draft.dependencyHints.map((hint) => ({ ...hint })),
      parallelizationHints: draft.parallelizationHints.map((hint) => ({
        taskIds: [...hint.taskIds],
        rationale: hint.rationale,
      })),
    },
    nextAction: DRY_RUN_NEXT_ACTION,
  };
  if (preflight.draftPath !== undefined) {
    result.draftPath = preflight.draftPath;
  }
  return result;
}

export async function dryRunStoredBatchPlanAssembly(
  input: DryRunStoredBatchPlanAssemblyInput,
): Promise<BatchPlanAssemblyDryRunResult> {
  const record = await readBatchPlanDraftRecordById(input);
  return dryRunBatchPlanAssembly(record.draft, {
    draftPath: record.path,
    taskSpecDir: input.taskSpecDir,
    batchId: input.batchId,
  });
}

function taskSpecPlanFor(task: BatchPlanDraft["proposedTasks"][number], taskSpecDir?: string): TaskSpecPlan {
  return {
    taskId: task.id,
    taskSpecPath: join(taskSpecDir ?? DEFAULT_TASK_SPEC_DIR, `${task.id}.json`),
    title: task.title,
    targetAgent: "codex-worker",
    targetFiles: [...task.targetFileHints],
    forbiddenChanges: [...task.forbiddenChangeHints],
    verifyCommands: [...task.verifyCommandHints],
    expectedCommitSubject: expectedCommitSubjectFor(task.title),
    status: "pending",
  };
}

function expectedCommitSubjectFor(title: string): string {
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return `feat: ${sanitizedTitle}`;
}
