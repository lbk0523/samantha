import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import {
  buildWorkerRunLog,
  writeWorkerRunLog,
  type WorkerRunHookEvidence,
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

const hookEvidence: WorkerRunHookEvidence = {
  policy: {
    path: "references/hooks/hook-policy.json",
    digest: "sha256:policy-digest",
  },
  definitions: [
    {
      hookId: "task-scope-gate",
      path: "references/hooks/hooks/task-scope-gate.json",
      digest: "sha256:scope-gate-digest",
    },
    {
      hookId: "run-advisory",
      path: "references/hooks/hooks/run-advisory.json",
      digest: "sha256:run-advisory-digest",
    },
  ],
  events: [
    {
      event: "task_spec.preflight",
      eventVersion: 1,
      contextKeys: ["task.id", "task.targetFiles"],
      contextBytes: 128,
      trustGate: {
        decision: "block",
        summary: "Trust gate blocked the task scope.",
        blockingHookId: "task-scope-gate",
      },
      invocations: [
        {
          hookId: "task-scope-gate",
          event: "task_spec.preflight",
          command: ["bun", "run", "hooks/task-scope-gate.ts"],
          cwd: "/repo",
          status: "blocked",
          decision: "block",
          summary: "Task scope included a forbidden path.",
          startedAt: "2026-05-12T10:00:00.000Z",
          finishedAt: "2026-05-12T10:00:00.012Z",
          durationMs: 12,
          exitCode: 0,
          stdout: '{"status":"blocked","decision":"block","summary":"Task scope included a forbidden path."}',
          stdoutTruncated: true,
          stderr: "",
          stderrTruncated: false,
          timedOut: false,
          timeoutMs: 5000,
          timeoutDetails: null,
          repoMutations: {
            detection: "ok",
            created: [],
            modified: [],
            deleted: [],
            error: null,
            timeoutMs: 500,
          },
          schemaViolations: [],
          contextKeys: ["task.id", "task.targetFiles"],
          contextBytes: 128,
        },
      ],
    },
    {
      event: "run.completed",
      eventVersion: 1,
      contextKeys: ["run.id"],
      contextBytes: 64,
      invocations: [
        {
          hookId: "run-advisory",
          event: "run.completed",
          command: ["bun", "run", "hooks/run-advisory.ts"],
          cwd: "/repo",
          status: "advisory_failed",
          decision: "none",
          summary: "Advisory hook exited non-zero.",
          startedAt: "2026-05-12T10:00:01.000Z",
          finishedAt: "2026-05-12T10:00:01.008Z",
          durationMs: 8,
          exitCode: 1,
          stdout: "advisory stdout evidence",
          stdoutTruncated: false,
          stderr: "advisory stderr evidence",
          stderrTruncated: false,
          timedOut: false,
          timeoutMs: 5000,
          timeoutDetails: null,
          repoMutations: {
            detection: "ok",
            created: [],
            modified: ["notes.txt"],
            deleted: [],
            error: null,
            timeoutMs: 500,
          },
          schemaViolations: [],
          contextKeys: ["run.id"],
          contextBytes: 64,
        },
      ],
    },
  ],
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

  test("omits hook evidence for legacy callers", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-log-"));
    tmpRoots.push(root);

    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution,
    });
    const written = await writeWorkerRunLog(root, {
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution,
    });
    const parsed = JSON.parse(await readFile(written.path, "utf8"));

    expect(Object.hasOwn(log, "hookEvidence")).toBe(false);
    expect(Object.hasOwn(parsed, "hookEvidence")).toBe(false);
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

  test("writes provided hook evidence without changing worker result authority", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-log-"));
    tmpRoots.push(root);

    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution,
      hookEvidence,
    });
    const written = await writeWorkerRunLog(root, {
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution,
      hookEvidence,
    });
    const parsed = JSON.parse(await readFile(written.path, "utf8"));

    expect(log.hookEvidence).toEqual(hookEvidence);
    expect(parsed.hookEvidence).toEqual(hookEvidence);
    expect(parsed.hookEvidence.events[0].trustGate.decision).toBe("block");
    expect(parsed.hookEvidence.events[1].invocations[0].status).toBe("advisory_failed");
    expect(parsed.hookEvidence.events[0].invocations[0].stdoutTruncated).toBe(true);
    expect(parsed.result.pass).toBe(true);
  });

  test("records parsed advisory verification evidence in run logs", () => {
    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution: {
        ...execution,
        evaluation: {
          ...execution.evaluation!,
          workerVerifyEvidence: {
            status: "parsed",
            raw: '{"ran":["bun test"],"skipped":[],"failed":[],"note":"ok"}',
            evidence: {
              ran: ["bun test"],
              skipped: [],
              failed: [],
              note: "ok",
            },
          },
        },
      },
    });

    expect(log.result.evaluation?.workerVerifyEvidence).toEqual({
      status: "parsed",
      raw: '{"ran":["bun test"],"skipped":[],"failed":[],"note":"ok"}',
      evidence: {
        ran: ["bun test"],
        skipped: [],
        failed: [],
        note: "ok",
      },
    });
    expect(log.trajectory?.[4]).toMatchObject({
      event: "worker_output_received",
      details: {
        workerVerifyEvidence: "parsed",
      },
    });
  });

  test("records malformed advisory verification evidence in run logs without changing pass", () => {
    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution: {
        ...execution,
        evaluation: {
          ...execution.evaluation!,
          workerVerifyEvidence: {
            status: "unparseable",
            raw: "{bad json}",
            parseError: "invalid WORKER_VERIFY_EVIDENCE json: Expected property name or '}' in JSON",
          },
        },
      },
    });

    expect(log.result.pass).toBe(true);
    expect(log.result.evaluation?.workerVerifyEvidence).toEqual({
      status: "unparseable",
      raw: "{bad json}",
      parseError: "invalid WORKER_VERIFY_EVIDENCE json: Expected property name or '}' in JSON",
    });
    expect(log.trajectory?.[4]).toMatchObject({
      event: "worker_output_received",
      details: {
        workerVerifyEvidence: "unparseable",
      },
    });
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
