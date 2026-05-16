import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { buildWorkerRunLog, writeWorkerRunLog } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "Audit Log Fixture",
  title: "Write audit log",
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
  },
  setupResults: [
    {
      command: ["bash", "-lc", "test -f allowed.txt"],
      exitCode: 0,
      stdout: "",
      stderr: "",
    },
  ],
  command: {
    command: ["codex", "exec"],
    exitCode: 0,
    stdout: 'HARNESS_RESULT: {"status":"pass","note":"ok","commit":""}',
    stderr: "",
  },
  runtime: {
    kind: "exec-json",
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
      },
    ],
  },
  commit: {
    subject: "test: commit worker files",
    files: ["allowed.txt"],
    add: {
      command: ["git", "add", "--", "allowed.txt"],
      exitCode: 0,
      stdout: "",
      stderr: "",
    },
    commit: {
      command: ["git", "commit", "-m", "test: commit worker files"],
      exitCode: 0,
      stdout: "[samantha/task abc123] test: commit worker files\n",
      stderr: "",
    },
    commitHash: "a".repeat(40),
  },
  pass: true,
};

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
    expect(log.result.runtime).toEqual({ kind: "exec-json" });
    expect(log.result.evaluation?.changedFiles).toEqual(["allowed.txt"]);
    expect(log.result.commit?.commitHash).toBe("a".repeat(40));
    expect(log.trajectory?.map((entry) => entry.event)).toEqual([
      "planned",
      "worktree_created",
      "worker_dispatched",
      "worker_output_received",
      "harness_result_parsed",
      "verification_started",
      "verification_finished",
    ]);
    expect(log.trajectory?.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(log.trajectory?.[2]).toMatchObject({
      event: "worker_dispatched",
      details: {
        runtimeKind: "exec-json",
      },
    });
    expect(log.trajectory?.at(-1)).toMatchObject({
      event: "verification_finished",
      status: "completed",
      details: {
        passed: 1,
        failed: 0,
      },
    });
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
    expect(parsed.result.runtime).toEqual({ kind: "exec-json" });
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
    expect(log.trajectory?.[2]).toMatchObject({
      event: "worker_dispatched",
      details: {
        command: ["codex", "exec"],
      },
    });
    expect(log.trajectory?.[2]?.details).not.toHaveProperty("runtimeKind");
  });
});
