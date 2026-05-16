import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ExecutionBatchSpecAssemblyDryRunResult } from "../src/core/batch-plan-execution-batch-assembly";
import {
  listExecutionBatchSpecs,
  readExecutionBatchSpecById,
  readExecutionBatchSpecRecordById,
  writeExecutionBatchSpec,
} from "../src/core/batch-plan-execution-batch-store";
import { type BatchSpec, DEFAULT_SERIAL_ONLY_RULES } from "../src/core/batch-spec";
import { git } from "../src/core/git";

let tmpRoots: string[] = [];

const BASE_COMMIT = "0123456789abcdef0123456789abcdef01234567";

function task(taskId = "execution-batch-store-task"): BatchSpec["tasks"][number] {
  return {
    taskId,
    taskSpecPath: `references/tasks/${taskId}.json`,
    targetAgent: "codex-worker",
    declaredTargetFiles: ["src/core/batch-plan-execution-batch-store.ts"],
    declaredForbiddenChanges: ["src/cli.ts", "references/**", "runs/**"],
    expectedVerifyCommands: ["bun test tests/batch-plan-execution-batch-store.test.ts"],
    writeSetClassification: "parallel_eligible",
    classificationReasons: [],
    dispatchGroup: `single-${taskId}`,
    status: "planned",
  };
}

function batchSpec(overrides: Partial<BatchSpec> = {}): BatchSpec {
  const batchTask = task();
  return {
    schemaVersion: 1,
    batchId: "execution-batch-store",
    repoRoot: "/repo",
    baseCommit: BASE_COMMIT,
    status: "planned",
    serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES,
    tasks: [batchTask],
    dependencies: [],
    integrationQueue: [
      {
        order: 1,
        taskId: batchTask.taskId,
        requiresAccepted: [],
        focusedVerifyCommands: batchTask.expectedVerifyCommands,
        status: "pending",
      },
    ],
    verification: {
      preflightChecks: ["validate minimal BatchSpec shape"],
      afterEachAcceptedMerge: ["run focused verify commands for each accepted integration queue item"],
      afterFinalAcceptedMerge: ["bun test tests/batch-plan-execution-batch-store.test.ts"],
    },
    lifecyclePolicy: {
      staleBase: "block_and_replan",
      rebase: "explicit_samantha_owned_rebase_only",
      partialFailure: "block_dependents_allow_independent_candidates",
      cleanup: "explicit_per_worker_lifecycle_after_resolution",
    },
    ...overrides,
  };
}

function dryRun(
  spec: BatchSpec | null,
  overrides: Partial<ExecutionBatchSpecAssemblyDryRunResult> = {},
): ExecutionBatchSpecAssemblyDryRunResult {
  return {
    mayAssembleExecutionBatch: spec !== null,
    violations: [],
    draftId: "execution-batch-store",
    repoRoot: spec?.repoRoot,
    baseCommit: spec?.baseCommit,
    batchSpec: spec,
    executionStoreRequirement: {
      location: "outside_target_repo_dirty_tree_or_explicitly_ignored_state",
      reason:
        "execution BatchSpec storage must not dirty the target repo or make baseCommit circular before dispatch",
      mustHappenBefore: "BatchSpec preflight and dispatch",
    },
    nextAction:
      spec === null
        ? "rework assembly/baseCommit evidence before execution BatchSpec assembly"
        : "write the execution BatchSpec to an out-of-tree or ignored execution store before BatchSpec preflight/dispatch",
    ...overrides,
  };
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-execution-batch-store-"));
  tmpRoots.push(root);
  return root;
}

