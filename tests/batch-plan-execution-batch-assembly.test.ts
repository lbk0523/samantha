import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchPlanAssemblyDryRunResult, TaskSpecPlan } from "../src/core/batch-plan-assembly";
import type { PlanningArtifactBaseCommitGateResult } from "../src/core/batch-plan-planning-artifact-gate";
import { validateMinimalBatchSpec } from "../src/core/batch-spec";
import { dryRunExecutionBatchSpecAssembly } from "../src/core/batch-plan-execution-batch-assembly";

let tmpRoots: string[] = [];

const BASE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const DRAFT_PATH = "references/batch-plans/execution-batch-assembly.json";

function taskSpecPlan(overrides: Partial<TaskSpecPlan> = {}): TaskSpecPlan {
  return {
    taskId: "execution-assembly-core",
    taskSpecPath: "references/tasks/execution-assembly-core.json",
    title: "Add execution assembly core",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "routine",
    targetAgent: "codex-worker",
    targetFiles: ["src/core/batch-plan-execution-batch-assembly.ts"],
    forbiddenChanges: ["src/cli.ts", "references/**", "runs/**"],
    verifyCommands: ["bun test tests/batch-plan-execution-batch-assembly.test.ts"],
    expectedCommitSubject: "feat: add execution assembly core",
    status: "pending",
    ...overrides,
  };
}

function assemblyResult(
  overrides: Partial<BatchPlanAssemblyDryRunResult> = {},
  taskSpecPlans: TaskSpecPlan[] = [taskSpecPlan()],
): BatchPlanAssemblyDryRunResult {
  return {
    mayAssemble: true,
    violations: [],
    draftId: "execution-batch-assembly",
    draftPath: DRAFT_PATH,
    taskSpecPlans,
    batchSkeleton: {
      batchId: "execution-batch-assembly",
      status: "planned",
      requiresBaseCommit: true,
      taskIds: taskSpecPlans.map((plan) => plan.taskId),
      dependencyHints: [],
      parallelizationHints: [],
    },
    nextAction: "review assembly dry-run output before artifact creation",
    ...overrides,
  };
}

