import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchSpec } from "../src/core/batch-spec";
import { DEFAULT_SERIAL_ONLY_RULES, preflightBatchSpec, validateMinimalBatchSpec } from "../src/core/batch-spec";
import { markBatchSpecRejected } from "../src/core/batch-spec-mutation";
import { listBatchSpecs, readBatchSpecById } from "../src/core/batch-spec-store";
import type { TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";

let tmpRoots: string[] = [];

function task(
  taskId: string,
  expectedVerifyCommands: string[] = [`bun test ${taskId}`],
  overrides: Partial<BatchSpec["tasks"][number]> = {},
): BatchSpec["tasks"][number] {
  return {
    taskId,
    taskSpecPath: `references/tasks/${taskId}.json`,
    targetAgent: "codex-worker",
    declaredTargetFiles: [`tests/${taskId}.test.ts`],
    declaredForbiddenChanges: ["runs/**"],
    expectedVerifyCommands,
    writeSetClassification: "parallel_eligible",
    classificationReasons: [],
    dispatchGroup: "group-1",
    status: "planned",
    ...overrides,
  };
}

function queueItem(
  order: number,
  taskId: string,
  requiresAccepted: string[] = [],
  focusedVerifyCommands: string[] = [`bun test ${taskId}`],
  overrides: Partial<BatchSpec["integrationQueue"][number]> = {},
): BatchSpec["integrationQueue"][number] {
  return { order, taskId, requiresAccepted, focusedVerifyCommands, status: "pending", ...overrides };
}

function verification(overrides: Partial<BatchSpec["verification"]> = {}): BatchSpec["verification"] {
  return {
    preflightChecks: [
      "validate batch identity and baseCommit",
      "validate task references against TaskSpec",
      "validate dependency DAG",
      "validate disjoint write sets",
      "validate serial-only classifications",
      "validate integration queue",
    ],
    afterEachAcceptedMerge: ["run focused verify commands for the accepted queue item"],
    afterFinalAcceptedMerge: ["bun run typecheck", "bun test"],
    ...overrides,
  };
}

function lifecyclePolicy(overrides: Partial<BatchSpec["lifecyclePolicy"]> = {}): BatchSpec["lifecyclePolicy"] {
  return {
    staleBase: "block_and_replan",
    rebase: "explicit_samantha_owned_rebase_only",
    partialFailure: "block_dependents_allow_independent_candidates",
    cleanup: "explicit_per_worker_lifecycle_after_resolution",
    ...overrides,
  };
}

function batchSpec(overrides: Partial<BatchSpec> = {}): BatchSpec {
  return {
    schemaVersion: 1,
    batchId: "phase-5-minimal",
    repoRoot: "/repo",
    baseCommit: "0123456789abcdef0123456789abcdef01234567",
    status: "planned",
    serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES,
    tasks: [
      task("task-a"),
      task("task-b"),
      task("task-c"),
    ],
    dependencies: [
      { before: "task-a", after: "task-b" },
      { before: "task-b", after: "task-c" },
    ],
    integrationQueue: [
      queueItem(1, "task-a"),
      queueItem(2, "task-b", ["task-a"]),
      queueItem(3, "task-c", ["task-b"]),
    ],
    verification: verification(),
    lifecyclePolicy: lifecyclePolicy(),
    ...overrides,
  };
}

function taskSpecFor(batchTask: BatchSpec["tasks"][number], overrides: Partial<TaskSpec> = {}): TaskSpec {
  return {
    id: batchTask.taskId,
    title: `Task ${batchTask.taskId}`,
    targetAgent: batchTask.targetAgent,
    targetFiles: batchTask.declaredTargetFiles,
    forbiddenChanges: batchTask.declaredForbiddenChanges,
    verifyCommands: batchTask.expectedVerifyCommands,
    instructions: "Make the requested focused change.",
    status: "pending",
    ...overrides,
  };
}

async function makeRepoFixture(tasks: BatchSpec["tasks"]): Promise<{ root: string; baseCommit: string }> {
  const root = await mkdtemp(join(tmpdir(), "samantha-batch-preflight-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await mkdir(join(root, "references", "tasks"), { recursive: true });
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  for (const batchTask of tasks) {
    await writeFile(
      join(root, batchTask.taskSpecPath),
      `${JSON.stringify(taskSpecFor(batchTask), null, 2)}\n`,
      "utf8",
    );
  }
  await git(["add", "."], root);
  await git(["commit", "-m", "chore: initial batch fixture"], root);
  return { root, baseCommit: await gitHead(root) };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("minimal BatchSpec validation", () => {
  test("accepts the Phase 5 minimal identity and dependency shape", () => {
    expect(validateMinimalBatchSpec(batchSpec())).toEqual([]);
  });

  test("requires schemaVersion 1", () => {
    expect(validateMinimalBatchSpec(batchSpec({ schemaVersion: 2 as 1 }))).toContain(
      "schemaVersion must be exactly 1",
    );
  });

  test("requires the minimal batchId format", () => {
    expect(validateMinimalBatchSpec(batchSpec({ batchId: "Phase 5" }))).toContain(
      "batchId must match ^[a-z0-9][a-z0-9-]{2,79}$",
    );
  });

  test("requires a 40-character hex baseCommit", () => {
    expect(validateMinimalBatchSpec(batchSpec({ baseCommit: "abc123" }))).toContain(
      "baseCommit must be a 40-character hex commit hash",
    );
  });

  test("requires a valid batch status", () => {
    expect(validateMinimalBatchSpec(batchSpec({ status: "paused" as BatchSpec["status"] }))).toContain(
      "status must be a valid BatchStatus: paused",
    );
  });

  test("requires verification policy phases to be non-empty string arrays", () => {
    const violations = validateMinimalBatchSpec(
      batchSpec({
        verification: verification({
          preflightChecks: [],
          afterEachAcceptedMerge: ["  "],
          afterFinalAcceptedMerge: ["bun run typecheck", 7 as unknown as string],
        }),
      }),
    );

    expect(violations).toContain("verification.preflightChecks must be a non-empty string array");
    expect(violations).toContain("verification.afterEachAcceptedMerge must be a non-empty string array");
    expect(violations).toContain("verification.afterFinalAcceptedMerge must be a non-empty string array");
  });

  test("requires the Phase 5 lifecycle policy literals", () => {
    const violations = validateMinimalBatchSpec(
      batchSpec({
        lifecyclePolicy: lifecyclePolicy({
          staleBase: "auto_rebase" as BatchSpec["lifecyclePolicy"]["staleBase"],
          rebase: "worker_rebase_allowed" as BatchSpec["lifecyclePolicy"]["rebase"],
          partialFailure: "reject_all_candidates" as BatchSpec["lifecyclePolicy"]["partialFailure"],
          cleanup: "auto_cleanup_after_failure" as BatchSpec["lifecyclePolicy"]["cleanup"],
        }),
      }),
    );

    expect(violations).toContain("lifecyclePolicy.staleBase must be block_and_replan");
    expect(violations).toContain("lifecyclePolicy.rebase must be explicit_samantha_owned_rebase_only");
    expect(violations).toContain(
      "lifecyclePolicy.partialFailure must be block_dependents_allow_independent_candidates",
    );
    expect(violations).toContain(
      "lifecyclePolicy.cleanup must be explicit_per_worker_lifecycle_after_resolution",
    );
  });

  test("requires unique task ids", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          tasks: [
            task("task-a"),
            task("task-a", ["bun test duplicate-task-a"]),
          ],
          dependencies: [],
        }),
      ),
    ).toContain("tasks[].taskId must be unique: task-a");
  });

  test("requires valid task statuses", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          tasks: [
            task("task-a"),
            task("task-b", ["bun test task-b"], { status: "paused" as BatchSpec["tasks"][number]["status"] }),
            task("task-c"),
          ],
        }),
      ),
    ).toContain("tasks[].status must be a valid BatchTaskStatus: task-b has paused");
  });

  test("requires task planning reference fields", () => {
    const violations = validateMinimalBatchSpec(
      batchSpec({
        tasks: [
          task("task-a"),
          task("task-b", [], {
            taskSpecPath: "",
            targetAgent: "",
            declaredTargetFiles: [],
            declaredForbiddenChanges: [],
            dispatchGroup: "",
          }),
          task("task-c"),
        ],
      }),
    );

    expect(violations).toContain("tasks[].taskSpecPath must be a non-empty string: task-b");
    expect(violations).toContain("tasks[].targetAgent must be a non-empty string: task-b");
    expect(violations).toContain("tasks[].declaredTargetFiles must be a non-empty string array: task-b");
    expect(violations).toContain("tasks[].declaredForbiddenChanges must be a non-empty string array: task-b");
    expect(violations).toContain("tasks[].expectedVerifyCommands must be a non-empty string array: task-b");
    expect(violations).toContain("tasks[].dispatchGroup must be a non-empty string: task-b");
  });

  test("requires valid write-set classification planning fields", () => {
    const violations = validateMinimalBatchSpec(
      batchSpec({
        tasks: [
          task("task-a"),
          task("task-b", ["bun test task-b"], {
            writeSetClassification: "shared" as BatchSpec["tasks"][number]["writeSetClassification"],
          }),
          task("task-c", ["bun test task-c"], {
            writeSetClassification: "serial_only",
            classificationReasons: [],
          }),
        ],
      }),
    );

    expect(violations).toContain(
      "tasks[].writeSetClassification must be parallel_eligible or serial_only: task-b",
    );
    expect(violations).toContain("tasks[].classificationReasons must be non-empty for serial_only: task-c");
  });

  test("requires pre-dispatch evidence fields to be absent", () => {
    const violations = validateMinimalBatchSpec(
      batchSpec({
        status: "preflight_passed",
        tasks: [
          task("task-a", ["bun test task-a"], { runLogPath: "runs/task-a.log" }),
          task("task-b", ["bun test task-b"], { candidateCommit: "0123456789abcdef0123456789abcdef01234567" }),
          task("task-c"),
        ],
        integrationQueue: [
          queueItem(1, "task-a"),
          queueItem(2, "task-b", ["task-a"]),
          queueItem(3, "task-c", ["task-b"], ["bun test task-c"], {
            expectedCandidateCommit: "0123456789abcdef0123456789abcdef01234567",
          }),
        ],
      }),
    );

    expect(violations).toContain("tasks[].runLogPath must be absent before dispatch: task-a");
    expect(violations).toContain("tasks[].candidateCommit must be absent before dispatch: task-b");
    expect(violations).toContain(
      "integrationQueue[].expectedCandidateCommit must be absent before dispatch: task-c",
    );
  });

  test("requires dependency endpoints to reference existing task ids", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          dependencies: [{ before: "task-a", after: "missing-task" }],
        }),
      ),
    ).toContain("dependencies[].after must reference an existing taskId: missing-task");

    expect(
      validateMinimalBatchSpec(
        batchSpec({
          dependencies: [{ before: "missing-task", after: "task-a" }],
        }),
      ),
    ).toContain("dependencies[].before must reference an existing taskId: missing-task");
  });

  test("rejects self-dependencies", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          dependencies: [{ before: "task-a", after: "task-a" }],
        }),
      ),
    ).toContain("dependencies must not point a task at itself: task-a");
  });

  test("rejects cyclic dependencies", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          dependencies: [
            { before: "task-a", after: "task-b" },
            { before: "task-b", after: "task-c" },
            { before: "task-c", after: "task-a" },
          ],
        }),
      ),
    ).toContain("dependencies must be acyclic");
  });

  test("requires integrationQueue to order dependencies before dependents", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          dependencies: [{ before: "task-a", after: "task-b" }],
          integrationQueue: [
            queueItem(1, "task-b", ["task-a"]),
            queueItem(2, "task-a"),
            queueItem(3, "task-c"),
          ],
        }),
      ),
    ).toContain("integrationQueue must order dependencies before dependents: task-a before task-b");
  });

  test("requires integrationQueue to include every task exactly once", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            queueItem(1, "task-a"),
            queueItem(2, "task-b", ["task-a"]),
          ],
        }),
      ),
    ).toContain("integrationQueue must include every task exactly once: missing task-c");

    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            queueItem(1, "task-a"),
            queueItem(2, "task-b", ["task-a"]),
            queueItem(3, "task-b", ["task-a"]),
          ],
        }),
      ),
    ).toContain("integrationQueue must include every task exactly once: duplicate task-b");
  });

  test("requires integrationQueue task ids to reference existing tasks", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            queueItem(1, "task-a"),
            queueItem(2, "task-b", ["task-a"]),
            queueItem(3, "missing-task", [], []),
          ],
        }),
      ),
    ).toContain("integrationQueue[].taskId must reference an existing taskId: missing-task");
  });

  test("requires valid integrationQueue statuses", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            queueItem(1, "task-a"),
            queueItem(2, "task-b", ["task-a"], ["bun test task-b"], {
              status: "merged" as BatchSpec["integrationQueue"][number]["status"],
            }),
            queueItem(3, "task-c", ["task-b"]),
          ],
        }),
      ),
    ).toContain("integrationQueue[].status must be pending, accepted, skipped, or failed: task-b");
  });

  test("requires integrationQueue order values to start at 1 and be contiguous", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            queueItem(0, "task-a"),
            queueItem(1, "task-b", ["task-a"]),
            queueItem(2, "task-c", ["task-b"]),
          ],
        }),
      ),
    ).toContain("integrationQueue[].order must start at 1 and be contiguous");

    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            queueItem(1, "task-a"),
            queueItem(3, "task-b", ["task-a"]),
            queueItem(3, "task-c", ["task-b"]),
          ],
        }),
      ),
    ).toContain("integrationQueue[].order must start at 1 and be contiguous");
  });

  test("requires integrationQueue requiresAccepted to include direct dependencies", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          dependencies: [{ before: "task-a", after: "task-c" }],
          integrationQueue: [
            queueItem(1, "task-a"),
            queueItem(2, "task-b"),
            queueItem(3, "task-c"),
          ],
        }),
      ),
    ).toContain("integrationQueue[].requiresAccepted must include direct dependency: task-c requires task-a");
  });

  test("requires integrationQueue requiresAccepted to be structurally consistent with tasks", () => {
    const violations = validateMinimalBatchSpec(
      batchSpec({
        dependencies: [],
        integrationQueue: [
          queueItem(1, "task-a"),
          queueItem(2, "task-b", ["missing-task", "task-b", "task-c"]),
          queueItem(3, "task-c"),
        ],
      }),
    );

    expect(violations).toContain(
      "integrationQueue[].requiresAccepted must reference an existing taskId: task-b requires missing-task",
    );
    expect(violations).toContain("integrationQueue[].requiresAccepted must not include itself: task-b");
    expect(violations).toContain(
      "integrationQueue[].requiresAccepted must reference an earlier queue item: task-b requires task-b",
    );
    expect(violations).toContain(
      "integrationQueue[].requiresAccepted must reference an earlier queue item: task-b requires task-c",
    );
  });

  test("requires integrationQueue focusedVerifyCommands to include expected verify commands", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            queueItem(1, "task-a"),
            queueItem(2, "task-b", ["task-a"]),
            queueItem(3, "task-c", ["task-b"], []),
          ],
        }),
      ),
    ).toContain(
      "integrationQueue[].focusedVerifyCommands must include expected verify command: task-c requires bun test task-c",
    );
  });
});

