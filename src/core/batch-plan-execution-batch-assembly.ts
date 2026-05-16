import { isAbsolute, posix, relative } from "node:path";
import type { BatchPlanAssemblyDryRunResult, TaskSpecPlan } from "./batch-plan-assembly";
import type { PlanningArtifactBaseCommitGateResult } from "./batch-plan-planning-artifact-gate";
import {
  DEFAULT_SERIAL_ONLY_RULES,
  type BatchSpec,
  type MinimalBatchDependency,
  type SerialOnlyRule,
} from "./batch-spec";
import { matchesAnyGlob } from "./glob";

export interface DryRunExecutionBatchSpecAssemblyInput {
  assemblyResult: BatchPlanAssemblyDryRunResult;
  baseCommitGate: PlanningArtifactBaseCommitGateResult;
}

export interface ExecutionStoreRequirement {
  location: "outside_target_repo_dirty_tree_or_explicitly_ignored_state";
  reason: string;
  mustHappenBefore: "BatchSpec preflight and dispatch";
}

export interface ExecutionBatchSpecAssemblyDryRunResult {
  mayAssembleExecutionBatch: boolean;
  violations: string[];
  draftId: string;
  repoRoot?: string;
  baseCommit?: string;
  batchSpec: BatchSpec | null;
  executionStoreRequirement: ExecutionStoreRequirement;
  nextAction: string;
}

const EXECUTION_STORE_REQUIREMENT: ExecutionStoreRequirement = {
  location: "outside_target_repo_dirty_tree_or_explicitly_ignored_state",
  reason:
    "execution BatchSpec storage must not dirty the target repo or make baseCommit circular before dispatch",
  mustHappenBefore: "BatchSpec preflight and dispatch",
};
const SUCCESS_NEXT_ACTION =
  "write the execution BatchSpec to an out-of-tree or ignored execution store before BatchSpec preflight/dispatch";
const FAILURE_NEXT_ACTION = "rework assembly/baseCommit evidence before execution BatchSpec assembly";

