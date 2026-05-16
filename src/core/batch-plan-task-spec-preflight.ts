import { isAbsolute, posix } from "node:path";
import type {
  BatchPlanAssemblyDryRunResult,
  DryRunStoredBatchPlanAssemblyInput,
  TaskSpecPlan,
} from "./batch-plan-assembly";
import { dryRunStoredBatchPlanAssembly } from "./batch-plan-assembly";
import type { TaskSpec } from "./contracts";

export interface TaskSpecWritePlan {
  path: string;
  taskSpec: TaskSpec;
}

export interface TaskSpecWritePreflightResult {
  mayWrite: boolean;
  violations: string[];
  draftId: string;
  draftPath?: string;
  taskSpecWritePlans: TaskSpecWritePlan[];
  nextAction: string;
}

export type PreflightStoredBatchPlanTaskSpecWritesInput = DryRunStoredBatchPlanAssemblyInput;

const BLOCKED_NEXT_ACTION = "resolve assembly dry-run violations before TaskSpec write preflight";
const READY_NEXT_ACTION = "TaskSpec candidates are ready for explicit artifact creation";
const REWORK_NEXT_ACTION = "rework assembly dry-run before TaskSpec write preflight";
const EXECUTABLE_BATCH_SKELETON_FIELDS = [
  "baseCommit",
  "repoRoot",
  "dispatchGroup",
  "dispatchGroups",
  "integrationQueue",
  "serialOnlyRules",
  "lifecyclePolicy",
  "verification",
] as const;

export function preflightTaskSpecWrites(
  assemblyResult: BatchPlanAssemblyDryRunResult,
): TaskSpecWritePreflightResult {
  if (!assemblyResult.mayAssemble) {
    return resultWithOptionalDraftPath({
      mayWrite: false,
      violations: [...assemblyResult.violations],
      draftId: assemblyResult.draftId,
      draftPath: assemblyResult.draftPath,
      taskSpecWritePlans: [],
      nextAction: BLOCKED_NEXT_ACTION,
    });
  }

  const violations = [...assemblyResult.violations];
  const taskSpecWritePlans: TaskSpecWritePlan[] = [];
  validateBatchSkeleton(assemblyResult, violations);

  const plans = Array.isArray(assemblyResult.taskSpecPlans) ? assemblyResult.taskSpecPlans : [];
  if (plans.length === 0) {
    violations.push("taskSpecPlans must contain at least one TaskSpec plan");
  }

  const seenTaskIds = new Set<string>();
  const duplicateTaskIds = new Set<string>();
  const seenPaths = new Set<string>();
  const duplicatePaths = new Set<string>();
  const normalizedPlans: Array<{ plan: TaskSpecPlan; path: string }> = [];

  plans.forEach((plan, index) => {
    const normalized = validateTaskSpecPlan(plan, index, {
      violations,
      seenTaskIds,
      duplicateTaskIds,
      seenPaths,
      duplicatePaths,
    });
    if (normalized) {
      normalizedPlans.push({ plan, path: normalized.path });
    }
  });

  for (const taskId of [...duplicateTaskIds].sort()) {
    violations.push(`taskSpecPlans[].taskId must be unique: ${taskId}`);
  }
  for (const path of [...duplicatePaths].sort()) {
    violations.push(`taskSpecPlans[].taskSpecPath must be unique: ${path}`);
  }

  validateTaskIdsMatchSkeleton(assemblyResult, violations);

  if (violations.length === 0) {
    for (const { plan, path } of normalizedPlans) {
      taskSpecWritePlans.push({
        path,
        taskSpec: taskSpecCandidateFor(plan, assemblyResult.draftId),
      });
    }
  }

  return resultWithOptionalDraftPath({
    mayWrite: violations.length === 0,
    violations,
    draftId: assemblyResult.draftId,
    draftPath: assemblyResult.draftPath,
    taskSpecWritePlans,
    nextAction: violations.length === 0 ? READY_NEXT_ACTION : REWORK_NEXT_ACTION,
  });
}

export async function preflightStoredBatchPlanTaskSpecWrites(
  input: PreflightStoredBatchPlanTaskSpecWritesInput,
): Promise<TaskSpecWritePreflightResult> {
  return preflightTaskSpecWrites(await dryRunStoredBatchPlanAssembly(input));
}

function validateBatchSkeleton(assemblyResult: BatchPlanAssemblyDryRunResult, violations: string[]): void {
  const skeleton = assemblyResult.batchSkeleton as unknown;
  if (!isRecord(skeleton)) {
    violations.push("batchSkeleton must be present for TaskSpec write preflight");
    return;
  }

  if (skeleton.status !== "planned") {
    violations.push("batchSkeleton.status must be planned before TaskSpec write preflight");
  }
  if (skeleton.requiresBaseCommit !== true) {
    violations.push("batchSkeleton.requiresBaseCommit must remain true before TaskSpec write preflight");
  }
  if (!hasOnlyNonEmptyStrings(skeleton.taskIds)) {
    violations.push("batchSkeleton.taskIds must be a non-empty string array");
  }

  for (const field of EXECUTABLE_BATCH_SKELETON_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(skeleton, field)) {
      violations.push(`batchSkeleton.${field} must be absent before TaskSpec write preflight`);
    }
  }
}

