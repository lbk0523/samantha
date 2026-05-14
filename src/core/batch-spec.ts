import { readFile } from "node:fs/promises";
import { isAbsolute, join, posix, resolve } from "node:path";
import type { TaskSpec } from "./contracts";
import { git, gitHead } from "./git";
import { matchesAnyGlob } from "./glob";

type BatchStatus =
  | "planned"
  | "preflight_passed"
  | "dispatched"
  | "partially_failed"
  | "integrated"
  | "rejected"
  | "cleaned";

type BatchTaskStatus =
  | "planned"
  | "eligible"
  | "dispatched"
  | "passed"
  | "failed"
  | "blocked"
  | "accepted"
  | "rejected"
  | "cleaned";

type IntegrationQueueStatus = "pending" | "accepted" | "skipped" | "failed";
type WriteSetClassification = "parallel_eligible" | "serial_only";

export interface SerialOnlyRule {
  id: string;
  glob: string;
  reason: string;
}

export interface MinimalBatchTaskSpec {
  taskId: string;
  taskSpecPath: string;
  targetAgent: string;
  declaredTargetFiles: string[];
  declaredForbiddenChanges: string[];
  expectedVerifyCommands: string[];
  writeSetClassification: WriteSetClassification;
  classificationReasons: string[];
  dispatchGroup: string;
  status: BatchTaskStatus;
  runLogPath?: string;
  candidateCommit?: string;
}

export interface MinimalBatchDependency {
  before: string;
  after: string;
}

export interface MinimalBatchIntegrationQueueItem {
  order: number;
  taskId: string;
  requiresAccepted: string[];
  expectedCandidateCommit?: string;
  focusedVerifyCommands: string[];
  status: IntegrationQueueStatus;
}

export interface BatchSpec {
  schemaVersion: 1;
  batchId: string;
  repoRoot: string;
  baseCommit: string;
  status: BatchStatus;
  serialOnlyRules: SerialOnlyRule[];
  tasks: MinimalBatchTaskSpec[];
  dependencies: MinimalBatchDependency[];
  integrationQueue: MinimalBatchIntegrationQueueItem[];
}

export interface BatchPreflightTask {
  taskId: string;
  taskSpecPath: string;
  normalizedTargetFiles: string[];
  normalizedForbiddenChanges: string[];
  serialOnlyMatches: SerialOnlyRule[];
}

export interface BatchPreflightWriteSetProof {
  dispatchGroup: string;
  taskIds: string[];
  normalizedTargetFilesByTaskId: Record<string, string[]>;
}

export interface BatchPreflightResult {
  mayDispatch: boolean;
  violations: string[];
  tasks: BatchPreflightTask[];
  writeSetProofs: BatchPreflightWriteSetProof[];
}

const BATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/;
const FULL_HEX_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const BATCH_STATUSES = new Set<BatchStatus>([
  "planned",
  "preflight_passed",
  "dispatched",
  "partially_failed",
  "integrated",
  "rejected",
  "cleaned",
]);
const BATCH_TASK_STATUSES = new Set<BatchTaskStatus>([
  "planned",
  "eligible",
  "dispatched",
  "passed",
  "failed",
  "blocked",
  "accepted",
  "rejected",
  "cleaned",
]);
const INTEGRATION_QUEUE_STATUSES = new Set<IntegrationQueueStatus>([
  "pending",
  "accepted",
  "skipped",
  "failed",
]);
const WRITE_SET_CLASSIFICATIONS = new Set<WriteSetClassification>(["parallel_eligible", "serial_only"]);
const PRE_DISPATCH_BATCH_STATUSES = new Set<BatchStatus>(["planned", "preflight_passed"]);
const GLOB_CHARS_PATTERN = /[*?[\]]/;

