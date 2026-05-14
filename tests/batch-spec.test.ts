import { describe, expect, test } from "bun:test";
import type { BatchSpec } from "../src/core/batch-spec";
import { validateMinimalBatchSpec } from "../src/core/batch-spec";

function batchSpec(overrides: Partial<BatchSpec> = {}): BatchSpec {
  return {
    schemaVersion: 1,
    batchId: "phase-5-minimal",
    repoRoot: "/repo",
    baseCommit: "0123456789abcdef0123456789abcdef01234567",
    status: "planned",
    tasks: [
      { taskId: "task-a", expectedVerifyCommands: ["bun test task-a"] },
      { taskId: "task-b", expectedVerifyCommands: ["bun test task-b"] },
      { taskId: "task-c", expectedVerifyCommands: ["bun test task-c"] },
    ],
    dependencies: [
      { before: "task-a", after: "task-b" },
      { before: "task-b", after: "task-c" },
    ],
    integrationQueue: [
      { order: 1, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
      {
        order: 2,
        taskId: "task-b",
        requiresAccepted: ["task-a"],
        focusedVerifyCommands: ["bun test task-b"],
      },
      {
        order: 3,
        taskId: "task-c",
        requiresAccepted: ["task-b"],
        focusedVerifyCommands: ["bun test task-c"],
      },
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

  test("requires unique task ids", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          tasks: [
            { taskId: "task-a", expectedVerifyCommands: ["bun test task-a"] },
            { taskId: "task-a", expectedVerifyCommands: ["bun test duplicate-task-a"] },
          ],
          dependencies: [],
        }),
      ),
    ).toContain("tasks[].taskId must be unique: task-a");
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
            {
              order: 1,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
            { order: 2, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            { order: 3, taskId: "task-c", requiresAccepted: [], focusedVerifyCommands: ["bun test task-c"] },
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
            { order: 1, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            {
              order: 2,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
          ],
        }),
      ),
    ).toContain("integrationQueue must include every task exactly once: missing task-c");

    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            { order: 1, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            {
              order: 2,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
            {
              order: 3,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
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
            { order: 1, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            {
              order: 2,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
            { order: 3, taskId: "missing-task", requiresAccepted: [], focusedVerifyCommands: [] },
          ],
        }),
      ),
    ).toContain("integrationQueue[].taskId must reference an existing taskId: missing-task");
  });

  test("requires integrationQueue order values to start at 1 and be contiguous", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            { order: 0, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            {
              order: 1,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
            {
              order: 2,
              taskId: "task-c",
              requiresAccepted: ["task-b"],
              focusedVerifyCommands: ["bun test task-c"],
            },
          ],
        }),
      ),
    ).toContain("integrationQueue[].order must start at 1 and be contiguous");

    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            { order: 1, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            {
              order: 3,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
            {
              order: 3,
              taskId: "task-c",
              requiresAccepted: ["task-b"],
              focusedVerifyCommands: ["bun test task-c"],
            },
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
            { order: 1, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            { order: 2, taskId: "task-b", requiresAccepted: [], focusedVerifyCommands: ["bun test task-b"] },
            { order: 3, taskId: "task-c", requiresAccepted: [], focusedVerifyCommands: ["bun test task-c"] },
          ],
        }),
      ),
    ).toContain("integrationQueue[].requiresAccepted must include direct dependency: task-c requires task-a");
  });

  test("requires integrationQueue focusedVerifyCommands to include expected verify commands", () => {
    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            { order: 1, taskId: "task-a", requiresAccepted: [], focusedVerifyCommands: ["bun test task-a"] },
            {
              order: 2,
              taskId: "task-b",
              requiresAccepted: ["task-a"],
              focusedVerifyCommands: ["bun test task-b"],
            },
            { order: 3, taskId: "task-c", requiresAccepted: ["task-b"], focusedVerifyCommands: [] },
          ],
        }),
      ),
    ).toContain(
      "integrationQueue[].focusedVerifyCommands must include expected verify command: task-c requires bun test task-c",
    );
  });
});
