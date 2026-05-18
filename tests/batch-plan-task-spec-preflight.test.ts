import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { writeBatchPlanDraft } from "../src/core/batch-plan-draft-store";
import {
  dryRunBatchPlanAssembly,
  type BatchPlanAssemblyDryRunResult,
  type TaskSpecPlan,
} from "../src/core/batch-plan-assembly";
import {
  preflightStoredBatchPlanTaskSpecWrites,
  preflightTaskSpecWrites,
} from "../src/core/batch-plan-task-spec-preflight";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "task-spec-write-preflight-task",
    title: "Add TaskSpec write preflight",
    summary: "Create a deterministic preflight for inert TaskSpec write candidates.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "routine",
    targetFileHints: [
      "src/core/batch-plan-task-spec-preflight.ts",
      "tests/batch-plan-task-spec-preflight.test.ts",
    ],
    forbiddenChangeHints: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
    verifyCommandHints: ["bun test tests/batch-plan-task-spec-preflight.test.ts tests/batch-plan-assembly.test.ts"],
    independentlyVerifiableRationale:
      "The preflight result is pure metadata and can be checked with focused unit tests.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "task-spec-write-preflight",
    createdAt: "2026-05-16T00:00:00.000Z",
    sourceGoal: "Implement deterministic TaskSpec write preflight for BatchPlan assembly dry-run output.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-assembly.ts",
        "src/core/contracts.ts",
        "tests/batch-plan-assembly.test.ts",
      ],
      currentStateSummary: "BatchPlan assembly dry-run already emits inert task plans and a planned skeleton.",
      candidateWriteSurfaces: [
        "src/core/batch-plan-task-spec-preflight.ts",
        "tests/batch-plan-task-spec-preflight.test.ts",
      ],
      authorityBoundarySurfaces: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
      assumptions: ["TaskSpec write preflight reports candidates only and does not write artifacts."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["task-spec-write-preflight-task"],
        rationale: "Single pure preflight slice with no artifact creation authority.",
      },
    ],
    structuredPlaceholders: [],
    autonomyEnvelope: {
      localCommitAllowed: true,
      pushAllowed: false,
      maxReworkCycles: 1,
    },
    promotionReadiness: {
      status: "ready",
      reasons: ["No blocking placeholders remain for this TaskSpec write preflight slice."],
    },
    report: {
      summary: "BatchPlan assembly output can be checked before TaskSpec artifact creation.",
      nextAction: "Create TaskSpec artifacts only through a later explicit write path.",
    },
    ...overrides,
  };
}

function taskSpecPlan(overrides: Partial<TaskSpecPlan> = {}): TaskSpecPlan {
  return {
    taskId: "task-spec-write-preflight-task",
    taskSpecPath: "references/tasks/task-spec-write-preflight-task.json",
    title: "Add TaskSpec write preflight",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "routine",
    targetAgent: "codex-worker",
    targetFiles: ["src/core/batch-plan-task-spec-preflight.ts"],
    forbiddenChanges: ["src/cli.ts", "references/**"],
    verifyCommands: ["bun test tests/batch-plan-task-spec-preflight.test.ts"],
    expectedCommitSubject: "feat: add taskspec write preflight",
    status: "pending",
    ...overrides,
  };
}