export const DEFAULT_SERIAL_ONLY_RULES: SerialOnlyRule[] = [
  {
    id: "contracts",
    glob: "src/core/contracts.ts",
    reason: "contract changes can grant or restrict authority",
  },
  {
    id: "policy",
    glob: "src/core/policy.ts",
    reason: "policy changes control dispatch authority",
  },
  {
    id: "package-metadata",
    glob: "package.json",
    reason: "package metadata changes affect all tasks",
  },
  {
    id: "lockfile",
    glob: "bun.lock",
    reason: "lockfile changes are shared integration state",
  },
  {
    id: "task-templates",
    glob: "references/task-templates/**",
    reason: "templates define future worker authority",
  },
  {
    id: "agent-profiles",
    glob: "references/agent-profiles/**",
    reason: "agent profiles define worker authority",
  },
  {
    id: "doctrine-agents",
    glob: "AGENTS.md",
    reason: "repository instructions define authority boundaries",
  },
  {
    id: "doctrine-north-star",
    glob: "NORTH_STAR.md",
    reason: "product identity defines authority boundaries",
  },
  {
    id: "doctrine-architecture",
    glob: "ARCHITECTURE.md",
    reason: "architecture defines authority boundaries",
  },
  {
    id: "doctrine-learning",
    glob: "LEARNING_ARCHITECTURE.md",
    reason: "learning rules define durable memory boundaries",
  },
  {
    id: "doctrine-roadmap",
    glob: "ROADMAP.md",
    reason: "roadmap changes phase authority",
  },
  {
    id: "doctrine-work-rules",
    glob: "WORK-RULES.md",
    reason: "work rules define execution discipline",
  },
];

export function validateMinimalBatchSpec(spec: BatchSpec): string[] {
  const violations: string[] = [];

  if (spec.schemaVersion !== 1) {
    violations.push("schemaVersion must be exactly 1");
  }
  if (!BATCH_ID_PATTERN.test(spec.batchId)) {
    violations.push("batchId must match ^[a-z0-9][a-z0-9-]{2,79}$");
  }
  if (!FULL_HEX_COMMIT_PATTERN.test(spec.baseCommit)) {
    violations.push("baseCommit must be a 40-character hex commit hash");
  }
  if (!BATCH_STATUSES.has(spec.status)) {
    violations.push(`status must be a valid BatchStatus: ${spec.status}`);
  }

  violations.push(...validateUniqueTaskIds(spec.tasks));
  violations.push(...validateTaskStatuses(spec.tasks));
  violations.push(...validateTaskPlanningFields(spec.tasks));
  violations.push(...validatePreDispatchEvidenceAbsence(spec));
  violations.push(...validateDependencies(spec.tasks, spec.dependencies));
  if (hasDependencyCycle(spec.tasks, spec.dependencies)) {
    violations.push("dependencies must be acyclic");
  }
  violations.push(...validateIntegrationQueue(spec.tasks, spec.dependencies, spec.integrationQueue));

  return violations;
}

export async function preflightBatchSpec(spec: BatchSpec): Promise<BatchPreflightResult> {
  const repoRoot = resolve(spec.repoRoot);
  const violations = validateMinimalBatchSpec(spec);
  await validateBatchGitBase(spec, repoRoot, violations);
  const serialOnlyRules = normalizeSerialOnlyRules(spec.serialOnlyRules, violations);
  const preflightTasks: BatchPreflightTask[] = [];

  for (const task of spec.tasks) {
    const normalizedTaskSpecPath = normalizeRepoRelativePath(task.taskSpecPath, {
      label: `tasks[].taskSpecPath for ${task.taskId}`,
      violations,
    });
    const declaredTargetFiles = normalizeRepoRelativePaths(task.declaredTargetFiles, {
      label: `tasks[].declaredTargetFiles for ${task.taskId}`,
      violations,
    });
    const declaredForbiddenChanges = normalizeRepoRelativePaths(task.declaredForbiddenChanges, {
      label: `tasks[].declaredForbiddenChanges for ${task.taskId}`,
      violations,
    });
    const serialOnlyMatches = serialOnlyRuleMatches(declaredTargetFiles, serialOnlyRules);

    preflightTasks.push({
      taskId: task.taskId,
      taskSpecPath: normalizedTaskSpecPath ?? task.taskSpecPath,
      normalizedTargetFiles: declaredTargetFiles,
      normalizedForbiddenChanges: declaredForbiddenChanges,
      serialOnlyMatches,
    });

    if (normalizedTaskSpecPath === undefined) {
      continue;
    }

    let parsedTask: TaskSpec | undefined;
    try {
      parsedTask = JSON.parse(await readFile(join(repoRoot, normalizedTaskSpecPath), "utf8")) as TaskSpec;
    } catch (err) {
      violations.push(`tasks[].taskSpecPath must parse as TaskSpec JSON: ${task.taskId}`);
      continue;
    }

    violations.push(...validateTaskSpecMatch(task, parsedTask));

    if (serialOnlyMatches.length > 0 && task.writeSetClassification !== "serial_only") {
      violations.push(
        `tasks[].writeSetClassification must be serial_only when target matches serialOnlyRules: ${task.taskId}`,
      );
    }
  }

  const writeSetProofs = validateDispatchGroupWriteSets(spec, preflightTasks, violations);

  return {
    mayDispatch: violations.length === 0,
    violations,
    tasks: preflightTasks,
    writeSetProofs,
  };
}