export function dryRunExecutionBatchSpecAssembly(
  input: DryRunExecutionBatchSpecAssemblyInput,
): ExecutionBatchSpecAssemblyDryRunResult {
  const { assemblyResult, baseCommitGate } = input;
  const violations: string[] = [];

  if (!assemblyResult.mayAssemble) {
    violations.push(...assemblyResult.violations);
  }
  if (assemblyResult.mayAssemble && assemblyResult.batchSkeleton === null) {
    violations.push("batchSkeleton must be present before execution BatchSpec assembly");
  }

  if (!baseCommitGate.mayUseBaseCommit) {
    violations.push(...baseCommitGate.violations);
  }
  if (baseCommitGate.baseCommit === undefined) {
    violations.push("baseCommitGate.baseCommit must be present before execution BatchSpec assembly");
  }

  validatePlanningArtifactCoverage(assemblyResult, baseCommitGate, violations);

  const batchSkeleton = assemblyResult.batchSkeleton;
  if (
    violations.length > 0 ||
    batchSkeleton === null ||
    baseCommitGate.baseCommit === undefined ||
    !baseCommitGate.mayUseBaseCommit
  ) {
    return resultWithOptionalBaseCommit({
      mayAssembleExecutionBatch: false,
      violations,
      draftId: assemblyResult.draftId,
      repoRoot: baseCommitGate.repoRoot,
      baseCommit: baseCommitGate.baseCommit,
      batchSpec: null,
      executionStoreRequirement: EXECUTION_STORE_REQUIREMENT,
      nextAction: FAILURE_NEXT_ACTION,
    });
  }

  const taskPlans = assemblyResult.taskSpecPlans;
  const taskIds = taskPlans.map((plan) => plan.taskId);
  validateTaskPlanIdentity(taskPlans, batchSkeleton.taskIds, violations);

  const dependencies = dependencyHintsFor(batchSkeleton.dependencyHints, new Set(taskIds), violations);
  const classifications = classifyTasks(taskPlans);
  const dispatchGroups = dispatchGroupsFor(batchSkeleton.parallelizationHints, taskIds, classifications, violations);
  const topologicalTaskIds = topologicalTaskOrder(taskIds, dependencies);
  if (topologicalTaskIds === null) {
    violations.push("dependencyHints must be acyclic before execution BatchSpec assembly");
  }

  if (violations.length > 0 || topologicalTaskIds === null) {
    return resultWithOptionalBaseCommit({
      mayAssembleExecutionBatch: false,
      violations,
      draftId: assemblyResult.draftId,
      repoRoot: baseCommitGate.repoRoot,
      baseCommit: baseCommitGate.baseCommit,
      batchSpec: null,
      executionStoreRequirement: EXECUTION_STORE_REQUIREMENT,
      nextAction: FAILURE_NEXT_ACTION,
    });
  }

  const taskPlanById = new Map(taskPlans.map((plan) => [plan.taskId, plan]));
  const batchSpec: BatchSpec = {
    schemaVersion: 1,
    batchId: batchSkeleton.batchId,
    repoRoot: baseCommitGate.repoRoot,
    baseCommit: baseCommitGate.baseCommit,
    status: "planned",
    serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES.map((rule) => ({ ...rule })),
    tasks: taskPlans.map((plan) => {
      const classification = classifications.get(plan.taskId);
      return {
        taskId: plan.taskId,
        taskSpecPath: plan.taskSpecPath,
        targetAgent: plan.targetAgent,
        declaredTargetFiles: [...plan.targetFiles],
        declaredForbiddenChanges: [...plan.forbiddenChanges],
        expectedVerifyCommands: [...plan.verifyCommands],
        writeSetClassification: classification?.writeSetClassification ?? "parallel_eligible",
        classificationReasons: classification?.classificationReasons ?? [],
        dispatchGroup: dispatchGroups.get(plan.taskId) ?? singleTaskDispatchGroup(plan.taskId),
        status: "planned",
      };
    }),
    dependencies,
    integrationQueue: topologicalTaskIds.map((taskId, index) => {
      const plan = taskPlanById.get(taskId);
      return {
        order: index + 1,
        taskId,
        requiresAccepted: directDependenciesFor(taskId, dependencies, taskIds),
        focusedVerifyCommands: plan === undefined ? [] : [...plan.verifyCommands],
        status: "pending",
      };
    }),
    verification: {
      preflightChecks: [
        "validate minimal BatchSpec shape",
        "validate repoRoot HEAD equals baseCommit",
        "validate referenced TaskSpec JSON matches planned task declarations",
        "validate dependency DAG and integration queue",
        "validate serial-only classifications and dispatch groups",
        "validate dispatch group write-set disjointness",
      ],
      afterEachAcceptedMerge: ["run focusedVerifyCommands for each accepted integration queue item"],
      afterFinalAcceptedMerge: unionVerifyCommands(topologicalTaskIds, taskPlanById),
    },
    lifecyclePolicy: {
      staleBase: "block_and_replan",
      rebase: "explicit_samantha_owned_rebase_only",
      partialFailure: "block_dependents_allow_independent_candidates",
      cleanup: "explicit_per_worker_lifecycle_after_resolution",
    },
  };

  return resultWithOptionalBaseCommit({
    mayAssembleExecutionBatch: true,
    violations: [],
    draftId: assemblyResult.draftId,
    repoRoot: baseCommitGate.repoRoot,
    baseCommit: baseCommitGate.baseCommit,
    batchSpec,
    executionStoreRequirement: EXECUTION_STORE_REQUIREMENT,
    nextAction: SUCCESS_NEXT_ACTION,
  });
}

