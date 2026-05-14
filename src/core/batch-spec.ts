export interface MinimalBatchTaskSpec {
  taskId: string;
}

export interface MinimalBatchDependency {
  before: string;
  after: string;
}

export interface MinimalBatchIntegrationQueueItem {
  order: number;
  taskId: string;
}

export interface BatchSpec {
  schemaVersion: 1;
  batchId: string;
  repoRoot: string;
  baseCommit: string;
  status: string;
  tasks: MinimalBatchTaskSpec[];
  dependencies: MinimalBatchDependency[];
  integrationQueue: MinimalBatchIntegrationQueueItem[];
}

const BATCH_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/;
const FULL_HEX_COMMIT_PATTERN = /^[0-9a-f]{40}$/;

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

  violations.push(...validateUniqueTaskIds(spec.tasks));
  violations.push(...validateDependencies(spec.tasks, spec.dependencies));
  if (hasDependencyCycle(spec.tasks, spec.dependencies)) {
    violations.push("dependencies must be acyclic");
  }
  violations.push(...validateIntegrationQueueOrder(spec.dependencies, spec.integrationQueue));

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

function validateIntegrationQueueOrder(
  dependencies: MinimalBatchDependency[],
  integrationQueue: MinimalBatchIntegrationQueueItem[],
): string[] {
  const violations: string[] = [];
  const orderByTaskId = new Map(integrationQueue.map((item) => [item.taskId, item.order]));

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

  return violations;
}