async function validateBatchGitBase(spec: BatchSpec, repoRoot: string, violations: string[]): Promise<void> {
  if (!FULL_HEX_COMMIT_PATTERN.test(spec.baseCommit)) {
    return;
  }

  let head: string;
  try {
    head = await gitHead(repoRoot);
  } catch {
    violations.push("repoRoot must be a git repository with a resolvable HEAD");
    return;
  }

  if (!(await gitCommitExists(spec.baseCommit, repoRoot))) {
    violations.push(`baseCommit must resolve to a git commit in repoRoot: ${spec.baseCommit}`);
    return;
  }

  if (head !== spec.baseCommit) {
    violations.push(
      `repoRoot HEAD must match baseCommit before dispatch: HEAD ${head} != baseCommit ${spec.baseCommit}`,
    );
  }
}

async function gitCommitExists(commit: string, repoRoot: string): Promise<boolean> {
  try {
    await git(["rev-parse", "--verify", `${commit}^{commit}`], repoRoot);
    return true;
  } catch {
    return false;
  }
}

function normalizeRepoRelativePath(
  value: string,
  input: { label: string; violations: string[] },
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    input.violations.push(`${input.label} must be a non-empty repo-relative path`);
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
    input.violations.push(`${input.label} must be a repo-relative path without .. segments: ${value}`);
    return undefined;
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    input.violations.push(`${input.label} must stay inside repoRoot: ${value}`);
    return undefined;
  }

  return normalized;
}

function normalizeSerialOnlyRules(rules: SerialOnlyRule[], violations: string[]): SerialOnlyRule[] {
  if (!Array.isArray(rules)) {
    violations.push("serialOnlyRules must be a string-glob rule array");
    return [];
  }

  const normalizedRules: SerialOnlyRule[] = [];
  for (const rule of rules) {
    const normalizedGlob = normalizeRepoRelativePath(rule.glob, {
      label: `serialOnlyRules[].glob for ${rule.id}`,
      violations,
    });
    if (
      !isNonEmptyString(rule.id) ||
      !isNonEmptyString(rule.reason) ||
      normalizedGlob === undefined
    ) {
      violations.push(`serialOnlyRules[] entries must include id, glob, and reason: ${rule.id}`);
      continue;
    }
    normalizedRules.push({ ...rule, glob: normalizedGlob });
  }

  return normalizedRules;
}

function normalizeRepoRelativePaths(
  values: string[],
  input: { label: string; violations: string[] },
): string[] {
  if (!Array.isArray(values)) {
    input.violations.push(`${input.label} must be a string array`);
    return [];
  }

  const normalized: string[] = [];
  for (const value of values) {
    const path = normalizeRepoRelativePath(value, input);
    if (path !== undefined) {
      normalized.push(path);
    }
  }
  return normalized;
}

function serialOnlyRuleMatches(targetFiles: string[], rules: SerialOnlyRule[]): SerialOnlyRule[] {
  return rules.filter((rule) => targetFiles.some((targetFile) => matchesAnyGlob(targetFile, [rule.glob])));
}

