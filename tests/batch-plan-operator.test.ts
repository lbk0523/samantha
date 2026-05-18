import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { writeBatchPlanDraft } from "../src/core/batch-plan-draft-store";
import { prepareBatchPlan } from "../src/core/batch-plan-operator";
import { git, gitHead, gitTopLevel, gitWorkingTreeFiles } from "../src/core/git";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "batch-plan-operator-core-task",
    title: "Add BatchPlan operator core",
    summary: "Compose existing BatchPlan promotion, TaskSpec, planning commit, execution store, and preflight gates.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetFileHints: ["src/core/batch-plan-operator.ts", "tests/batch-plan-operator.test.ts"],
    forbiddenChangeHints: [
      "src/cli.ts",
      "src/core/batch-execution.ts",
      "src/core/batch-spec.ts",
      "references/batch-specs/**",
      "runs/**",
      "worktrees/**",
    ],
    verifyCommandHints: ["bun test tests/batch-plan-operator.test.ts"],
    independentlyVerifiableRationale:
      "The operator can be verified with fixture repositories and focused artifact assertions.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "batch-plan-operator",
    createdAt: "2026-05-17T00:00:00.000Z",
    sourceGoal: "Add the deterministic BatchPlan operator core.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-assembly.ts",
        "src/core/batch-plan-task-spec-store.ts",
        "src/core/batch-plan-execution-batch-store.ts",
      ],
      currentStateSummary: "BatchPlan primitives exist and need a thin operator composition layer.",
      candidateWriteSurfaces: ["src/core/batch-plan-operator.ts", "tests/batch-plan-operator.test.ts"],
      authorityBoundarySurfaces: ["src/cli.ts", "src/core/batch-execution.ts", "references/batch-specs/**"],
      assumptions: ["The operator only prepares artifacts and never dispatches workers."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["batch-plan-operator-core-task"],
        rationale: "Single operator slice with no writer parallelism authority.",
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
      reasons: ["The draft is ready for routine writer batch preparation."],
    },
    report: {
      summary: "A stored BatchPlanDraft can be prepared into a preflighted execution BatchSpec.",
      nextAction: "Run batches:execute only after the prepared BatchSpec passes preflight.",
    },
    ...overrides,
  };
}

async function makeTempRoot(prefix = "samantha-batch-plan-operator-"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  tmpRoots.push(root);
  return root;
}

async function initRepo(root: string): Promise<void> {
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  await git(["add", ".fixture"], root);
  await git(["commit", "-m", "chore: initial operator fixture"], root);
}

