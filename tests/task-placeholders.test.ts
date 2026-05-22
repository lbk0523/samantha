import { describe, expect, test } from "bun:test";
import type { TaskSpec } from "../src/core/contracts";
import {
  unresolvedDispatchPlaceholders,
  unresolvedTaskPlaceholders,
} from "../src/core/task-placeholders";

const task: TaskSpec = {
  id: "placeholder-fixture",
  title: "Placeholder fixture",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "lifecycle-sensitive",
  targetAgent: "codex-worker",
  targetFiles: ["src/core/<module>.ts", "tests/<module>.test.ts", "src/<area>/index.ts"],
  forbiddenChanges: ["runs/<runId>/**", "worktrees/**"],
  setupCommands: ["test -f <setupFile>"],
  verifyCommands: ["bun test tests/<module>.test.ts", "bun run <script_name>"],
  instructions: "Implement <feature> using --run-log=<path> and leave <module> scoped.",
  expectedCommitSubject: "feat: add <feature> behavior",
  status: "pending",
};

describe("task placeholders", () => {
  test("reports sorted unique placeholders from all task placeholder fields", () => {
    expect(unresolvedTaskPlaceholders(task)).toEqual([
      "area",
      "feature",
      "module",
      "path",
      "runId",
      "script_name",
      "setupFile",
    ]);
  });

  test("dispatch placeholder checks ignore instruction-only CLI metavars", () => {
    expect(
      unresolvedDispatchPlaceholders({
        ...task,
        targetFiles: ["src/core/<dispatch_module>.ts"],
        forbiddenChanges: ["runs/<runId>/**"],
        setupCommands: ["test -f <setupFile>"],
        verifyCommands: ["bun test tests/<dispatch_module>.test.ts"],
        instructions: "Keep CLI examples like --run-log=<path> and --cd=<worktree> in the prompt.",
        expectedCommitSubject: "feat: add <dispatch_feature>",
      }),
    ).toEqual(["dispatch_feature", "dispatch_module", "runId", "setupFile"]);
  });
});
