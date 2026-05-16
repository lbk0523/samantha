import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { dryRunBatchPlanAssembly, dryRunStoredBatchPlanAssembly } from "../src/core/batch-plan-assembly";
import { writeBatchPlanDraft } from "../src/core/batch-plan-draft-store";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "assembly-dry-run-task",
    title: "Add BatchPlanDraft assembly dry-run",
    summary: "Create a deterministic dry-run planner for BatchPlanDraft assembly.",
    targetFileHints: ["src/core/batch-plan-assembly.ts", "tests/batch-plan-assembly.test.ts"],
    forbiddenChangeHints: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
    verifyCommandHints: ["bun test tests/batch-plan-assembly.test.ts tests/batch-plan-promotion.test.ts"],
    independentlyVerifiableRationale:
      "The dry-run output is pure metadata and can be checked with focused unit tests.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "batch-plan-assembly-dry-run",
    createdAt: "2026-05-16T00:00:00.000Z",
    sourceGoal: "Implement a deterministic BatchPlanDraft assembly dry-run.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-draft.ts",
        "src/core/batch-plan-draft-store.ts",
        "src/core/batch-plan-promotion.ts",
      ],
      currentStateSummary: "BatchPlanDraft validation, storage, and promotion preflight exist.",
      candidateWriteSurfaces: ["src/core/batch-plan-assembly.ts", "tests/batch-plan-assembly.test.ts"],
      authorityBoundarySurfaces: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
      assumptions: ["Assembly dry-run reports inert plans only and does not write artifacts."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["assembly-dry-run-task"],
        rationale: "Single pure planner slice with no artifact creation authority.",
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
      reasons: ["No blocking placeholders remain for this assembly dry-run slice."],
    },
    report: {
      summary: "BatchPlanDraft assembly can be previewed before artifact creation.",
      nextAction: "Use an explicit later assembly path to create TaskSpec and BatchSpec artifacts.",
    },
    ...overrides,
  };
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-batch-plan-assembly-"));
  tmpRoots.push(root);
  return root;
}