function assemblyResult(overrides: Partial<BatchPlanAssemblyDryRunResult> = {}): BatchPlanAssemblyDryRunResult {
  const taskPlan = taskSpecPlan();
  return {
    mayAssemble: true,
    violations: [],
    draftId: "task-spec-write-preflight",
    taskSpecPlans: [taskPlan],
    batchSkeleton: {
      batchId: "task-spec-write-preflight",
      status: "planned",
      requiresBaseCommit: true,
      taskIds: [taskPlan.taskId],
      dependencyHints: [],
      parallelizationHints: [],
    },
    nextAction: "review assembly dry-run output before artifact creation",
    ...overrides,
  };
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-task-spec-write-preflight-"));
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

describe("BatchPlan TaskSpec write preflight", () => {
  test("turns an assembleable dry-run into inert TaskSpec candidates", () => {
    expect(preflightTaskSpecWrites(dryRunBatchPlanAssembly(draft()))).toEqual({
      mayWrite: true,
      violations: [],
      draftId: "task-spec-write-preflight",
      taskSpecWritePlans: [
        {
          path: "references/tasks/task-spec-write-preflight-task.json",
          taskSpec: {
            id: "task-spec-write-preflight-task",
            title: "Add TaskSpec write preflight",
            taskFamily: "core-module",
            workMode: "tdd-first",
            riskClass: "routine",
            targetAgent: "codex-worker",
            targetFiles: [
              "src/core/batch-plan-task-spec-preflight.ts",
              "tests/batch-plan-task-spec-preflight.test.ts",
            ],
            forbiddenChanges: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
            verifyCommands: ["bun test tests/batch-plan-task-spec-preflight.test.ts tests/batch-plan-assembly.test.ts"],
            instructions: [
              "This TaskSpec candidate came from BatchPlanDraft assembly dry-run for draft task-spec-write-preflight.",
              "It is inert preflight data, not an artifact write.",
              "Existing Samantha harness gates remain authoritative before execution, commit, report, or lifecycle mutation.",
            ].join("\n"),
            expectedCommitSubject: "feat: add taskspec write preflight",
            status: "pending",
          },
        },
      ],
      nextAction: "TaskSpec candidates are ready for explicit artifact creation",
    });
  });

  test("preserves stored draft path through the stored helper", async () => {
    const root = await makeTempRoot();
    const draftsDir = join(root, "references", "batch-plans");
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "stored-task-spec-write-preflight" }) });

    await expect(
      preflightStoredBatchPlanTaskSpecWrites({
        draftsDir,
        draftId: "stored-task-spec-write-preflight",
      }),
    ).resolves.toMatchObject({
      mayWrite: true,
      violations: [],
      draftId: "stored-task-spec-write-preflight",
      draftPath: join(draftsDir, "stored-task-spec-write-preflight.json"),
      taskSpecWritePlans: [
        {
          path: "references/tasks/task-spec-write-preflight-task.json",
        },
      ],
    });
  });

  test("does not allow writes for a non-assembleable dry-run", () => {
    const nonAssembleable = dryRunBatchPlanAssembly(
      draft({
        classification: "report_only",
        proposedTasks: [],
        parallelizationHints: [],
        promotionReadiness: {
          status: "blocked",
          reasons: ["Report-only planning cannot produce writer TaskSpec artifacts."],
        },
      }),
    );

    expect(preflightTaskSpecWrites(nonAssembleable)).toEqual({
      mayWrite: false,
      violations: [
        "classification must be routine_writer_batch to promote",
        "promotionReadiness.status must be ready to promote",
      ],
      draftId: "task-spec-write-preflight",
      taskSpecWritePlans: [],
      nextAction: "resolve assembly dry-run violations before TaskSpec write preflight",
    });
  });

  test("rejects duplicate task ids and duplicate task paths", () => {
    const result = preflightTaskSpecWrites(
      assemblyResult({
        taskSpecPlans: [
          taskSpecPlan({ taskId: "duplicate-task", taskSpecPath: "references/tasks/duplicate.json" }),
          taskSpecPlan({ taskId: "duplicate-task", taskSpecPath: "references/tasks/duplicate.json" }),
        ],
        batchSkeleton: {
          batchId: "task-spec-write-preflight",
          status: "planned",
          requiresBaseCommit: true,
          taskIds: ["duplicate-task", "duplicate-task"],
          dependencyHints: [],
          parallelizationHints: [],
        },
      }),
    );

    expect(result.mayWrite).toBe(false);
    expect(result.taskSpecWritePlans).toEqual([]);
    expect(result.violations).toContain("taskSpecPlans[].taskId must be unique: duplicate-task");
    expect(result.violations).toContain("taskSpecPlans[].taskSpecPath must be unique: references/tasks/duplicate.json");
  });

  test("rejects absolute and parent-relative task paths", () => {
    const result = preflightTaskSpecWrites(
      assemblyResult({
        taskSpecPlans: [
          taskSpecPlan({ taskId: "absolute-path", taskSpecPath: "/tmp/absolute-path.json" }),
          taskSpecPlan({ taskId: "parent-path", taskSpecPath: "../references/tasks/parent-path.json" }),
        ],
        batchSkeleton: {
          batchId: "task-spec-write-preflight",
          status: "planned",
          requiresBaseCommit: true,
          taskIds: ["absolute-path", "parent-path"],
          dependencyHints: [],
          parallelizationHints: [],
        },
      }),
    );

    expect(result.mayWrite).toBe(false);
    expect(result.taskSpecWritePlans).toEqual([]);
    expect(result.violations).toContain(
      "taskSpecPlans[].taskSpecPath must be a repo-relative .json path without absolute or .. segments: /tmp/absolute-path.json",
    );
    expect(result.violations).toContain(
      "taskSpecPlans[].taskSpecPath must be a repo-relative .json path without absolute or .. segments: ../references/tasks/parent-path.json",
    );
  });

  test("rejects missing target, forbidden, and verify fields", () => {
    const result = preflightTaskSpecWrites(
      assemblyResult({
        taskSpecPlans: [
          taskSpecPlan({
            targetFiles: [],
            forbiddenChanges: [],
            verifyCommands: [],
          }),
        ],
      }),
    );

    expect(result.mayWrite).toBe(false);
    expect(result.taskSpecWritePlans).toEqual([]);
    expect(result.violations).toContain(
      "taskSpecPlans[].targetFiles must be a non-empty string array: task-spec-write-preflight-task",
    );
    expect(result.violations).toContain(
      "taskSpecPlans[].forbiddenChanges must be a non-empty string array: task-spec-write-preflight-task",
    );
    expect(result.violations).toContain(
      "taskSpecPlans[].verifyCommands must be a non-empty string array: task-spec-write-preflight-task",
    );
  });

  test("rejects executable BatchSpec-like skeleton fields", () => {
    const result = preflightTaskSpecWrites(
      assemblyResult({
        batchSkeleton: {
          batchId: "task-spec-write-preflight",
          status: "planned",
          requiresBaseCommit: true,
          taskIds: ["task-spec-write-preflight-task"],
          dependencyHints: [],
          parallelizationHints: [],
          baseCommit: "abc123",
          repoRoot: "/repo",
          dispatchGroup: "group-1",
          integrationQueue: [],
          serialOnlyRules: [],
          lifecyclePolicy: {},
          verification: {},
        } as unknown as BatchPlanAssemblyDryRunResult["batchSkeleton"],
      }),
    );

    expect(result.mayWrite).toBe(false);
    expect(result.taskSpecWritePlans).toEqual([]);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "batchSkeleton.baseCommit must be absent before TaskSpec write preflight",
        "batchSkeleton.repoRoot must be absent before TaskSpec write preflight",
        "batchSkeleton.dispatchGroup must be absent before TaskSpec write preflight",
        "batchSkeleton.integrationQueue must be absent before TaskSpec write preflight",
        "batchSkeleton.serialOnlyRules must be absent before TaskSpec write preflight",
        "batchSkeleton.lifecyclePolicy must be absent before TaskSpec write preflight",
        "batchSkeleton.verification must be absent before TaskSpec write preflight",
      ]),
    );
  });

  test("does not create TaskSpec or BatchSpec artifact directories during stored preflight", async () => {
    const root = await makeTempRoot();
    const draftsDir = join(root, "references", "batch-plans");
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "no-artifact-writes-draft" }) });

    await preflightStoredBatchPlanTaskSpecWrites({
      draftsDir,
      draftId: "no-artifact-writes-draft",
    });

    await expect(pathExists(join(root, "references", "tasks"))).resolves.toBe(false);
    await expect(pathExists(join(root, "references", "batch-specs"))).resolves.toBe(false);
  });
});
