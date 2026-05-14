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
      { taskId: "task-a" },
      { taskId: "task-b" },
      { taskId: "task-c" },
    ],
    dependencies: [
      { before: "task-a", after: "task-b" },
      { before: "task-b", after: "task-c" },
    ],
    integrationQueue: [
      { order: 1, taskId: "task-a" },
      { order: 2, taskId: "task-b" },
      { order: 3, taskId: "task-c" },
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
          tasks: [{ taskId: "task-a" }, { taskId: "task-a" }],
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
            { order: 1, taskId: "task-b" },
            { order: 2, taskId: "task-a" },
            { order: 3, taskId: "task-c" },
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
            { order: 1, taskId: "task-a" },
            { order: 2, taskId: "task-b" },
          ],
        }),
      ),
    ).toContain("integrationQueue must include every task exactly once: missing task-c");

    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            { order: 1, taskId: "task-a" },
            { order: 2, taskId: "task-b" },
            { order: 3, taskId: "task-b" },
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
            { order: 1, taskId: "task-a" },
            { order: 2, taskId: "task-b" },
            { order: 3, taskId: "missing-task" },
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
            { order: 0, taskId: "task-a" },
            { order: 1, taskId: "task-b" },
            { order: 2, taskId: "task-c" },
          ],
        }),
      ),
    ).toContain("integrationQueue[].order must start at 1 and be contiguous");

    expect(
      validateMinimalBatchSpec(
        batchSpec({
          integrationQueue: [
            { order: 1, taskId: "task-a" },
            { order: 3, taskId: "task-b" },
            { order: 3, taskId: "task-c" },
          ],
        }),
      ),
    ).toContain("integrationQueue[].order must start at 1 and be contiguous");
  });
});
