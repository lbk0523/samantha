import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { RunIndex, summarizeWorkerRun } from "../src/core/ledger";
import type { WorkerRunLogInput } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "ledger-fixture",
  title: "Ledger fixture",
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
    blockedSkills: [
      "using-git-worktrees",
      "dispatching-parallel-agents",
      "subagent-driven-development",
    ],
  },
};

function logInput(execution: WorkerDispatchExecution): WorkerRunLogInput & {
  runId: string;
  logPath: string;
} {
  return {
    task,
    agent,
    repoRoot: "/repo",
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    execution,
    runId: "run-1",
    logPath: "/repo/runs/run-1.json",
  };
}

function baseExecution(overrides: Partial<WorkerDispatchExecution> = {}): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: task.id,
      agentId: agent.id,
      worktreePath: "/repo/worktrees/ledger-fixture",
      codex: { prompt: "prompt", command: ["codex", "exec"] },
    },
    setupResults: [],
    command: { command: ["codex", "exec"], exitCode: 0, stdout: "", stderr: "" },
    evaluation: {
      pass: true,
      harness: { status: "pass", note: "ok", commit: "" },
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

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("RunIndex", () => {
  test("appends and finds run summaries", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-ledger-"));
    tmpRoots.push(root);
    const index = new RunIndex(join(root, "index.jsonl"));
    const summary = summarizeWorkerRun(logInput(baseExecution()));

    await index.append(summary);

    expect(await index.list()).toEqual([summary]);
    expect(await index.find("run-1")).toEqual(summary);
    await expect(index.append(summary)).rejects.toThrow("run already exists");
  });

  test("classifies common failed run outcomes", () => {
    const setupFailed = summarizeWorkerRun(
      logInput(
        baseExecution({
          setupResults: [{ command: ["bash", "-lc", "bun install"], exitCode: 1, stdout: "", stderr: "" }],
          command: undefined,
          evaluation: undefined,
          commit: undefined,
          pass: false,
        }),
      ),
    );
    const verifyFailed = summarizeWorkerRun(
      logInput(
        baseExecution({
          evaluation: {
            pass: false,
            harness: { status: "pass", note: "ok", commit: "" },
            changedFiles: ["allowed.txt"],
            scopeViolations: [],
            verifyResults: [{ command: "test -f missing.txt", exitCode: 1, stdout: "", stderr: "" }],
          },
          commit: undefined,
          pass: false,
        }),
      ),
    );
    const scopeFailed = summarizeWorkerRun(
      logInput(
        baseExecution({
          evaluation: {
            pass: false,
            harness: { status: "pass", note: "ok", commit: "" },
            changedFiles: ["state/leak.json"],
            scopeViolations: [{ file: "state/leak.json", reason: "forbidden", matchedPattern: "state/**" }],
            verifyResults: [],
          },
          commit: undefined,
          pass: false,
        }),
      ),
    );

    expect(setupFailed.outcome).toBe("setup_failed");
    expect(setupFailed.failureReason).toContain("bun install");
    expect(verifyFailed.outcome).toBe("verify_failed");
    expect(verifyFailed.failureReason).toContain("missing.txt");
    expect(scopeFailed.outcome).toBe("scope_failed");
    expect(scopeFailed.failureReason).toBe("1 scope violation(s)");
  });

  test("does not surface report-only HARNESS_RESULT commits in run summaries", () => {
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const reportTask: TaskSpec = {
      ...task,
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      resultMode: "report",
    };
    const summary = summarizeWorkerRun({
      ...logInput(
        baseExecution({
          preparation: {
            taskId: reportTask.id,
            agentId: reviewer.id,
            worktreePath: "/repo",
            codex: { prompt: "prompt", command: ["codex", "exec"] },
          },
          evaluation: {
            pass: true,
            harness: { status: "pass", note: "report only", commit: "a".repeat(40) },
            changedFiles: [],
            scopeViolations: [],
            verifyResults: [],
          },
          commit: undefined,
          pass: true,
        }),
      ),
      task: reportTask,
      agent: reviewer,
    });

    expect(summary.outcome).toBe("pass");
    expect(summary.commit).toBe("");
  });
});