describe("BatchSpec lifecycle mutation", () => {
  test("marks a source BatchSpec rejected through Samantha-owned API and records before/after audit", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-batch-mutation-"));
    tmpRoots.push(root);
    const batchPath = join(root, "references", "batch-specs", "phase-5-minimal.json");
    const stateDir = join(root, "runs");
    await mkdir(join(root, "references", "batch-specs"), { recursive: true });
    await writeFile(batchPath, `${JSON.stringify(batchSpec({ repoRoot: root }), null, 2)}\n`, "utf8");

    const result = await markBatchSpecRejected({
      batchPath,
      authority: "samantha_api",
      reason: "stale base closure requires a replacement BatchSpec",
      stateDir,
      createdAt: "2026-05-14T00:00:00.000Z",
    });

    const mutated = JSON.parse(await readFile(batchPath, "utf8")) as BatchSpec;
    expect(mutated.status).toBe("rejected");
    expect(mutated.tasks.map((task) => [task.taskId, task.status])).toEqual([
      ["task-a", "planned"],
      ["task-b", "planned"],
      ["task-c", "planned"],
    ]);
    expect(mutated.integrationQueue.map((item) => [item.taskId, item.status])).toEqual([
      ["task-a", "pending"],
      ["task-b", "pending"],
      ["task-c", "pending"],
    ]);
    expect(validateMinimalBatchSpec(mutated)).toEqual([]);
    expect(result.evidence).toMatchObject({
      schemaVersion: 1,
      batchId: "phase-5-minimal",
      operation: "mark_rejected",
      authority: "samantha_api",
      sourceBatchSpecMutation: "performed",
      reason: "stale base closure requires a replacement BatchSpec",
      before: { status: "planned" },
      after: { status: "rejected" },
      createdAt: "2026-05-14T00:00:00.000Z",
    });
    const audit = JSON.parse(await readFile(join(stateDir, "batch-lifecycle-audit.jsonl"), "utf8"));
    expect(audit).toEqual(result.evidence);
  });

  test("rejects worker-owned lifecycle mutation attempts", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-batch-mutation-"));
    tmpRoots.push(root);
    const batchPath = join(root, "phase-5-minimal.json");
    await writeFile(batchPath, `${JSON.stringify(batchSpec({ repoRoot: root }), null, 2)}\n`, "utf8");

    await expect(
      markBatchSpecRejected({
        batchPath,
        authority: "worker_harness_result",
        reason: "worker asked to close the batch",
      }),
    ).rejects.toThrow("BatchSpec lifecycle mutation must be Samantha-owned: worker_harness_result");

    const unchanged = JSON.parse(await readFile(batchPath, "utf8")) as BatchSpec;
    expect(unchanged.status).toBe("planned");
  });
});