async function initRepo(root: string, gitignore = ""): Promise<void> {
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  if (gitignore.length > 0) {
    await writeFile(join(root, ".gitignore"), gitignore, "utf8");
  }
  await git(["add", "."], root);
  await git(["commit", "-m", "chore: initial execution batch store fixture"], root);
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

describe("execution BatchSpec store", () => {
  test("writes successful dry-run JSON with a trailing newline to an out-of-tree store", async () => {
    const repoRoot = await makeTempRoot();
    const storeRoot = await makeTempRoot();
    const executionBatchesDir = join(storeRoot, "execution-batches");
    const spec = batchSpec({ repoRoot });
    const path = join(executionBatchesDir, "execution-batch-store.json");

    await expect(writeExecutionBatchSpec({ executionBatchesDir, dryRun: dryRun(spec) })).resolves.toEqual({
      batchId: "execution-batch-store",
      path,
      batchSpec: spec,
      storeLocation: "outside_target_repo",
    });
    await expect(readFile(path, "utf8")).resolves.toBe(`${JSON.stringify(spec, null, 2)}\n`);
    await expect(pathExists(join(repoRoot, "references", "batch-specs"))).resolves.toBe(false);
  });

  test("allows git-ignored in-repo state and rejects unignored or references/batch-specs stores", async () => {
    const repoRoot = await makeTempRoot();
    await initRepo(repoRoot, ".samantha-execution-batches/\n");
    const spec = batchSpec({ repoRoot });

    const ignoredRecord = await writeExecutionBatchSpec({
      executionBatchesDir: join(repoRoot, ".samantha-execution-batches"),
      dryRun: dryRun(spec),
    });
    expect(ignoredRecord.storeLocation).toBe("ignored_in_target_repo");
    await expect(readFile(ignoredRecord.path, "utf8")).resolves.toBe(`${JSON.stringify(spec, null, 2)}\n`);

    const unignoredRepoRoot = await makeTempRoot();
    await initRepo(unignoredRepoRoot);
    await expect(
      writeExecutionBatchSpec({
        executionBatchesDir: join(unignoredRepoRoot, "state", "execution-batches"),
        dryRun: dryRun(batchSpec({ repoRoot: unignoredRepoRoot })),
      }),
    ).rejects.toThrow("Execution BatchSpec store must be outside repoRoot or git-ignored");

    await expect(
      writeExecutionBatchSpec({
        executionBatchesDir: join(unignoredRepoRoot, "references", "batch-specs"),
        dryRun: dryRun(batchSpec({ repoRoot: unignoredRepoRoot })),
      }),
    ).rejects.toThrow("Execution BatchSpec store must not use references/batch-specs");
  });

  test("rejects existing files instead of overwriting them", async () => {
    const repoRoot = await makeTempRoot();
    const storeRoot = await makeTempRoot();
    const executionBatchesDir = join(storeRoot, "execution-batches");
    const path = join(executionBatchesDir, "execution-batch-store.json");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "existing\n", "utf8");

    await expect(
      writeExecutionBatchSpec({
        executionBatchesDir,
        dryRun: dryRun(batchSpec({ repoRoot })),
      }),
    ).rejects.toThrow(`Execution BatchSpec already exists: ${path}`);
    await expect(readFile(path, "utf8")).resolves.toBe("existing\n");
  });

  test("rejects blocked dry-runs without writing files and includes violations", async () => {
    const storeRoot = await makeTempRoot();
    const executionBatchesDir = join(storeRoot, "execution-batches");

    await expect(
      writeExecutionBatchSpec({
        executionBatchesDir,
        dryRun: dryRun(null, {
          mayAssembleExecutionBatch: false,
          violations: ["baseCommitGate blocked execution assembly"],
        }),
      }),
    ).rejects.toThrow("baseCommitGate blocked execution assembly");
    await expect(pathExists(executionBatchesDir)).resolves.toBe(false);
  });

  test("rejects invalid BatchSpec candidates through minimal validation without writing files", async () => {
    const repoRoot = await makeTempRoot();
    const storeRoot = await makeTempRoot();
    const executionBatchesDir = join(storeRoot, "execution-batches");

    await expect(
      writeExecutionBatchSpec({
        executionBatchesDir,
        dryRun: dryRun(batchSpec({ repoRoot, baseCommit: "bad" })),
      }),
    ).rejects.toThrow("baseCommit must be a 40-character hex commit hash");
    await expect(pathExists(executionBatchesDir)).resolves.toBe(false);
  });

  test("reads and lists only JSON records in stable batchId order", async () => {
    const repoRoot = await makeTempRoot();
    const storeRoot = await makeTempRoot();
    const executionBatchesDir = join(storeRoot, "execution-batches");
    const aSpec = batchSpec({ batchId: "a-batch", repoRoot });
    const zSpec = batchSpec({ batchId: "z-batch", repoRoot });
    await mkdir(executionBatchesDir, { recursive: true });
    await writeFile(join(executionBatchesDir, "notes.md"), "# ignored\n", "utf8");
    await writeFile(join(executionBatchesDir, "z-batch.json"), `${JSON.stringify(zSpec, null, 2)}\n`, "utf8");
    await writeFile(join(executionBatchesDir, "a-batch.json"), `${JSON.stringify(aSpec, null, 2)}\n`, "utf8");

    const records = await listExecutionBatchSpecs({ executionBatchesDir });
    expect(records.map((record) => ({
      batchId: record.batchId,
      path: record.path,
      storeLocation: record.storeLocation,
    }))).toEqual([
      {
        batchId: "a-batch",
        path: join(executionBatchesDir, "a-batch.json"),
        storeLocation: "outside_target_repo",
      },
      {
        batchId: "z-batch",
        path: join(executionBatchesDir, "z-batch.json"),
        storeLocation: "outside_target_repo",
      },
    ]);
    await expect(readExecutionBatchSpecById({ executionBatchesDir, batchId: "a-batch" })).resolves.toEqual(aSpec);
    await expect(
      readExecutionBatchSpecRecordById({ executionBatchesDir, batchId: "z-batch" }),
    ).resolves.toMatchObject({ batchId: "z-batch", batchSpec: zSpec, storeLocation: "outside_target_repo" });
  });

  test("rejects duplicate batchId records", async () => {
    const repoRoot = await makeTempRoot();
    const storeRoot = await makeTempRoot();
    const executionBatchesDir = join(storeRoot, "execution-batches");
    await mkdir(executionBatchesDir, { recursive: true });
    await writeFile(
      join(executionBatchesDir, "one.json"),
      `${JSON.stringify(batchSpec({ batchId: "duplicate-batch", repoRoot }), null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(executionBatchesDir, "two.json"),
      `${JSON.stringify(batchSpec({ batchId: "duplicate-batch", repoRoot }), null, 2)}\n`,
      "utf8",
    );

    await expect(listExecutionBatchSpecs({ executionBatchesDir })).rejects.toThrow(
      "duplicate batchId in execution BatchSpec store: duplicate-batch",
    );
  });

  test("read rejects invalid JSON or invalid BatchSpec shape", async () => {
    const storeRoot = await makeTempRoot();
    const invalidJsonDir = join(storeRoot, "invalid-json");
    await mkdir(invalidJsonDir, { recursive: true });
    await writeFile(join(invalidJsonDir, "bad.json"), "{\n", "utf8");

    await expect(
      readExecutionBatchSpecRecordById({ executionBatchesDir: invalidJsonDir, batchId: "bad" }),
    ).rejects.toThrow("Execution BatchSpec JSON invalid");

    const repoRoot = await makeTempRoot();
    const invalidShapeDir = join(storeRoot, "invalid-shape");
    await mkdir(invalidShapeDir, { recursive: true });
    await writeFile(
      join(invalidShapeDir, "bad-shape.json"),
      `${JSON.stringify(batchSpec({ repoRoot, baseCommit: "bad" }), null, 2)}\n`,
      "utf8",
    );

    await expect(
      readExecutionBatchSpecRecordById({ executionBatchesDir: invalidShapeDir, batchId: "execution-batch-store" }),
    ).rejects.toThrow("Execution BatchSpec failed minimal validation");
  });
});