function validateTaskSpecPlan(
  plan: TaskSpecPlan,
  index: number,
  input: {
    violations: string[];
    seenTaskIds: Set<string>;
    duplicateTaskIds: Set<string>;
    seenPaths: Set<string>;
    duplicatePaths: Set<string>;
  },
): { path: string } | undefined {
  const candidate = plan as unknown;
  if (!isRecord(candidate)) {
    input.violations.push(`taskSpecPlans[${index}] must be an object`);
    return undefined;
  }

  const taskId = isNonEmptyString(candidate.taskId) ? candidate.taskId : `index ${index}`;
  if (!isNonEmptyString(candidate.taskId)) {
    input.violations.push(`taskSpecPlans[${index}].taskId must be a non-empty string`);
  } else if (input.seenTaskIds.has(candidate.taskId)) {
    input.duplicateTaskIds.add(candidate.taskId);
  } else {
    input.seenTaskIds.add(candidate.taskId);
  }

  const normalizedPath = normalizeTaskSpecPath(candidate.taskSpecPath, taskId, input.violations);
  if (normalizedPath) {
    if (input.seenPaths.has(normalizedPath)) {
      input.duplicatePaths.add(normalizedPath);
    } else {
      input.seenPaths.add(normalizedPath);
    }
  }

  if (candidate.targetAgent !== "codex-worker") {
    input.violations.push(`taskSpecPlans[].targetAgent must be codex-worker: ${taskId}`);
  }
  if (!hasOnlyNonEmptyStrings(candidate.targetFiles)) {
    input.violations.push(`taskSpecPlans[].targetFiles must be a non-empty string array: ${taskId}`);
  }
  if (!hasOnlyNonEmptyStrings(candidate.forbiddenChanges)) {
    input.violations.push(`taskSpecPlans[].forbiddenChanges must be a non-empty string array: ${taskId}`);
  }
  if (!hasOnlyNonEmptyStrings(candidate.verifyCommands)) {
    input.violations.push(`taskSpecPlans[].verifyCommands must be a non-empty string array: ${taskId}`);
  }
  if (!isNonEmptyString(candidate.title)) {
    input.violations.push(`taskSpecPlans[].title must be a non-empty string: ${taskId}`);
  }
  if (!isNonEmptyString(candidate.expectedCommitSubject)) {
    input.violations.push(`taskSpecPlans[].expectedCommitSubject must be a non-empty string: ${taskId}`);
  }
  if (candidate.status !== "pending") {
    input.violations.push(`taskSpecPlans[].status must be pending: ${taskId}`);
  }

  return normalizedPath ? { path: normalizedPath } : undefined;
}

function validateTaskIdsMatchSkeleton(assemblyResult: BatchPlanAssemblyDryRunResult, violations: string[]): void {
  const skeleton = assemblyResult.batchSkeleton as unknown;
  if (!isRecord(skeleton) || !Array.isArray(skeleton.taskIds)) return;

  const taskIds = Array.isArray(assemblyResult.taskSpecPlans)
    ? assemblyResult.taskSpecPlans.map((plan) => (plan as unknown as Record<string, unknown>).taskId)
    : [];
  if (
    skeleton.taskIds.length !== taskIds.length ||
    skeleton.taskIds.some((taskId, index) => taskId !== taskIds[index])
  ) {
    violations.push("batchSkeleton.taskIds must match taskSpecPlans taskIds in order");
  }
}

function normalizeTaskSpecPath(value: unknown, taskId: string, violations: string[]): string | undefined {
  if (!isNonEmptyString(value)) {
    violations.push(`taskSpecPlans[].taskSpecPath must be a non-empty repo-relative .json path: ${taskId}`);
    return undefined;
  }

  const candidate = value.trim().replaceAll("\\", "/");
  const rawSegments = candidate.split("/");
  if (
    isAbsolute(value) ||
    candidate.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    rawSegments.includes("..")
  ) {
    violations.push(
      `taskSpecPlans[].taskSpecPath must be a repo-relative .json path without absolute or .. segments: ${value}`,
    );
    return undefined;
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    violations.push(`taskSpecPlans[].taskSpecPath must stay inside repo root: ${value}`);
    return undefined;
  }
  if (!normalized.endsWith(".json")) {
    violations.push(`taskSpecPlans[].taskSpecPath must end with .json: ${value}`);
    return undefined;
  }

  return normalized;
}

function taskSpecCandidateFor(plan: TaskSpecPlan, draftId: string): TaskSpec {
  return {
    id: plan.taskId,
    title: plan.title,
    targetAgent: plan.targetAgent,
    targetFiles: [...plan.targetFiles],
    forbiddenChanges: [...plan.forbiddenChanges],
    verifyCommands: [...plan.verifyCommands],
    instructions: [
      `This TaskSpec candidate came from BatchPlanDraft assembly dry-run for draft ${draftId}.`,
      "It is inert preflight data, not an artifact write.",
      "Existing Samantha harness gates remain authoritative before execution, commit, report, or lifecycle mutation.",
    ].join("\n"),
    expectedCommitSubject: plan.expectedCommitSubject,
    status: "pending",
  };
}

function resultWithOptionalDraftPath(result: TaskSpecWritePreflightResult): TaskSpecWritePreflightResult {
  if (result.draftPath === undefined) {
    const { draftPath: _draftPath, ...withoutDraftPath } = result;
    return withoutDraftPath;
  }
  return result;
}

function hasOnlyNonEmptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