function validateTaskSpecMatch(batchTask: MinimalBatchTaskSpec, taskSpec: TaskSpec): string[] {
  const violations: string[] = [];

  if (taskSpec.id !== batchTask.taskId) {
    violations.push(`tasks[].taskId must match referenced TaskSpec id: ${batchTask.taskId}`);
  }
  if (taskSpec.targetAgent !== batchTask.targetAgent) {
    violations.push(`tasks[].targetAgent must match referenced TaskSpec: ${batchTask.taskId}`);
  }
  if (taskSpec.resultMode === "report") {
    violations.push(`referenced TaskSpec must be writer behavior, not report: ${batchTask.taskId}`);
  }
  if (!hasOnlyNonEmptyStrings(taskSpec.targetFiles, { allowEmpty: false })) {
    violations.push(`referenced TaskSpec targetFiles must be a non-empty string array: ${batchTask.taskId}`);
  }
  if (!hasOnlyNonEmptyStrings(taskSpec.forbiddenChanges, { allowEmpty: false })) {
    violations.push(`referenced TaskSpec forbiddenChanges must be a non-empty string array: ${batchTask.taskId}`);
  }
  if (!hasOnlyNonEmptyStrings(taskSpec.verifyCommands, { allowEmpty: false })) {
    violations.push(`referenced TaskSpec verifyCommands must be a non-empty string array: ${batchTask.taskId}`);
  }

  const localViolations: string[] = [];
  const taskSpecTargetFiles = normalizeRepoRelativePaths(taskSpec.targetFiles, {
    label: `TaskSpec targetFiles for ${batchTask.taskId}`,
    violations: localViolations,
  });
  const taskSpecForbiddenChanges = normalizeRepoRelativePaths(taskSpec.forbiddenChanges, {
    label: `TaskSpec forbiddenChanges for ${batchTask.taskId}`,
    violations: localViolations,
  });
  violations.push(...localViolations);

  const declaredTargetFiles = normalizeRepoRelativePaths(batchTask.declaredTargetFiles, {
    label: `tasks[].declaredTargetFiles for ${batchTask.taskId}`,
    violations: [],
  });
  const declaredForbiddenChanges = normalizeRepoRelativePaths(batchTask.declaredForbiddenChanges, {
    label: `tasks[].declaredForbiddenChanges for ${batchTask.taskId}`,
    violations: [],
  });

  if (!sameStringArray(declaredTargetFiles, taskSpecTargetFiles)) {
    violations.push(`tasks[].declaredTargetFiles must match referenced TaskSpec targetFiles: ${batchTask.taskId}`);
  }
  if (!sameStringArray(declaredForbiddenChanges, taskSpecForbiddenChanges)) {
    violations.push(
      `tasks[].declaredForbiddenChanges must match referenced TaskSpec forbiddenChanges: ${batchTask.taskId}`,
    );
  }
  if (!sameStringArray(batchTask.expectedVerifyCommands, taskSpec.verifyCommands)) {
    violations.push(`tasks[].expectedVerifyCommands must match referenced TaskSpec verifyCommands: ${batchTask.taskId}`);
  }

  return violations;
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateDispatchGroupWriteSets(
  spec: BatchSpec,
  preflightTasks: BatchPreflightTask[],
  violations: string[],
): BatchPreflightWriteSetProof[] {
  const preflightTaskById = new Map(preflightTasks.map((task) => [task.taskId, task]));
  const taskById = new Map(spec.tasks.map((task) => [task.taskId, task]));
  const groups = new Map<string, MinimalBatchTaskSpec[]>();
  const proofs: BatchPreflightWriteSetProof[] = [];

  for (const task of spec.tasks) {
    groups.set(task.dispatchGroup, [...(groups.get(task.dispatchGroup) ?? []), task]);
  }

  for (const [dispatchGroup, tasks] of groups) {
    const serialTasks = tasks.filter((task) => task.writeSetClassification === "serial_only");
    for (const task of serialTasks) {
      if (tasks.length > 1) {
        violations.push(`serial_only task must be the only member of its dispatchGroup: ${task.taskId}`);
      }
    }

    const normalizedTargetFilesByTaskId: Record<string, string[]> = {};
    for (const task of tasks) {
      const preflightTask = preflightTaskById.get(task.taskId);
      normalizedTargetFilesByTaskId[task.taskId] = preflightTask?.normalizedTargetFiles ?? [];

      if (
        task.writeSetClassification === "parallel_eligible" &&
        normalizedTargetFilesByTaskId[task.taskId].some(hasGlobChars)
      ) {
        violations.push(
          `parallel_eligible task targetFiles must be literal paths for disjoint preflight: ${task.taskId}`,
        );
      }
    }

    for (let leftIndex = 0; leftIndex < tasks.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < tasks.length; rightIndex += 1) {
        const left = tasks[leftIndex];
        const right = tasks[rightIndex];
        if (left.writeSetClassification !== "parallel_eligible" || right.writeSetClassification !== "parallel_eligible") {
          continue;
        }

        const leftPreflight = preflightTaskById.get(left.taskId);
        const rightPreflight = preflightTaskById.get(right.taskId);
        if (leftPreflight === undefined || rightPreflight === undefined) {
          continue;
        }

        violations.push(
          ...validatePairwiseWriteSetDisjointness({
            left,
            right,
            leftTargets: leftPreflight.normalizedTargetFiles,
            rightTargets: rightPreflight.normalizedTargetFiles,
            leftForbiddenChanges: leftPreflight.normalizedForbiddenChanges,
            rightForbiddenChanges: rightPreflight.normalizedForbiddenChanges,
          }),
        );
      }
    }

    proofs.push({
      dispatchGroup,
      taskIds: tasks.map((task) => task.taskId),
      normalizedTargetFilesByTaskId,
    });
  }

  for (const preflightTask of preflightTasks) {
    const task = taskById.get(preflightTask.taskId);
    if (task === undefined) continue;
    if (preflightTask.serialOnlyMatches.length === 0 || task.writeSetClassification === "serial_only") {
      continue;
    }
    violations.push(
      `parallel_eligible task targetFiles must not match serialOnlyRules: ${task.taskId}`,
    );
  }

  return proofs;
}

