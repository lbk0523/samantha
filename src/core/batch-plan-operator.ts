import { isAbsolute, relative, resolve } from "node:path";
import { dryRunBatchPlanAssembly } from "./batch-plan-assembly";
import { dryRunExecutionBatchSpecAssembly } from "./batch-plan-execution-batch-assembly";
import {
  readExecutionBatchSpecRecordById,
  writeExecutionBatchSpec,
  type ExecutionBatchSpecRecord,
} from "./batch-plan-execution-batch-store";
import type { BatchPlanDraft } from "./batch-plan-draft";
import { readBatchPlanDraftRecordById } from "./batch-plan-draft-store";
import {
  preflightPlanningArtifactBaseCommit,
  type PlanningArtifactBaseCommitGateResult,
} from "./batch-plan-planning-artifact-gate";
import {
  commitPlanningArtifacts,
  type CommitPlanningArtifactsResult,
} from "./batch-plan-planning-artifact-commit";
import { preflightTaskSpecWrites } from "./batch-plan-task-spec-preflight";
import { writeBatchPlanTaskSpecs, type TaskSpecWriteRecord } from "./batch-plan-task-spec-store";
import { preflightBatchSpec, type BatchPreflightResult } from "./batch-spec";

export interface PrepareBatchPlanInput {
  draftId: string;
  draftsDir?: string;
  repoRoot?: string;
  taskSpecDir?: string;
  batchId?: string;
  executionBatchesDir: string;
}

export interface PrepareBatchPlanReport {
  pass: boolean;
  prepared: boolean;
  draftId: string;
  batchId?: string;
  draftPath?: string;
  sourceGoal?: string;
  repoInspectionSummary?: string;
  proposedTaskCount?: number;
  taskSpecWrites: TaskSpecWriteRecord[];
  planningCommit: CommitPlanningArtifactsResult | null;
  baseCommitGate: PlanningArtifactBaseCommitGateResult | null;
  executionBatchSpecRecord: ExecutionBatchSpecRecord | null;
  batchPreflight: BatchPreflightResult | null;
  prepareOutcome: "passed" | "blocked";
  preflightOutcome: "passed" | "blocked" | "not_run";
  pushPerformed: false;
  violations: string[];
  nextAction: string;
}

const READ_DRAFT_NEXT_ACTION = "resolve stored BatchPlanDraft before BatchPlan prepare";
const TASK_SPEC_WRITE_NEXT_ACTION = "resolve TaskSpec write failure before planning artifact commit";
const EXECUTION_BATCH_STORE_NEXT_ACTION =
  "rework execution BatchSpec storage before stored BatchSpec preflight";
const BATCH_PREFLIGHT_NEXT_ACTION = "rework stored execution BatchSpec before batches:execute";

