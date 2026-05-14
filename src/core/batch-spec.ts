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
  tasks: MinimalBatchTaskSpec[];
  dependencies: MinimalBatchDependency[];
  integrationQueue: MinimalBatchIntegrationQueueItem[];
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