describe("BatchSpec artifact store", () => {
  test("lists BatchSpec summaries in stable batchId order and ignores non-json files", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-batch-store-"));
    tmpRoots.push(root);
    const batchesDir = join(root, "references", "batch-specs");
    await mkdir(batchesDir, { recursive: true });
    await writeFile(join(batchesDir, "notes.md"), "# Direction only\n", "utf8");
    await writeFile(
      join(batchesDir, "z-batch.json"),
      `${JSON.stringify(batchSpec({ batchId: "z-batch", tasks: [task("task-a")] }), null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(batchesDir, "a-batch.json"),
      `${JSON.stringify(batchSpec({ batchId: "a-batch", tasks: [task("task-a"), task("task-b")] }), null, 2)}\n`,
      "utf8",
    );

    await expect(listBatchSpecs({ batchesDir })).resolves.toEqual([
      {
        batchId: "a-batch",
        path: join(batchesDir, "a-batch.json"),
        status: "planned",
        baseCommit: "0123456789abcdef0123456789abcdef01234567",
        taskCount: 2,
      },
      {
        batchId: "z-batch",
        path: join(batchesDir, "z-batch.json"),
        status: "planned",
        baseCommit: "0123456789abcdef0123456789abcdef01234567",
        taskCount: 1,
      },
    ]);
  });

  test("reads BatchSpec JSON by batchId", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-batch-store-"));
    tmpRoots.push(root);
    const batchesDir = join(root, "references", "batch-specs");
    const spec = batchSpec({ batchId: "show-me" });
    await mkdir(batchesDir, { recursive: true });
    await writeFile(join(batchesDir, "show-me.json"), `${JSON.stringify(spec, null, 2)}\n`, "utf8");

    await expect(readBatchSpecById({ batchesDir, batchId: "show-me" })).resolves.toEqual(spec);
    await expect(readBatchSpecById({ batchesDir, batchId: "missing-batch" })).rejects.toThrow(
      "batch not found: missing-batch",
    );
  });

  test("fails deterministically when the store has duplicate batchIds", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-batch-store-"));
    tmpRoots.push(root);
    const batchesDir = join(root, "references", "batch-specs");
    await mkdir(batchesDir, { recursive: true });
    await writeFile(
      join(batchesDir, "one.json"),
      `${JSON.stringify(batchSpec({ batchId: "duplicate-batch" }), null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(batchesDir, "two.json"),
      `${JSON.stringify(batchSpec({ batchId: "duplicate-batch" }), null, 2)}\n`,
      "utf8",
    );

    await expect(listBatchSpecs({ batchesDir })).rejects.toThrow(
      `duplicate batchId in BatchSpec store: duplicate-batch: ${join(batchesDir, "one.json")}, ${join(
        batchesDir,
        "two.json",
      )}`,
    );
  });
});

describe("BatchSpec preflight validation", () => {
  test("parses referenced TaskSpec files and accepts normalized disjoint writer tasks", async () => {
    const tasks = [
      task("task-a", ["bun test task-a"], {
        declaredTargetFiles: ["./src/core/task-a.ts"],
        declaredForbiddenChanges: ["runs/**"],
      }),
      task("task-b", ["bun test task-b"], {
        declaredTargetFiles: ["tests/task-b.test.ts"],
        declaredForbiddenChanges: ["worktrees/**"],
      }),
    ];
    const { root, baseCommit } = await makeRepoFixture(tasks);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a"), queueItem(2, "task-b")],
      }),
    );

    expect(result.violations).toEqual([]);
    expect(result.mayDispatch).toBe(true);
    expect(result.tasks.find((item) => item.taskId === "task-a")?.normalizedTargetFiles).toEqual([
      "src/core/task-a.ts",
    ]);
    expect(result.writeSetProofs).toContainEqual({
      dispatchGroup: "group-1",
      taskIds: ["task-a", "task-b"],
      normalizedTargetFilesByTaskId: {
        "task-a": ["src/core/task-a.ts"],
        "task-b": ["tests/task-b.test.ts"],
      },
    });
  });

  test("requires batch declarations to match referenced TaskSpec files", async () => {
    const tasks = [task("task-a")];
    const { root, baseCommit } = await makeRepoFixture(tasks);
    await writeFile(
      join(root, tasks[0].taskSpecPath),
      `${JSON.stringify(
        taskSpecFor(tasks[0], {
          targetFiles: ["src/different.ts"],
          verifyCommands: ["bun test different"],
        }),
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a")],
      }),
    );

    expect(result.violations).toContain(
      "tasks[].declaredTargetFiles must match referenced TaskSpec targetFiles: task-a",
    );
    expect(result.violations).toContain(
      "tasks[].expectedVerifyCommands must match referenced TaskSpec verifyCommands: task-a",
    );
    expect(result.mayDispatch).toBe(false);
  });

  test("rejects absolute and parent-relative repo paths before dispatch", async () => {
    const tasks = [
      task("task-a", ["bun test task-a"], {
        taskSpecPath: "/tmp/task-a.json",
        declaredTargetFiles: ["../outside.ts"],
      }),
    ];
    const { root, baseCommit } = await makeRepoFixture([]);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a")],
      }),
    );

    expect(result.violations).toContain(
      "tasks[].taskSpecPath for task-a must be a repo-relative path without .. segments: /tmp/task-a.json",
    );
    expect(result.violations).toContain(
      "tasks[].declaredTargetFiles for task-a must be a repo-relative path without .. segments: ../outside.ts",
    );
    expect(result.mayDispatch).toBe(false);
  });

  test("rejects stale BatchSpec baseCommit when repoRoot HEAD has advanced", async () => {
    const tasks = [task("task-a")];
    const { root, baseCommit } = await makeRepoFixture(tasks);
    await writeFile(join(root, "advanced.txt"), "advanced\n", "utf8");
    await git(["add", "advanced.txt"], root);
    await git(["commit", "-m", "chore: advance head"], root);
    const head = await gitHead(root);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a")],
      }),
    );

    expect(result.violations).toContain(
      `repoRoot HEAD must match baseCommit before dispatch: HEAD ${head} != baseCommit ${baseCommit}`,
    );
    expect(result.mayDispatch).toBe(false);
  });

  test("rejects a baseCommit that cannot resolve inside repoRoot", async () => {
    const tasks = [task("task-a")];
    const { root } = await makeRepoFixture(tasks);
    const missingCommit = "f".repeat(40);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit: missingCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a")],
      }),
    );

    expect(result.violations).toContain(
      `baseCommit must resolve to a git commit in repoRoot: ${missingCommit}`,
    );
    expect(result.mayDispatch).toBe(false);
  });

  test("rejects a non-git repoRoot as a deterministic preflight violation", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-batch-non-git-"));
    tmpRoots.push(root);
    const tasks = [task("task-a")];
    await mkdir(join(root, "references", "tasks"), { recursive: true });
    await writeFile(
      join(root, tasks[0].taskSpecPath),
      `${JSON.stringify(taskSpecFor(tasks[0]), null, 2)}\n`,
      "utf8",
    );

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit: "a".repeat(40),
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a")],
      }),
    );

    expect(result.violations).toContain("repoRoot must be a git repository with a resolvable HEAD");
    expect(result.mayDispatch).toBe(false);
  });

  test("rejects overlapping write sets in the same dispatch group", async () => {
    const tasks = [
      task("task-a", ["bun test task-a"], { declaredTargetFiles: ["src/core"] }),
      task("task-b", ["bun test task-b"], { declaredTargetFiles: ["src/core/policy.ts"] }),
    ];
    const { root, baseCommit } = await makeRepoFixture(tasks);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a"), queueItem(2, "task-b")],
      }),
    );

    expect(result.violations).toContain(
      "dispatchGroup targetFiles must be disjoint: task-a src/core overlaps task-b src/core/policy.ts",
    );
  });

  test("rejects write sets that match another task's forbidden changes in the same dispatch group", async () => {
    const tasks = [
      task("task-a", ["bun test task-a"], {
        declaredTargetFiles: ["src/core/task-a.ts"],
        declaredForbiddenChanges: ["tests/**"],
      }),
      task("task-b", ["bun test task-b"], {
        declaredTargetFiles: ["tests/task-b.test.ts"],
      }),
    ];
    const { root, baseCommit } = await makeRepoFixture(tasks);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a"), queueItem(2, "task-b")],
      }),
    );

    expect(result.violations).toContain(
      "dispatchGroup targetFiles must not match another task's forbiddenChanges: task-b tests/task-b.test.ts matches task-a tests/**",
    );
  });

  test("enforces serialOnlyRules and single-member serial dispatch groups", async () => {
    const tasks = [
      task("task-a", ["bun test task-a"], {
        declaredTargetFiles: ["src/core/policy.ts"],
        writeSetClassification: "parallel_eligible",
      }),
      task("task-b", ["bun test task-b"], {
        declaredTargetFiles: ["tests/task-b.test.ts"],
      }),
      task("task-c", ["bun test task-c"], {
        declaredTargetFiles: ["references/task-templates/new-template.json"],
        writeSetClassification: "serial_only",
        classificationReasons: ["task template changes define future worker authority"],
        dispatchGroup: "group-2",
      }),
    ];
    const { root, baseCommit } = await makeRepoFixture(tasks);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a"), queueItem(2, "task-b"), queueItem(3, "task-c")],
      }),
    );

    expect(result.violations).toContain(
      "tasks[].writeSetClassification must be serial_only when target matches serialOnlyRules: task-a",
    );
    expect(result.violations).toContain(
      "parallel_eligible task targetFiles must not match serialOnlyRules: task-a",
    );
    expect(result.violations).not.toContain("serial_only task must be the only member of its dispatchGroup: task-c");
    expect(result.tasks.find((item) => item.taskId === "task-c")?.serialOnlyMatches.map((rule) => rule.id)).toEqual([
      "task-templates",
    ]);
  });

  test("rejects serial-only tasks that share a dispatch group", async () => {
    const tasks = [
      task("task-a", ["bun test task-a"], {
        declaredTargetFiles: ["references/task-templates/new-template.json"],
        writeSetClassification: "serial_only",
        classificationReasons: ["task template changes define future worker authority"],
      }),
      task("task-b", ["bun test task-b"], {
        declaredTargetFiles: ["tests/task-b.test.ts"],
      }),
    ];
    const { root, baseCommit } = await makeRepoFixture(tasks);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a"), queueItem(2, "task-b")],
      }),
    );

    expect(result.violations).toContain("serial_only task must be the only member of its dispatchGroup: task-a");
  });

  test("rejects wildcard target files for parallel-eligible disjoint proof", async () => {
    const tasks = [
      task("task-a", ["bun test task-a"], {
        declaredTargetFiles: ["src/core/*.ts"],
      }),
    ];
    const { root, baseCommit } = await makeRepoFixture(tasks);

    const result = await preflightBatchSpec(
      batchSpec({
        repoRoot: root,
        baseCommit,
        tasks,
        dependencies: [],
        integrationQueue: [queueItem(1, "task-a")],
      }),
    );

    expect(result.violations).toContain(
      "parallel_eligible task targetFiles must be literal paths for disjoint preflight: task-a",
    );
  });
});