function validatePlanningArtifactCoverage(
  assemblyResult: BatchPlanAssemblyDryRunResult,
  baseCommitGate: PlanningArtifactBaseCommitGateResult,
  violations: string[],
): void {
  const committedPaths = new Set(
    baseCommitGate.planningArtifactPaths
      .map((path) => normalizeArtifactPath(path, baseCommitGate.repoRoot))
      .filter((path): path is string => path !== undefined),
  );

  if (assemblyResult.draftPath !== undefined) {
    const draftPath = normalizeArtifactPath(assemblyResult.draftPath, baseCommitGate.repoRoot);
    if (draftPath === undefined || !committedPaths.has(draftPath)) {
      violations.push(`planningArtifactPaths must include draftPath before execution BatchSpec assembly: ${assemblyResult.draftPath}`);
    }
  }

  for (const plan of assemblyResult.taskSpecPlans) {
    const taskSpecPath = normalizeArtifactPath(plan.taskSpecPath, baseCommitGate.repoRoot);
    if (taskSpecPath === undefined || !committedPaths.has(taskSpecPath)) {
      violations.push(
        `planningArtifactPaths must include taskSpecPath before execution BatchSpec assembly: ${plan.taskId} ${plan.taskSpecPath}`,
      );
    }
  }
}

function normalizeArtifactPath(path: string, repoRoot: string): string | undefined {
  const candidate = path.trim().replaceAll("\\", "/");
  const repoRootCandidate = repoRoot.replaceAll("\\", "/");
  const relativePath = isAbsolute(candidate) ? relative(repoRootCandidate, candidate).replaceAll("\\", "/") : candidate;
  if (relativePath.length === 0 || relativePath.startsWith("../") || relativePath === ".." || isAbsolute(relativePath)) {
    return undefined;
  }
  return posix.normalize(relativePath);
}

function validateTaskPlanIdentity(
  taskPlans: TaskSpecPlan[],
  skeletonTaskIds: string[],
  violations: string[],
): void {
  const taskIds = taskPlans.map((plan) => plan.taskId);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const taskId of taskIds) {
    if (seen.has(taskId)) duplicates.add(taskId);
    seen.add(taskId);
  }
  for (const taskId of [...duplicates].sort()) {
    violations.push(`taskSpecPlans[].taskId must be unique before execution BatchSpec assembly: ${taskId}`);
  }

  if (taskIds.length === 0) {
    violations.push("taskSpecPlans must contain at least one task before execution BatchSpec assembly");
  }
  if (
    taskIds.length !== skeletonTaskIds.length ||
    taskIds.some((taskId, index) => taskId !== skeletonTaskIds[index])
  ) {
    violations.push("batchSkeleton.taskIds must match taskSpecPlans taskIds before execution BatchSpec assembly");
  }
}

function dependencyHintsFor(
  dependencyHints: MinimalBatchDependency[],
  taskIds: Set<string>,
  violations: string[],
): MinimalBatchDependency[] {
  const dependencies: MinimalBatchDependency[] = [];
  for (const hint of dependencyHints) {
    if (!taskIds.has(hint.before)) {
      violations.push(`dependencyHints[].before must reference an execution task: ${hint.before}`);
    }
    if (!taskIds.has(hint.after)) {
      violations.push(`dependencyHints[].after must reference an execution task: ${hint.after}`);
    }
    if (hint.before === hint.after) {
      violations.push(`dependencyHints must not point a task at itself: ${hint.before}`);
    }
    dependencies.push({ before: hint.before, after: hint.after });
  }
  return dependencies;
}

function classifyTasks(
  taskPlans: TaskSpecPlan[],
): Map<string, { writeSetClassification: "parallel_eligible" | "serial_only"; classificationReasons: string[] }> {
  const classifications = new Map<
    string,
    { writeSetClassification: "parallel_eligible" | "serial_only"; classificationReasons: string[] }
  >();

  for (const plan of taskPlans) {
    const matchingRules = DEFAULT_SERIAL_ONLY_RULES.filter((rule) => targetFilesMatchRule(plan.targetFiles, rule));
    classifications.set(plan.taskId, {
      writeSetClassification: matchingRules.length > 0 ? "serial_only" : "parallel_eligible",
      classificationReasons: matchingRules.map((rule) => `${rule.id}: ${rule.reason}`),
    });
  }

  return classifications;
}

function targetFilesMatchRule(targetFiles: string[], rule: SerialOnlyRule): boolean {
  return targetFiles.some((targetFile) => matchesAnyGlob(targetFile, [rule.glob]));
}

