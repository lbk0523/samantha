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
});