function baseCommitGate(
  overrides: Partial<PlanningArtifactBaseCommitGateResult> = {},
  taskSpecPlans: TaskSpecPlan[] = [taskSpecPlan()],
): PlanningArtifactBaseCommitGateResult {
  return {
    mayUseBaseCommit: true,
    violations: [],
    repoRoot: "/repo",
    planningArtifactPaths: [DRAFT_PATH, ...taskSpecPlans.map((plan) => plan.taskSpecPath)],
    dirtyFiles: [],
    baseCommit: BASE_COMMIT,
    nextAction: "use returned baseCommit for execution BatchSpec generation outside the target repo dirty tree",
    ...overrides,
  };
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-execution-batch-assembly-"));
  tmpRoots.push(root);
  return root;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("execution BatchSpec assembly dry-run", () => {
  test("returns a planned BatchSpec candidate with the gate baseCommit without writing artifacts", async () => {
    const repoRoot = await makeTempRoot();
    const plans = [taskSpecPlan()];
    const result = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult({}, plans),
      baseCommitGate: baseCommitGate({ repoRoot }, plans),
    });

    expect(result.mayAssembleExecutionBatch).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.baseCommit).toBe(BASE_COMMIT);
    expect(result.repoRoot).toBe(repoRoot);
    expect(result.nextAction).toBe(
      "write the execution BatchSpec to an out-of-tree or ignored execution store before BatchSpec preflight/dispatch",
    );
    expect(result.executionStoreRequirement.location).toBe(
      "outside_target_repo_dirty_tree_or_explicitly_ignored_state",
    );
    expect(result.batchSpec).toMatchObject({
      schemaVersion: 1,
      batchId: "execution-batch-assembly",
      repoRoot,
      baseCommit: BASE_COMMIT,
      status: "planned",
      tasks: [
        {
          taskId: "execution-assembly-core",
          taskSpecPath: "references/tasks/execution-assembly-core.json",
          targetAgent: "codex-worker",
          declaredTargetFiles: ["src/core/batch-plan-execution-batch-assembly.ts"],
          declaredForbiddenChanges: ["src/cli.ts", "references/**", "runs/**"],
          expectedVerifyCommands: ["bun test tests/batch-plan-execution-batch-assembly.test.ts"],
          writeSetClassification: "parallel_eligible",
          classificationReasons: [],
          dispatchGroup: "single-execution-assembly-core",
          status: "planned",
        },
      ],
    });
    expect(result.batchSpec && validateMinimalBatchSpec(result.batchSpec)).toEqual([]);
    await expect(pathExists(join(repoRoot, "references", "batch-specs"))).resolves.toBe(false);
    await expect(pathExists(join(repoRoot, "references", "tasks"))).resolves.toBe(false);
  });

  test("requires committed planningArtifactPaths to include the draft and every TaskSpec path", () => {
    const plans = [
      taskSpecPlan({ taskId: "execution-assembly-core", taskSpecPath: "references/tasks/core.json" }),
      taskSpecPlan({ taskId: "execution-assembly-tests", taskSpecPath: "references/tasks/tests.json" }),
    ];

    const result = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult({}, plans),
      baseCommitGate: baseCommitGate(
        {
          planningArtifactPaths: ["references/tasks/core.json"],
        },
        plans,
      ),
    });

    expect(result.mayAssembleExecutionBatch).toBe(false);
    expect(result.batchSpec).toBeNull();
    expect(result.violations).toContain(
      `planningArtifactPaths must include draftPath before execution BatchSpec assembly: ${DRAFT_PATH}`,
    );
    expect(result.violations).toContain(
      "planningArtifactPaths must include taskSpecPath before execution BatchSpec assembly: execution-assembly-tests references/tasks/tests.json",
    );
  });

  test("blocks when assembly or baseCommit evidence is blocked", () => {
    const blockedAssembly = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult({
        mayAssemble: false,
        violations: ["promotion preflight blocked this assembly"],
        batchSkeleton: null,
        taskSpecPlans: [],
      }),
      baseCommitGate: baseCommitGate(),
    });
    expect(blockedAssembly.mayAssembleExecutionBatch).toBe(false);
    expect(blockedAssembly.batchSpec).toBeNull();
    expect(blockedAssembly.violations).toContain("promotion preflight blocked this assembly");

    const blockedGate = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult(),
      baseCommitGate: baseCommitGate({
        mayUseBaseCommit: false,
        violations: ["repoRoot working tree and index must be clean before BatchSpec generation"],
        dirtyFiles: ["references/tasks/execution-assembly-core.json"],
        baseCommit: undefined,
      }),
    });
    expect(blockedGate.mayAssembleExecutionBatch).toBe(false);
    expect(blockedGate.batchSpec).toBeNull();
    expect(blockedGate.violations).toContain(
      "repoRoot working tree and index must be clean before BatchSpec generation",
    );
    expect(blockedGate.nextAction).toBe("rework assembly/baseCommit evidence before execution BatchSpec assembly");
  });

  test("turns dependency hints into deterministic dependencies and integration requirements", () => {
    const plans = [
      taskSpecPlan({ taskId: "assembly-core", taskSpecPath: "references/tasks/assembly-core.json" }),
      taskSpecPlan({
        taskId: "assembly-tests",
        taskSpecPath: "references/tasks/assembly-tests.json",
        verifyCommands: ["bun test tests/batch-plan-execution-batch-assembly.test.ts"],
      }),
      taskSpecPlan({
        taskId: "assembly-typecheck",
        taskSpecPath: "references/tasks/assembly-typecheck.json",
        verifyCommands: ["bun run typecheck"],
      }),
    ];

    const result = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult(
        {
          batchSkeleton: {
            batchId: "execution-batch-assembly",
            status: "planned",
            requiresBaseCommit: true,
            taskIds: plans.map((plan) => plan.taskId),
            dependencyHints: [
              { before: "assembly-core", after: "assembly-tests", reason: "Core output must exist first." },
              { before: "assembly-tests", after: "assembly-typecheck", reason: "Tests define the expected type shape." },
            ],
            parallelizationHints: [],
          },
        },
        plans,
      ),
      baseCommitGate: baseCommitGate({}, plans),
    });

    expect(result.batchSpec?.dependencies).toEqual([
      { before: "assembly-core", after: "assembly-tests" },
      { before: "assembly-tests", after: "assembly-typecheck" },
    ]);
    expect(result.batchSpec?.integrationQueue).toEqual([
      {
        order: 1,
        taskId: "assembly-core",
        requiresAccepted: [],
        focusedVerifyCommands: ["bun test tests/batch-plan-execution-batch-assembly.test.ts"],
        status: "pending",
      },
      {
        order: 2,
        taskId: "assembly-tests",
        requiresAccepted: ["assembly-core"],
        focusedVerifyCommands: ["bun test tests/batch-plan-execution-batch-assembly.test.ts"],
        status: "pending",
      },
      {
        order: 3,
        taskId: "assembly-typecheck",
        requiresAccepted: ["assembly-tests"],
        focusedVerifyCommands: ["bun run typecheck"],
        status: "pending",
      },
    ]);
  });

  test("classifies serial-only target files and forces single-task dispatch groups", () => {
    const plans = [
      taskSpecPlan({ taskId: "parallel-a", taskSpecPath: "references/tasks/parallel-a.json" }),
      taskSpecPlan({ taskId: "parallel-b", taskSpecPath: "references/tasks/parallel-b.json" }),
      taskSpecPlan({
        taskId: "policy-task",
        taskSpecPath: "references/tasks/policy-task.json",
        targetFiles: ["src/core/policy.ts"],
      }),
    ];

    const result = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult(
        {
          batchSkeleton: {
            batchId: "execution-batch-assembly",
            status: "planned",
            requiresBaseCommit: true,
            taskIds: plans.map((plan) => plan.taskId),
            dependencyHints: [],
            parallelizationHints: [{ taskIds: ["parallel-a", "parallel-b"], rationale: "Disjoint focused files." }],
          },
        },
        plans,
      ),
      baseCommitGate: baseCommitGate({}, plans),
    });

    expect(result.mayAssembleExecutionBatch).toBe(true);
    expect(result.batchSpec?.tasks).toEqual([
      expect.objectContaining({ taskId: "parallel-a", dispatchGroup: "parallel-hint-1" }),
      expect.objectContaining({ taskId: "parallel-b", dispatchGroup: "parallel-hint-1" }),
      expect.objectContaining({
        taskId: "policy-task",
        writeSetClassification: "serial_only",
        classificationReasons: ["policy: policy changes control dispatch authority"],
        dispatchGroup: "single-policy-task",
      }),
    ]);
  });

  test("rejects invalid parallelization hints for unknown, duplicate, or serial-only tasks", () => {
    const plans = [
      taskSpecPlan({ taskId: "parallel-task", taskSpecPath: "references/tasks/parallel-task.json" }),
      taskSpecPlan({
        taskId: "serial-task",
        taskSpecPath: "references/tasks/serial-task.json",
        targetFiles: ["AGENTS.md"],
      }),
    ];

    const result = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult(
        {
          batchSkeleton: {
            batchId: "execution-batch-assembly",
            status: "planned",
            requiresBaseCommit: true,
            taskIds: plans.map((plan) => plan.taskId),
            dependencyHints: [],
            parallelizationHints: [
              { taskIds: ["parallel-task", "missing-task", "serial-task"], rationale: "Invalid hint." },
              { taskIds: ["parallel-task"], rationale: "Duplicate hint." },
            ],
          },
        },
        plans,
      ),
      baseCommitGate: baseCommitGate({}, plans),
    });

    expect(result.mayAssembleExecutionBatch).toBe(false);
    expect(result.batchSpec).toBeNull();
    expect(result.violations).toContain("parallelizationHints[].taskIds must reference known tasks: missing-task");
    expect(result.violations).toContain("parallelizationHints[].taskIds must not include serial_only tasks: serial-task");
    expect(result.violations).toContain(
      "parallelizationHints[].taskIds must not duplicate task ids across hint groups: parallel-task",
    );
  });

  test("omits pre-dispatch run, candidate, and expected candidate evidence", () => {
    const result = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult(),
      baseCommitGate: baseCommitGate(),
    });

    expect(result.batchSpec?.tasks.some((task) => "runLogPath" in task || "candidateCommit" in task)).toBe(false);
    expect(
      result.batchSpec?.integrationQueue.some((item) => "expectedCandidateCommit" in item),
    ).toBe(false);
  });

  test("rejects invalid dependency hints before emitting a BatchSpec", () => {
    const plans = [
      taskSpecPlan({ taskId: "task-a", taskSpecPath: "references/tasks/task-a.json" }),
      taskSpecPlan({ taskId: "task-b", taskSpecPath: "references/tasks/task-b.json" }),
    ];

    const result = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult(
        {
          batchSkeleton: {
            batchId: "execution-batch-assembly",
            status: "planned",
            requiresBaseCommit: true,
            taskIds: plans.map((plan) => plan.taskId),
            dependencyHints: [
              { before: "task-a", after: "missing-task", reason: "Unknown dependent." },
              { before: "task-b", after: "task-b", reason: "Self dependency." },
              { before: "task-a", after: "task-b", reason: "A before B." },
              { before: "task-b", after: "task-a", reason: "Cycle." },
            ],
            parallelizationHints: [],
          },
        },
        plans,
      ),
      baseCommitGate: baseCommitGate({}, plans),
    });

    expect(result.mayAssembleExecutionBatch).toBe(false);
    expect(result.batchSpec).toBeNull();
    expect(result.violations).toContain("dependencyHints[].after must reference an execution task: missing-task");
    expect(result.violations).toContain("dependencyHints must not point a task at itself: task-b");
    expect(result.violations).toContain("dependencyHints must be acyclic before execution BatchSpec assembly");

    const cycleResult = dryRunExecutionBatchSpecAssembly({
      assemblyResult: assemblyResult(
        {
          batchSkeleton: {
            batchId: "execution-batch-assembly",
            status: "planned",
            requiresBaseCommit: true,
            taskIds: plans.map((plan) => plan.taskId),
            dependencyHints: [
              { before: "task-a", after: "task-b", reason: "A before B." },
              { before: "task-b", after: "task-a", reason: "B before A." },
            ],
            parallelizationHints: [],
          },
        },
        plans,
      ),
      baseCommitGate: baseCommitGate({}, plans),
    });

    expect(cycleResult.mayAssembleExecutionBatch).toBe(false);
    expect(cycleResult.batchSpec).toBeNull();
    expect(cycleResult.violations).toEqual(["dependencyHints must be acyclic before execution BatchSpec assembly"]);
  });
});