async function writeStoredDraft(repoRoot: string, storedDraft: BatchPlanDraft): Promise<string> {
  const draftsDir = join(repoRoot, "references", "batch-plans");
  await writeBatchPlanDraft({ draftsDir, draft: storedDraft });
  return draftsDir;
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

describe("BatchPlan operator core", () => {
  test("prepares a stored draft into a preflight-passing out-of-tree execution BatchSpec", async () => {
    const repoRoot = await makeTempRoot();
    const executionRoot = await makeTempRoot("samantha-batch-plan-operator-execution-");
    await initRepo(repoRoot);
    const storedDraft = draft({ draftId: "operator-happy-draft" });
    const draftsDir = await writeStoredDraft(repoRoot, storedDraft);
    const executionBatchesDir = join(executionRoot, "execution-batches");

    const result = await prepareBatchPlan({
      draftId: "operator-happy-draft",
      draftsDir,
      repoRoot,
      batchId: "operator-happy-batch",
      executionBatchesDir,
    });

    expect(result.pass).toBe(true);
    expect(result.prepared).toBe(true);
    expect(result.pushPerformed).toBe(false);
    expect(result.violations).toEqual([]);
    expect(result.draftPath).toBe(join(draftsDir, "operator-happy-draft.json"));
    expect(result.sourceGoal).toBe("Add the deterministic BatchPlan operator core.");
    expect(result.repoInspectionSummary).toBe(
      "BatchPlan primitives exist and need a thin operator composition layer.",
    );
    expect(result.proposedTaskCount).toBe(1);
    expect(result.prepareOutcome).toBe("passed");
    expect(result.preflightOutcome).toBe("passed");
    expect(result.batchId).toBe("operator-happy-batch");
    expect(result.taskSpecWrites.map((record) => record.path)).toEqual([
      "references/tasks/batch-plan-operator-core-task.json",
    ]);
    expect(result.planningCommit?.pass).toBe(true);
    expect(result.baseCommitGate?.mayUseBaseCommit).toBe(true);
    expect(result.executionBatchSpecRecord).toMatchObject({
      batchId: "operator-happy-batch",
      storeLocation: "outside_target_repo",
    });
    expect(result.batchPreflight?.mayDispatch).toBe(true);
    expect(result.nextAction).toContain("batches:execute");
    expect(result.nextAction).toContain("--batch-id=operator-happy-batch");
    await expect(pathExists(join(repoRoot, "references", "batch-specs"))).resolves.toBe(false);
    await expect(readFile(join(executionBatchesDir, "operator-happy-batch.json"), "utf8")).resolves.toContain(
      '"batchId": "operator-happy-batch"',
    );
    await expect(gitWorkingTreeFiles(repoRoot)).resolves.toEqual([]);
  });

  test("blocks a non-routine draft without TaskSpec or execution BatchSpec writes", async () => {
    const repoRoot = await makeTempRoot();
    const executionRoot = await makeTempRoot("samantha-batch-plan-operator-execution-");
    const draftsDir = await writeStoredDraft(
      repoRoot,
      draft({
        draftId: "operator-architecture-draft",
        classification: "architecture",
        proposedTasks: [],
        parallelizationHints: [],
        promotionReadiness: {
          status: "blocked",
          reasons: ["Architecture work must remain in CEO planning before writer dispatch."],
        },
      }),
    );
    const executionBatchesDir = join(executionRoot, "execution-batches");

    const result = await prepareBatchPlan({
      draftId: "operator-architecture-draft",
      draftsDir,
      repoRoot,
      executionBatchesDir,
    });

    expect(result.pass).toBe(false);
    expect(result.prepared).toBe(false);
    expect(result.sourceGoal).toBe("Add the deterministic BatchPlan operator core.");
    expect(result.repoInspectionSummary).toBe(
      "BatchPlan primitives exist and need a thin operator composition layer.",
    );
    expect(result.proposedTaskCount).toBe(0);
    expect(result.prepareOutcome).toBe("blocked");
    expect(result.preflightOutcome).toBe("not_run");
    expect(result.taskSpecWrites).toEqual([]);
    expect(result.planningCommit).toBeNull();
    expect(result.executionBatchSpecRecord).toBeNull();
    expect(result.nextAction).toBe("route to architecture path before routine writer dispatch");
    expect(result.violations).toEqual([
      "classification must be routine_writer_batch to promote",
      "promotionReadiness.status must be ready to promote",
    ]);
    await expect(pathExists(join(repoRoot, "references", "tasks"))).resolves.toBe(false);
    await expect(pathExists(executionBatchesDir)).resolves.toBe(false);
  });

  test("stops on duplicate TaskSpec overwrite without planning commit or execution BatchSpec writes", async () => {
    const repoRoot = await makeTempRoot();
    const executionRoot = await makeTempRoot("samantha-batch-plan-operator-execution-");
    await initRepo(repoRoot);
    const draftsDir = await writeStoredDraft(repoRoot, draft({ draftId: "operator-duplicate-task" }));
    const existingTaskPath = join(repoRoot, "references", "tasks", "batch-plan-operator-core-task.json");
    await mkdir(dirname(existingTaskPath), { recursive: true });
    await writeFile(existingTaskPath, "existing\n", "utf8");

    const result = await prepareBatchPlan({
      draftId: "operator-duplicate-task",
      draftsDir,
      repoRoot,
      executionBatchesDir: join(executionRoot, "execution-batches"),
    });

    expect(result.pass).toBe(false);
    expect(result.sourceGoal).toBe("Add the deterministic BatchPlan operator core.");
    expect(result.repoInspectionSummary).toBe(
      "BatchPlan primitives exist and need a thin operator composition layer.",
    );
    expect(result.proposedTaskCount).toBe(1);
    expect(result.prepareOutcome).toBe("blocked");
    expect(result.preflightOutcome).toBe("not_run");
    expect(result.taskSpecWrites).toEqual([]);
    expect(result.planningCommit).toBeNull();
    expect(result.executionBatchSpecRecord).toBeNull();
    expect(result.violations).toEqual([
      "TaskSpec already exists: references/tasks/batch-plan-operator-core-task.json",
    ]);
    await expect(readFile(existingTaskPath, "utf8")).resolves.toBe("existing\n");
    await expect(pathExists(join(executionRoot, "execution-batches"))).resolves.toBe(false);
  });

  test("stops when unrelated dirty files block the planning artifact commit", async () => {
    const repoRoot = await makeTempRoot();
    const executionRoot = await makeTempRoot("samantha-batch-plan-operator-execution-");
    await initRepo(repoRoot);
    const head = await gitHead(repoRoot);
    const draftsDir = await writeStoredDraft(repoRoot, draft({ draftId: "operator-dirty-repo" }));
    await writeFile(join(repoRoot, "notes.txt"), "unrelated\n", "utf8");

    const result = await prepareBatchPlan({
      draftId: "operator-dirty-repo",
      draftsDir,
      repoRoot,
      executionBatchesDir: join(executionRoot, "execution-batches"),
    });

    expect(result.pass).toBe(false);
    expect(result.taskSpecWrites).toHaveLength(1);
    expect(result.prepareOutcome).toBe("blocked");
    expect(result.preflightOutcome).toBe("not_run");
    expect(result.planningCommit?.pass).toBe(false);
    expect(result.planningCommit?.violations).toContain(
      "repoRoot has dirty files outside requested planning artifacts: notes.txt",
    );
    expect(result.baseCommitGate).toBeNull();
    expect(result.executionBatchSpecRecord).toBeNull();
    expect(result.violations).toContain("repoRoot has dirty files outside requested planning artifacts: notes.txt");
    await expect(gitHead(repoRoot)).resolves.toBe(head);
    await expect(pathExists(join(executionRoot, "execution-batches"))).resolves.toBe(false);
  });

  test("stops when execution BatchSpec storage is inside an unignored target repo directory", async () => {
    const repoRoot = await makeTempRoot();
    await initRepo(repoRoot);
    const canonicalRepoRoot = await gitTopLevel(repoRoot);
    const draftsDir = await writeStoredDraft(repoRoot, draft({ draftId: "operator-bad-store" }));

    const result = await prepareBatchPlan({
      draftId: "operator-bad-store",
      draftsDir,
      repoRoot,
      executionBatchesDir: join(canonicalRepoRoot, "state", "execution-batches"),
    });

    expect(result.pass).toBe(false);
    expect(result.planningCommit?.pass).toBe(true);
    expect(result.baseCommitGate?.mayUseBaseCommit).toBe(true);
    expect(result.prepareOutcome).toBe("blocked");
    expect(result.preflightOutcome).toBe("not_run");
    expect(result.executionBatchSpecRecord).toBeNull();
    expect(result.violations[0]).toContain("Execution BatchSpec store must be outside repoRoot or git-ignored");
    expect(result.nextAction).toBe("rework execution BatchSpec storage before stored BatchSpec preflight");
  });
});