function validatePairwiseWriteSetDisjointness(input: {
  left: MinimalBatchTaskSpec;
  right: MinimalBatchTaskSpec;
  leftTargets: string[];
  rightTargets: string[];
  leftForbiddenChanges: string[];
  rightForbiddenChanges: string[];
}): string[] {
  const violations: string[] = [];

  for (const leftTarget of input.leftTargets) {
    for (const rightTarget of input.rightTargets) {
      if (pathsOverlap(leftTarget, rightTarget)) {
        violations.push(
          `dispatchGroup targetFiles must be disjoint: ${input.left.taskId} ${leftTarget} overlaps ${input.right.taskId} ${rightTarget}`,
        );
      }
    }

    const forbidden = input.rightForbiddenChanges.find((pattern) => matchesAnyGlob(leftTarget, [pattern]));
    if (forbidden !== undefined) {
      violations.push(
        `dispatchGroup targetFiles must not match another task's forbiddenChanges: ${input.left.taskId} ${leftTarget} matches ${input.right.taskId} ${forbidden}`,
      );
    }
  }

  for (const rightTarget of input.rightTargets) {
    const forbidden = input.leftForbiddenChanges.find((pattern) => matchesAnyGlob(rightTarget, [pattern]));
    if (forbidden !== undefined) {
      violations.push(
        `dispatchGroup targetFiles must not match another task's forbiddenChanges: ${input.right.taskId} ${rightTarget} matches ${input.left.taskId} ${forbidden}`,
      );
    }
  }

  return violations;
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function hasGlobChars(path: string): boolean {
  return GLOB_CHARS_PATTERN.test(path);
}

function validateTaskPlanningFields(tasks: MinimalBatchTaskSpec[]): string[] {
  const violations: string[] = [];

  for (const task of tasks) {
    if (!isNonEmptyString(task.taskSpecPath)) {
      violations.push(`tasks[].taskSpecPath must be a non-empty string: ${task.taskId}`);
    }
    if (!isNonEmptyString(task.targetAgent)) {
      violations.push(`tasks[].targetAgent must be a non-empty string: ${task.taskId}`);
    }
    violations.push(...validateNonEmptyStringArray(task.taskId, "declaredTargetFiles", task.declaredTargetFiles));
    violations.push(
      ...validateNonEmptyStringArray(task.taskId, "declaredForbiddenChanges", task.declaredForbiddenChanges),
    );
    violations.push(...validateNonEmptyStringArray(task.taskId, "expectedVerifyCommands", task.expectedVerifyCommands));
    if (!WRITE_SET_CLASSIFICATIONS.has(task.writeSetClassification)) {
      violations.push(
        `tasks[].writeSetClassification must be parallel_eligible or serial_only: ${task.taskId}`,
      );
    }
    if (
      task.writeSetClassification === "serial_only" &&
      !hasOnlyNonEmptyStrings(task.classificationReasons, { allowEmpty: false })
    ) {
      violations.push(`tasks[].classificationReasons must be non-empty for serial_only: ${task.taskId}`);
    }
    if (!isNonEmptyString(task.dispatchGroup)) {
      violations.push(`tasks[].dispatchGroup must be a non-empty string: ${task.taskId}`);
    }
  }

  return violations;
}

function validateNonEmptyStringArray(
  taskId: string,
  fieldName: "declaredTargetFiles" | "declaredForbiddenChanges" | "expectedVerifyCommands",
  value: string[],
): string[] {
  if (!hasOnlyNonEmptyStrings(value, { allowEmpty: false })) {
    return [`tasks[].${fieldName} must be a non-empty string array: ${taskId}`];
  }

  return [];
}

function hasOnlyNonEmptyStrings(value: string[], options: { allowEmpty: boolean }): boolean {
  if (!Array.isArray(value)) {
    return false;
  }
  if (!options.allowEmpty && value.length === 0) {
    return false;
  }

  return value.every(isNonEmptyString);
}

function isNonEmptyString(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function validateTaskStatuses(tasks: MinimalBatchTaskSpec[]): string[] {
  const violations: string[] = [];

  for (const task of tasks) {
    if (!BATCH_TASK_STATUSES.has(task.status)) {
      violations.push(`tasks[].status must be a valid BatchTaskStatus: ${task.taskId} has ${task.status}`);
    }
  }

  return violations;
}

function validatePreDispatchEvidenceAbsence(spec: BatchSpec): string[] {
  const violations: string[] = [];

  if (!PRE_DISPATCH_BATCH_STATUSES.has(spec.status)) {
    return violations;
  }

  for (const task of spec.tasks) {
    if (task.runLogPath !== undefined) {
      violations.push(`tasks[].runLogPath must be absent before dispatch: ${task.taskId}`);
    }
    if (task.candidateCommit !== undefined) {
      violations.push(`tasks[].candidateCommit must be absent before dispatch: ${task.taskId}`);
    }
  }

  for (const item of spec.integrationQueue) {
    if (item.expectedCandidateCommit !== undefined) {
      violations.push(`integrationQueue[].expectedCandidateCommit must be absent before dispatch: ${item.taskId}`);
    }
  }

  return violations;
}

function validateUniqueTaskIds(tasks: MinimalBatchTaskSpec[]): string[] {
  const violations: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const task of tasks) {
    if (seen.has(task.taskId)) {
      duplicates.add(task.taskId);
    }
    seen.add(task.taskId);
  }

  for (const taskId of duplicates) {
    violations.push(`tasks[].taskId must be unique: ${taskId}`);
  }

  return violations;
}

function validateDependencies(
  tasks: MinimalBatchTaskSpec[],
  dependencies: MinimalBatchDependency[],
): string[] {
  const violations: string[] = [];
  const taskIds = new Set(tasks.map((task) => task.taskId));

  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.before)) {
      violations.push(`dependencies[].before must reference an existing taskId: ${dependency.before}`);
    }
    if (!taskIds.has(dependency.after)) {
      violations.push(`dependencies[].after must reference an existing taskId: ${dependency.after}`);
    }
    if (dependency.before === dependency.after) {
      violations.push(`dependencies must not point a task at itself: ${dependency.before}`);
    }
  }

  return violations;
}