async function makeDraftsDir(): Promise<string> {
  return join(await makeTempRoot(), "references", "batch-plans");
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

describe("BatchPlanDraft assembly dry-run", () => {
  test("assembles a promotable direct draft into task plans and a batch skeleton", () => {
    expect(dryRunBatchPlanAssembly(draft())).toEqual({
      mayAssemble: true,
      violations: [],
      draftId: "batch-plan-assembly-dry-run",
      taskSpecPlans: [
        {
          taskId: "assembly-dry-run-task",
          taskSpecPath: "references/tasks/assembly-dry-run-task.json",
          title: "Add BatchPlanDraft assembly dry-run",
          targetAgent: "codex-worker",
          targetFiles: ["src/core/batch-plan-assembly.ts", "tests/batch-plan-assembly.test.ts"],
          forbiddenChanges: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
          verifyCommands: ["bun test tests/batch-plan-assembly.test.ts tests/batch-plan-promotion.test.ts"],
          expectedCommitSubject: "feat: add batchplandraft assembly dry run",
          status: "pending",
        },
      ],
      batchSkeleton: {
        batchId: "batch-plan-assembly-dry-run",
        status: "planned",
        requiresBaseCommit: true,
        taskIds: ["assembly-dry-run-task"],
        dependencyHints: [],
        parallelizationHints: [
          {
            taskIds: ["assembly-dry-run-task"],
            rationale: "Single pure planner slice with no artifact creation authority.",
          },
        ],
      },
      nextAction: "review assembly dry-run output before artifact creation",
    });
  });

  test("includes draftPath for a stored promotable draft", async () => {
    const root = await makeTempRoot();
    const draftsDir = join(root, "references", "batch-plans");
    const taskSpecDir = join(root, "planned-tasks");
    const storedDraft = draft({ draftId: "stored-assembly-dry-run" });
    await writeBatchPlanDraft({ draftsDir, draft: storedDraft });

    await expect(
      dryRunStoredBatchPlanAssembly({
        draftsDir,
        draftId: "stored-assembly-dry-run",
        taskSpecDir,
        batchId: "custom-assembly-batch",
      }),
    ).resolves.toMatchObject({
      mayAssemble: true,
      violations: [],
      draftId: "stored-assembly-dry-run",
      draftPath: join(draftsDir, "stored-assembly-dry-run.json"),
      taskSpecPlans: [
        {
          taskId: "assembly-dry-run-task",
          taskSpecPath: join(taskSpecDir, "assembly-dry-run-task.json"),
        },
      ],
      batchSkeleton: {
        batchId: "custom-assembly-batch",
        status: "planned",
      },
    });
  });

  test("does not assemble a non-routine draft", () => {
    const reportOnlyDraft = draft({
      classification: "report_only",
      proposedTasks: [],
      parallelizationHints: [],
      promotionReadiness: {
        status: "blocked",
        reasons: ["Report-only planning cannot promote to routine writer assembly."],
      },
    });

    expect(dryRunBatchPlanAssembly(reportOnlyDraft)).toEqual({
      mayAssemble: false,
      violations: [
        "classification must be routine_writer_batch to promote",
        "promotionReadiness.status must be ready to promote",
      ],
      draftId: "batch-plan-assembly-dry-run",
      taskSpecPlans: [],
      batchSkeleton: null,
      nextAction: "route to report path before routine writer dispatch",
    });
  });

  test("does not assemble a draft with blocking placeholders", () => {
    const placeholderDraft = draft({
      proposedTasks: [
        proposedTask({
          targetFileHints: [],
          verifyCommandHints: [],
        }),
      ],
      structuredPlaceholders: [
        {
          field: "proposedTasks[0].targetFileHints",
          reason: "CEO must resolve the intended write scope before assembly.",
          resolutionOwner: "ceo",
          blocksPromotion: true,
        },
        {
          field: "proposedTasks[0].verifyCommandHints",
          reason: "Deterministic assembly must resolve the exact verification commands.",
          resolutionOwner: "deterministic_assembly",
          blocksPromotion: true,
        },
      ],
      promotionReadiness: {
        status: "needs_placeholders_resolved",
        reasons: ["Target and verify hints are blocked by structured placeholders."],
      },
    });

    expect(dryRunBatchPlanAssembly(placeholderDraft)).toEqual({
      mayAssemble: false,
      violations: [
        "promotionReadiness.status must be ready to promote",
        "structuredPlaceholders must not contain blocking placeholders to promote",
      ],
      draftId: "batch-plan-assembly-dry-run",
      taskSpecPlans: [],
      batchSkeleton: null,
      nextAction: "resolve structured placeholders before promotion",
    });
  });

  test("does not assemble a draft targeting authority-boundary files", () => {
    const authorityDraft = draft({
      proposedTasks: [
        proposedTask({
          targetFileHints: ["src/core/policy.ts"],
        }),
      ],
    });

    expect(dryRunBatchPlanAssembly(authorityDraft)).toEqual({
      mayAssemble: false,
      violations: [
        "proposedTasks[].targetFileHints must not include authority-boundary surfaces to promote: assembly-dry-run-task has src/core/policy.ts",
      ],
      draftId: "batch-plan-assembly-dry-run",
      taskSpecPlans: [],
      batchSkeleton: null,
      nextAction: "rework the BatchPlanDraft before promotion",
    });
  });

  test("preserves dependency and parallelization hints without dispatch group authority", () => {
    const dependencyHints = [
      {
        before: "assembly-core",
        after: "assembly-tests",
        reason: "Core plan output should be stable before focused assembly tests assert it.",
      },
    ];
    const parallelizationHints = [
      {
        taskIds: ["assembly-core", "assembly-tests"],
        rationale: "The hints remain advisory until a later explicit dispatch design consumes them.",
      },
    ];

    const result = dryRunBatchPlanAssembly(
      draft({
        proposedTasks: [
          proposedTask({
            id: "assembly-core",
            title: "Add assembly core",
            targetFileHints: ["src/core/batch-plan-assembly.ts"],
          }),
          proposedTask({
            id: "assembly-tests",
            title: "Add assembly tests",
            targetFileHints: ["tests/batch-plan-assembly.test.ts"],
          }),
        ],
        dependencyHints,
        parallelizationHints,
      }),
    );

    expect(result.batchSkeleton).toEqual({
      batchId: "batch-plan-assembly-dry-run",
      status: "planned",
      requiresBaseCommit: true,
      taskIds: ["assembly-core", "assembly-tests"],
      dependencyHints,
      parallelizationHints,
    });
    expect(result.batchSkeleton === null ? false : "dispatchGroup" in result.batchSkeleton).toBe(false);
    expect(result.batchSkeleton === null ? false : "dispatchGroups" in result.batchSkeleton).toBe(false);
  });

  test("does not create TaskSpec or BatchSpec artifact directories during stored dry-run", async () => {
    const root = await makeTempRoot();
    const draftsDir = join(root, "references", "batch-plans");
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "no-artifact-writes-draft" }) });

    await dryRunStoredBatchPlanAssembly({ draftsDir, draftId: "no-artifact-writes-draft" });

    await expect(pathExists(join(root, "references", "tasks"))).resolves.toBe(false);
    await expect(pathExists(join(root, "references", "batch-specs"))).resolves.toBe(false);
  });

  test("surfaces stored draft validation errors from the store", async () => {
    const draftsDir = await makeDraftsDir();
    const invalidDraft = draft({
      draftId: "invalid-stored-assembly-draft",
      sourceGoal: "",
    });
    const invalidPath = join(draftsDir, "invalid-stored-assembly-draft.json");
    await mkdir(draftsDir, { recursive: true });
    await writeFile(invalidPath, `${JSON.stringify(invalidDraft, null, 2)}\n`);

    await expect(
      dryRunStoredBatchPlanAssembly({ draftsDir, draftId: "invalid-stored-assembly-draft" }),
    ).rejects.toThrow(`invalid stored BatchPlanDraft at ${invalidPath}: sourceGoal must be a non-empty string`);
  });
});
