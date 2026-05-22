import { describe, expect, test } from "bun:test";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { actionableCommitForExecution } from "../src/core/run-commit";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

const task: TaskSpec = {
  id: "commit-fixture",
  title: "Commit fixture",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "lifecycle-sensitive",
  targetAgent: "codex-worker",
  targetFiles: ["allowed.txt"],
  forbiddenChanges: ["state/**"],
  verifyCommands: ["test -f allowed.txt"],
  instructions: "Fixture.",
  status: "pending",
};

const agent: AgentProfile = {
  id: "codex-worker",
  role: "writer",
  model: "gpt-5.5",
  writerClass: "writer",
  worktreePolicy: "per-task",
  mergePolicy: "samantha-controlled",
  skillPolicy: {
    requiredBundles: [],
    blockedSkills: [],
  },
};

function execution(overrides: Partial<WorkerDispatchExecution> = {}): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: task.id,
      agentId: agent.id,
      worktreePath: "/repo/worktrees/commit-fixture",
      codex: { prompt: "prompt", command: ["codex", "exec"] },
    },
    setupResults: [],
    command: { command: ["codex", "exec"], exitCode: 0, stdout: "", stderr: "" },
    evaluation: {
      pass: true,
      harness: { status: "pass", note: "ok", commit: "b".repeat(40) },
      changedFiles: ["allowed.txt"],
      scopeViolations: [],
      verifyResults: [],
    },
    commit: {
      subject: "feat: worker change",
      files: ["allowed.txt"],
      add: { command: ["git", "add", "--", "allowed.txt"], exitCode: 0, stdout: "", stderr: "" },
      commit: { command: ["git", "commit", "-m", "feat: worker change"], exitCode: 0, stdout: "", stderr: "" },
      commitHash: "a".repeat(40),
    },
    pass: true,
    ...overrides,
  };
}

describe("actionableCommitForExecution", () => {
  test("uses the Samantha-owned commit for writer runs", () => {
    expect(
      actionableCommitForExecution({
        task,
        agent,
        execution: execution(),
      }),
    ).toBe("a".repeat(40));
  });

  test("does not trust worker-provided HARNESS_RESULT commits for writer runs", () => {
    expect(
      actionableCommitForExecution({
        task,
        agent,
        execution: execution({ commit: undefined }),
      }),
    ).toBe("");
  });

  test("does not trust worker-provided HARNESS_RESULT commits for report-only runs", () => {
    expect(
      actionableCommitForExecution({
        task: {
          ...task,
          taskFamily: "report-review",
          workMode: "diagnosis-first",
          riskClass: "routine",
          targetAgent: "codex-reviewer",
          targetFiles: [],
          forbiddenChanges: ["**/*"],
          verifyCommands: [],
          resultMode: "report",
        },
        agent: {
          ...agent,
          id: "codex-reviewer",
          role: "reviewer",
          writerClass: "non-writer",
          worktreePolicy: "none",
          mergePolicy: "none",
        },
        execution: execution({ commit: undefined }),
      }),
    ).toBe("");
  });
});