function dispatchGroupsFor(
  parallelizationHints: Array<{ taskIds: string[] }>,
  taskIds: string[],
  classifications: Map<string, { writeSetClassification: "parallel_eligible" | "serial_only" }>,
  violations: string[],
): Map<string, string> {
  const dispatchGroups = new Map<string, string>();
  const seenHintTaskIds = new Set<string>();
  let hintedGroupIndex = 1;

  parallelizationHints.forEach((hint) => {
    for (const taskId of hint.taskIds) {
      const classification = classifications.get(taskId);
      if (classification === undefined) {
        violations.push(`parallelizationHints[].taskIds must reference known tasks: ${taskId}`);
        continue;
      }
      if (seenHintTaskIds.has(taskId)) {
        violations.push(`parallelizationHints[].taskIds must not duplicate task ids across hint groups: ${taskId}`);
      }
      if (classification.writeSetClassification === "serial_only") {
        violations.push(`parallelizationHints[].taskIds must not include serial_only tasks: ${taskId}`);
      }
      seenHintTaskIds.add(taskId);
    }
  });

  if (violations.some((violation) => violation.startsWith("parallelizationHints"))) {
    return dispatchGroups;
  }

  for (const hint of parallelizationHints) {
    if (hint.taskIds.length === 0) continue;
    const dispatchGroup = `parallel-hint-${hintedGroupIndex}`;
    hintedGroupIndex += 1;
    for (const taskId of hint.taskIds) {
      dispatchGroups.set(taskId, dispatchGroup);
    }
  }

  for (const taskId of taskIds) {
    if (!dispatchGroups.has(taskId)) {
      dispatchGroups.set(taskId, singleTaskDispatchGroup(taskId));
    }
  }

  return dispatchGroups;
}

function singleTaskDispatchGroup(taskId: string): string {
  return `single-${taskId}`;
}

function topologicalTaskOrder(taskIds: string[], dependencies: MinimalBatchDependency[]): string[] | null {
  const remainingDependenciesByTaskId = new Map(taskIds.map((taskId) => [taskId, 0]));
  const dependentsByTaskId = new Map(taskIds.map((taskId) => [taskId, [] as string[]]));
  for (const dependency of dependencies) {
    remainingDependenciesByTaskId.set(
      dependency.after,
      (remainingDependenciesByTaskId.get(dependency.after) ?? 0) + 1,
    );
    dependentsByTaskId.set(dependency.before, [...(dependentsByTaskId.get(dependency.before) ?? []), dependency.after]);
  }

  const ordered: string[] = [];
  const queued = new Set<string>();
  while (ordered.length < taskIds.length) {
    const nextTaskId = taskIds.find(
      (taskId) => !queued.has(taskId) && (remainingDependenciesByTaskId.get(taskId) ?? 0) === 0,
    );
    if (nextTaskId === undefined) {
      return null;
    }

    queued.add(nextTaskId);
    ordered.push(nextTaskId);
    for (const dependentTaskId of dependentsByTaskId.get(nextTaskId) ?? []) {
      remainingDependenciesByTaskId.set(
        dependentTaskId,
        (remainingDependenciesByTaskId.get(dependentTaskId) ?? 0) - 1,
      );
    }
  }

  return ordered;
}

function directDependenciesFor(taskId: string, dependencies: MinimalBatchDependency[], taskIds: string[]): string[] {
  return dependencies
    .filter((dependency) => dependency.after === taskId)
    .map((dependency) => dependency.before)
    .sort((left, right) => taskIds.indexOf(left) - taskIds.indexOf(right));
}

function unionVerifyCommands(taskIds: string[], taskPlanById: Map<string, TaskSpecPlan>): string[] {
  const commands: string[] = [];
  const seen = new Set<string>();
  for (const taskId of taskIds) {
    const plan = taskPlanById.get(taskId);
    for (const command of plan?.verifyCommands ?? []) {
      if (!seen.has(command)) {
        seen.add(command);
        commands.push(command);
      }
    }
  }
  return commands;
}

function resultWithOptionalBaseCommit(
  result: ExecutionBatchSpecAssemblyDryRunResult,
): ExecutionBatchSpecAssemblyDryRunResult {
  if (result.baseCommit === undefined) {
    const { baseCommit: _baseCommit, ...withoutBaseCommit } = result;
    return withoutBaseCommit;
  }
  return result;
}