function hasDependencyCycle(
  tasks: MinimalBatchTaskSpec[],
  dependencies: MinimalBatchDependency[],
): boolean {
  const graph = new Map<string, string[]>();
  for (const task of tasks) {
    graph.set(task.taskId, []);
  }
  for (const dependency of dependencies) {
    graph.set(dependency.before, [...(graph.get(dependency.before) ?? []), dependency.after]);
  }

  const state = new Map<string, "visiting" | "visited">();

  function visit(taskId: string): boolean {
    const current = state.get(taskId);
    if (current === "visiting") return true;
    if (current === "visited") return false;

    state.set(taskId, "visiting");
    for (const nextTaskId of graph.get(taskId) ?? []) {
      if (visit(nextTaskId)) return true;
    }
    state.set(taskId, "visited");
    return false;
  }

  for (const taskId of graph.keys()) {
    if (visit(taskId)) return true;
  }

  return false;
}

function validateIntegrationQueue(
  tasks: MinimalBatchTaskSpec[],
  dependencies: MinimalBatchDependency[],
  integrationQueue: MinimalBatchIntegrationQueueItem[],
): string[] {
  const violations: string[] = [];
  const taskIds = new Set(tasks.map((task) => task.taskId));
  const queueCountByTaskId = new Map<string, number>();

  for (const item of integrationQueue) {
    if (!INTEGRATION_QUEUE_STATUSES.has(item.status)) {
      violations.push(`integrationQueue[].status must be pending, accepted, skipped, or failed: ${item.taskId}`);
    }
    if (!Array.isArray(item.requiresAccepted)) {
      violations.push(`integrationQueue[].requiresAccepted must be a string array: ${item.taskId}`);
    }
    if (!Array.isArray(item.focusedVerifyCommands)) {
      violations.push(`integrationQueue[].focusedVerifyCommands must be a string array: ${item.taskId}`);
    }
    if (!taskIds.has(item.taskId)) {
      violations.push(`integrationQueue[].taskId must reference an existing taskId: ${item.taskId}`);
    }
    queueCountByTaskId.set(item.taskId, (queueCountByTaskId.get(item.taskId) ?? 0) + 1);
  }

  for (const task of tasks) {
    const count = queueCountByTaskId.get(task.taskId) ?? 0;
    if (count === 0) {
      violations.push(`integrationQueue must include every task exactly once: missing ${task.taskId}`);
    }
    if (count > 1) {
      violations.push(`integrationQueue must include every task exactly once: duplicate ${task.taskId}`);
    }
  }

  const sortedOrders = integrationQueue.map((item) => item.order).sort((a, b) => a - b);
  if (sortedOrders.some((order, index) => order !== index + 1)) {
    violations.push("integrationQueue[].order must start at 1 and be contiguous");
  }

  const orderByTaskId = new Map(integrationQueue.map((item) => [item.taskId, item.order]));

  for (const item of integrationQueue) {
    if (!Array.isArray(item.requiresAccepted)) continue;
    for (const requiredTaskId of item.requiresAccepted) {
      if (!taskIds.has(requiredTaskId)) {
        violations.push(
          `integrationQueue[].requiresAccepted must reference an existing taskId: ${item.taskId} requires ${requiredTaskId}`,
        );
      }
      if (requiredTaskId === item.taskId) {
        violations.push(`integrationQueue[].requiresAccepted must not include itself: ${item.taskId}`);
      }

      const requiredOrder = orderByTaskId.get(requiredTaskId);
      if (requiredOrder !== undefined && requiredOrder >= item.order) {
        violations.push(
          `integrationQueue[].requiresAccepted must reference an earlier queue item: ${item.taskId} requires ${requiredTaskId}`,
        );
      }
    }
  }

  for (const dependency of dependencies) {
    const beforeOrder = orderByTaskId.get(dependency.before);
    const afterOrder = orderByTaskId.get(dependency.after);
    if (beforeOrder === undefined || afterOrder === undefined) continue;
    if (beforeOrder >= afterOrder) {
      violations.push(
        `integrationQueue must order dependencies before dependents: ${dependency.before} before ${dependency.after}`,
      );
    }
  }

  const queueItemByTaskId = new Map(integrationQueue.map((item) => [item.taskId, item]));

  for (const task of tasks) {
    const queueItem = queueItemByTaskId.get(task.taskId);
    if (queueItem === undefined) continue;
    if (!Array.isArray(task.expectedVerifyCommands) || !Array.isArray(queueItem.focusedVerifyCommands)) continue;
    for (const expectedCommand of task.expectedVerifyCommands) {
      if (!queueItem.focusedVerifyCommands.includes(expectedCommand)) {
        violations.push(
          `integrationQueue[].focusedVerifyCommands must include expected verify command: ${task.taskId} requires ${expectedCommand}`,
        );
      }
    }
  }

  for (const dependency of dependencies) {
    const dependentQueueItem = queueItemByTaskId.get(dependency.after);
    if (dependentQueueItem === undefined) continue;
    if (!Array.isArray(dependentQueueItem.requiresAccepted)) continue;
    if (!dependentQueueItem.requiresAccepted.includes(dependency.before)) {
      violations.push(
        `integrationQueue[].requiresAccepted must include direct dependency: ${dependency.after} requires ${dependency.before}`,
      );
    }
  }

  return violations;
}