export async function prepareBatchPlan(input: PrepareBatchPlanInput): Promise<PrepareBatchPlanReport> {
  const emptyReport = reportFor(input);

  let draftRecord;
  try {
    draftRecord = await readBatchPlanDraftRecordById(input);
  } catch (err) {
    return {
      ...emptyReport,
      violations: [errorMessage(err)],
      nextAction: READ_DRAFT_NEXT_ACTION,
    };
  }

  const assemblyResult = dryRunBatchPlanAssembly(draftRecord.draft, {
    draftPath: draftRecord.path,
    taskSpecDir: input.taskSpecDir,
    batchId: input.batchId,
  });
  const draftPath = assemblyResult.draftPath;
  const batchId = assemblyResult.batchSkeleton?.batchId;
  const baseReport = reportFor(input, { draftPath, batchId, draft: draftRecord.draft });

  if (!assemblyResult.mayAssemble) {
    return {
      ...baseReport,
      violations: [...assemblyResult.violations],
      nextAction: assemblyResult.nextAction,
    };
  }

  const taskSpecPreflight = preflightTaskSpecWrites(assemblyResult);
  if (!taskSpecPreflight.mayWrite) {
    return {
      ...baseReport,
      violations: [...taskSpecPreflight.violations],
      nextAction: taskSpecPreflight.nextAction,
    };
  }

  let taskSpecWrites: TaskSpecWriteRecord[];
  try {
    taskSpecWrites = await writeBatchPlanTaskSpecs({
      repoRoot: input.repoRoot,
      preflight: taskSpecPreflight,
    });
  } catch (err) {
    return {
      ...baseReport,
      violations: [errorMessage(err)],
      nextAction: TASK_SPEC_WRITE_NEXT_ACTION,
    };
  }

  const planningArtifactPaths = planningArtifactPathsFor({
    repoRoot: input.repoRoot,
    draftPath,
    taskSpecWrites,
  });
  const planningCommit = await commitPlanningArtifacts({
    repoRoot: input.repoRoot,
    draftId: input.draftId,
    planningArtifactPaths,
  });
  if (!planningCommit.pass) {
    return {
      ...baseReport,
      taskSpecWrites,
      planningCommit,
      violations: [...planningCommit.violations],
      nextAction: planningCommit.nextAction,
    };
  }

  const baseCommitGate = await preflightPlanningArtifactBaseCommit({
    repoRoot: input.repoRoot,
    planningArtifactPaths,
  });
  if (!baseCommitGate.mayUseBaseCommit) {
    return {
      ...baseReport,
      taskSpecWrites,
      planningCommit,
      baseCommitGate,
      violations: [...baseCommitGate.violations],
      nextAction: baseCommitGate.nextAction,
    };
  }

  const executionDryRun = dryRunExecutionBatchSpecAssembly({
    assemblyResult: {
      ...assemblyResult,
      draftPath: draftPath === undefined ? undefined : planningArtifactPaths[0],
    },
    baseCommitGate,
  });
  if (!executionDryRun.mayAssembleExecutionBatch) {
    return {
      ...baseReport,
      taskSpecWrites,
      planningCommit,
      baseCommitGate,
      violations: [...executionDryRun.violations],
      nextAction: executionDryRun.nextAction,
    };
  }

  let executionBatchSpecRecord: ExecutionBatchSpecRecord;
  try {
    const writtenRecord = await writeExecutionBatchSpec({
      executionBatchesDir: input.executionBatchesDir,
      dryRun: executionDryRun,
    });
    executionBatchSpecRecord = await readExecutionBatchSpecRecordById({
      executionBatchesDir: input.executionBatchesDir,
      batchId: writtenRecord.batchId,
    });
  } catch (err) {
    return {
      ...baseReport,
      taskSpecWrites,
      planningCommit,
      baseCommitGate,
      violations: [errorMessage(err)],
      nextAction: EXECUTION_BATCH_STORE_NEXT_ACTION,
    };
  }

  const batchPreflight = await preflightBatchSpec(executionBatchSpecRecord.batchSpec);
  if (!batchPreflight.mayDispatch) {
    return {
      ...baseReport,
      taskSpecWrites,
      planningCommit,
      baseCommitGate,
      executionBatchSpecRecord,
      batchPreflight,
      preflightOutcome: "blocked",
      violations: [...batchPreflight.violations],
      nextAction: BATCH_PREFLIGHT_NEXT_ACTION,
    };
  }

  return {
    ...baseReport,
    pass: true,
    prepared: true,
    prepareOutcome: "passed",
    preflightOutcome: "passed",
    taskSpecWrites,
    planningCommit,
    baseCommitGate,
    executionBatchSpecRecord,
    batchPreflight,
    violations: [],
    nextAction: `run batches:execute --batch-id=${executionBatchSpecRecord.batchId} --batches-dir=${resolve(input.executionBatchesDir)} after Samantha selects the target branch`,
  };
}

function reportFor(
  input: PrepareBatchPlanInput,
  known: { draftPath?: string; batchId?: string; draft?: BatchPlanDraft } = {},
): PrepareBatchPlanReport {
  const report: PrepareBatchPlanReport = {
    pass: false,
    prepared: false,
    draftId: input.draftId,
    taskSpecWrites: [],
    planningCommit: null,
    baseCommitGate: null,
    executionBatchSpecRecord: null,
    batchPreflight: null,
    prepareOutcome: "blocked",
    preflightOutcome: "not_run",
    pushPerformed: false,
    violations: [],
    nextAction: READ_DRAFT_NEXT_ACTION,
  };

  if (known.draftPath !== undefined) {
    report.draftPath = known.draftPath;
  }
  if (known.batchId !== undefined) {
    report.batchId = known.batchId;
  }
  if (known.draft !== undefined) {
    report.sourceGoal = known.draft.sourceGoal;
    report.repoInspectionSummary = known.draft.repoInspection.currentStateSummary;
    report.proposedTaskCount = known.draft.proposedTasks.length;
  }

  return report;
}

function planningArtifactPathsFor(input: {
  repoRoot?: string;
  draftPath?: string;
  taskSpecWrites: TaskSpecWriteRecord[];
}): string[] {
  const paths = input.draftPath === undefined ? [] : [repoRelativePath(input.repoRoot, input.draftPath)];
  paths.push(...input.taskSpecWrites.map((record) => record.path));
  return paths;
}

function repoRelativePath(repoRoot: string | undefined, path: string): string {
  if (!isAbsolute(path)) {
    return path.replaceAll("\\", "/");
  }

  return relative(resolve(repoRoot ?? "."), path).replaceAll("\\", "/");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
