import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import {
  buildWorkerRunLog,
  writeWorkerRunLog,
  type WorkerRunTrajectoryEntry,
} from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "Audit Log Fixture",
  title: "Write audit log",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "lifecycle-sensitive",
  targetAgent: "codex-worker",
  targetFiles: ["allowed.txt"],
  forbiddenChanges: ["forbidden/**"],
  setupCommands: ["test -f allowed.txt"],
  verifyCommands: ["test -f allowed.txt"],
  instructions: "Write an audit log fixture.",
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

const execution: WorkerDispatchExecution = {
  preparation: {
    taskId: task.id,
    agentId: agent.id,
    worktreePath: "/tmp/samantha-worktree",
    allocation: {
      taskId: task.id,
      repoRoot: "/repo",
      worktreePath: "/tmp/samantha-worktree",
      branch: "samantha/audit-log-fixture",
      baseCommit: "b".repeat(40),
    },
    codex: {
      prompt: "prompt",
      command: ["codex", "exec"],
    },
    allocationTiming: {
      startedAt: "2026-05-12T10:00:01.000Z",
      finishedAt: "2026-05-12T10:00:01.010Z",
      durationMs: 10,
    },
  },
  setupResults: [
    {
      command: ["bash", "-lc", "test -f allowed.txt"],
      exitCode: 0,
      stdout: "",
      stderr: "",
      startedAt: "2026-05-12T10:00:02.000Z",
      finishedAt: "2026-05-12T10:00:02.005Z",
      durationMs: 5,
    },
  ],
  command: {
    command: ["codex", "exec"],
    exitCode: 0,
    stdout: 'HARNESS_RESULT: {"status":"pass","note":"ok","commit":""}',
    stderr: "",
    startedAt: "2026-05-12T10:00:03.000Z",
    finishedAt: "2026-05-12T10:00:23.000Z",
    durationMs: 20000,
  },
  runtime: {
    kind: "exec-json",
    approvalPolicy: "never",
  },
  evaluation: {
    pass: true,
    harness: {
      status: "pass",
      note: "ok",
      commit: "",
    },
    changedFiles: ["allowed.txt"],
    scopeViolations: [],
    verifyResults: [
      {
        command: "test -f allowed.txt",
        exitCode: 0,
        stdout: "",
        stderr: "",
        startedAt: "2026-05-12T10:00:24.000Z",
        finishedAt: "2026-05-12T10:00:24.006Z",
        durationMs: 6,
      },
    ],
    harnessTiming: {
      startedAt: "2026-05-12T10:00:23.001Z",
      finishedAt: "2026-05-12T10:00:23.008Z",
      durationMs: 7,
    },
    verificationTiming: {
      startedAt: "2026-05-12T10:00:24.000Z",
      finishedAt: "2026-05-12T10:00:24.010Z",
      durationMs: 10,
    },
  },
  commit: {
    subject: "test: commit worker files",
    files: ["allowed.txt"],
    add: {
      command: ["git", "add", "--", "allowed.txt"],
      exitCode: 0,
      stdout: "",
      stderr: "",
      startedAt: "2026-05-12T10:00:25.000Z",
      finishedAt: "2026-05-12T10:00:25.004Z",
      durationMs: 4,
    },
    commit: {
      command: ["git", "commit", "-m", "test: commit worker files"],
      exitCode: 0,
      stdout: "[samantha/task abc123] test: commit worker files\n",
      stderr: "",
      startedAt: "2026-05-12T10:00:25.005Z",
      finishedAt: "2026-05-12T10:00:25.030Z",
      durationMs: 25,
    },
    commitHash: "a".repeat(40),
  },
  pass: true,
};

function expectTiming(entry: WorkerRunTrajectoryEntry | undefined): void {
  expect(entry?.startedAt).toBeTruthy();
  expect(entry?.finishedAt).toBeTruthy();
  expect(Number.isNaN(Date.parse(entry!.startedAt!))).toBe(false);
  expect(Number.isNaN(Date.parse(entry!.finishedAt!))).toBe(false);
  expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("worker run logs", () => {
  test("builds a stable run log shape", () => {
    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      worktreesDir: "worktrees",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution,
    });

    expect(log.runId).toBe("2026-05-12T10-00-00-000Z-audit-log-fixture");
    expect(log.schemaVersion).toBe(1);
    expect(log.input).toEqual({
      repoRoot: "/repo",
      worktreesDir: "worktrees",
    });
    expect(log.result.preparation.codex.command).toEqual(["codex", "exec"]);
    expect(log.result.runtime).toEqual({ kind: "exec-json", approvalPolicy: "never" });
    expect(log.result.evaluation?.changedFiles).toEqual(["allowed.txt"]);
    expect(log.result.commit?.commitHash).toBe("a".repeat(40));
    expect(log.trajectory?.map((entry) => entry.event)).toEqual([
      "planned",
      "worktree_created",
      "setup_finished",
      "worker_dispatched",
      "worker_output_received",
      "harness_result_parsed",
      "verification_started",
      "verification_finished",
      "worker_commit_finished",
    ]);
    expect(log.trajectory?.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(log.trajectory?.[3]).toMatchObject({
      event: "worker_dispatched",
      details: {
        runtimeKind: "exec-json",
        approvalPolicy: "never",
      },
    });
    expect(log.trajectory?.[7]).toMatchObject({
      event: "verification_finished",
      status: "completed",
      details: {
        passed: 1,
        failed: 0,
      },
    });
    expectTiming(log.trajectory?.[1]);
    expectTiming(log.trajectory?.[2]);
    expectTiming(log.trajectory?.[4]);
    expectTiming(log.trajectory?.[5]);
    expectTiming(log.trajectory?.[7]);
    expectTiming(log.trajectory?.[8]);
  });

  test("writes pretty JSON under the run log directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-log-"));
    tmpRoots.push(root);

    const written = await writeWorkerRunLog(root, {
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution,
    });
    const raw = await readFile(written.path, "utf8");
    const parsed = JSON.parse(raw);

    expect(written.runId).toBe("2026-05-12T10-00-00-000Z-audit-log-fixture");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('\n  "schemaVersion": 1,\n');
    expect(parsed.trajectory[0].event).toBe("planned");
    expect(parsed.result.pass).toBe(true);
    expect(parsed.result.runtime).toEqual({ kind: "exec-json", approvalPolicy: "never" });
    expect(parsed.result.preparation.codex.prompt).toBe("prompt");
  });

  test("keeps legacy run logs compatible when runtime metadata is absent", () => {
    const legacyExecution: WorkerDispatchExecution = {
      ...execution,
      runtime: undefined,
    };
    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution: legacyExecution,
    });

    expect(log.result.runtime).toBeUndefined();
    expect(log.trajectory?.[3]).toMatchObject({
      event: "worker_dispatched",
      details: {
        command: ["codex", "exec"],
      },
    });
    expect(log.trajectory?.[3]?.details).not.toHaveProperty("runtimeKind");
    expect(log.trajectory?.[3]?.details).not.toHaveProperty("approvalPolicy");
  });

  test("keeps legacy trajectory entries valid when timing is absent", () => {
    const legacyEntry: WorkerRunTrajectoryEntry = {
      sequence: 1,
      event: "planned",
      status: "completed",
      note: "legacy run log entry",
    };

    expect(legacyEntry).not.toHaveProperty("startedAt");
    expect(legacyEntry).not.toHaveProperty("finishedAt");
    expect(legacyEntry).not.toHaveProperty("durationMs");
  });
});
