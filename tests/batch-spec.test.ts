import { describe, expect, test } from "bun:test";
import type { BatchSpec } from "../src/core/batch-spec";
import { validateMinimalBatchSpec } from "../src/core/batch-spec";

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
    declaredForbiddenChanges: ["src/core/policy.ts"],
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

function batchSpec(overrides: Partial<BatchSpec> = {}): BatchSpec {
  return {
    schemaVersion: 1,
    batchId: "phase-5-minimal",
    repoRoot: "/repo",
    baseCommit: "0123456789abcdef0123456789abcdef01234567",
    status: "planned",
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
    ...overrides,
  };
}

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
