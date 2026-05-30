import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { RunIndex, type RunSummary } from "../src/core/ledger";
import type { RunLifecycleRecord } from "../src/core/run-lifecycle-store";
import type { WorkerRunHookEvidence, WorkerRunLog } from "../src/core/run-log";
import type { RunVisibilitySummary } from "../src/core/run-visibility";
import { showRun } from "../src/core/run-show";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "show-fixture",
  title: "Show fixture",
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
    blockedSkills: [
      "using-git-worktrees",
      "dispatching-parallel-agents",
      "subagent-driven-development",
    ],
  },
};

const hookEvidence: WorkerRunHookEvidence = {
  policy: {
    path: "references/hooks/hook-policy.json",
    digest: "sha256:policy-digest",
  },
  definitions: [
    {
      hookId: "preflight-allow",
      path: "references/hooks/hooks/preflight-allow.json",
      digest: "sha256:preflight-allow-digest",
    },
    {
      hookId: "dispatch-block",
      path: "references/hooks/hooks/dispatch-block.json",
      digest: "sha256:dispatch-block-digest",
    },
    {
      hookId: "advisory-review",
      path: "references/hooks/hooks/advisory-review.json",
      digest: "sha256:advisory-review-digest",
    },
    {
      hookId: "timeout-advisory",
      path: "references/hooks/hooks/timeout-advisory.json",
      digest: "sha256:timeout-advisory-digest",
    },
    {
      hookId: "schema-advisory",
      path: "references/hooks/hooks/schema-advisory.json",
      digest: "sha256:schema-advisory-digest",
    },
  ],
  events: [
    {
      event: "task_spec.preflight",
      eventVersion: 1,
      contextKeys: ["task.id"],
      contextBytes: 40,
      trustGate: {
        decision: "allow",
        summary: "Preflight trust gate allowed the task.",
        blockingHookId: null,
      },
      invocations: [
        {
          hookId: "preflight-allow",
          event: "task_spec.preflight",
          command: ["bun", "run", "hooks/preflight-allow.ts"],
          cwd: "/repo",
          status: "passed",
          decision: "allow",
          summary: "Task passed preflight checks.",
          startedAt: "2026-05-12T10:00:00.000Z",
          finishedAt: "2026-05-12T10:00:00.010Z",
          durationMs: 10,
          exitCode: 0,
          stdout: '{"status":"passed","decision":"allow"}',
          stdoutTruncated: false,
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
          contextKeys: ["task.id"],
          contextBytes: 40,
        },
      ],
    },
    {
      event: "worker.pre_dispatch",
      eventVersion: 1,
      contextKeys: ["worker.command"],
      contextBytes: 72,
      trustGate: {
        decision: "block",
        summary: "Dispatch trust gate blocked the worker command.",
        blockingHookId: "dispatch-block",
      },
      invocations: [
        {
          hookId: "dispatch-block",
          event: "worker.pre_dispatch",
          command: ["bun", "run", "hooks/dispatch-block.ts"],
          cwd: "/repo",
          status: "blocked",
          decision: "block",
          summary: "Worker command requested a blocked runtime flag.",
          startedAt: "2026-05-12T10:00:01.000Z",
          finishedAt: "2026-05-12T10:00:01.020Z",
          durationMs: 20,
          exitCode: 0,
          stdout: "blocked raw stdout evidence",
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
          contextKeys: ["worker.command"],
          contextBytes: 72,
        },
      ],
    },
    {
      event: "verification.completed",
      eventVersion: 1,
      contextKeys: ["verify.results"],
      contextBytes: 96,
      invocations: [
        {
          hookId: "advisory-review",
          event: "verification.completed",
          command: ["bun", "run", "hooks/advisory-review.ts"],
          cwd: "/repo",
          status: "advisory_failed",
          decision: "none",
          summary: "Advisory hook exited non-zero.",
          startedAt: "2026-05-12T10:00:02.000Z",
          finishedAt: "2026-05-12T10:00:02.030Z",
          durationMs: 30,
          exitCode: 1,
          stdout: "advisory raw stdout evidence",
          stdoutTruncated: false,
          stderr: "advisory stderr",
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
          contextKeys: ["verify.results"],
          contextBytes: 96,
        },
        {
          hookId: "timeout-advisory",
          event: "verification.completed",
          command: ["bun", "run", "hooks/timeout-advisory.ts"],
          cwd: "/repo",
          status: "timed_out",
          decision: "none",
          summary: "Hook timed out after 100ms.",
          startedAt: "2026-05-12T10:00:03.000Z",
          finishedAt: "2026-05-12T10:00:03.040Z",
          durationMs: 40,
          exitCode: null,
          stdout: "",
          stdoutTruncated: false,
          stderr: "",
          stderrTruncated: false,
          timedOut: true,
          timeoutMs: 100,
          timeoutDetails: "command exceeded timeoutMs=100",
          repoMutations: {
            detection: "ok",
            created: [],
            modified: [],
            deleted: [],
            error: null,
            timeoutMs: 500,
          },
          schemaViolations: [],
          contextKeys: ["verify.results"],
          contextBytes: 96,
        },
        {
          hookId: "schema-advisory",
          event: "verification.completed",
          command: ["bun", "run", "hooks/schema-advisory.ts"],
          cwd: "/repo",
          status: "schema_invalid",
          decision: "none",
          summary: "Hook result schema invalid.",
          startedAt: "2026-05-12T10:00:04.000Z",
          finishedAt: "2026-05-12T10:00:04.050Z",
          durationMs: 50,
          exitCode: 0,
          stdout: "{bad json}",
          stdoutTruncated: false,
          stderr: "",
          stderrTruncated: false,
          timedOut: false,
          timeoutMs: 5000,
          timeoutDetails: null,
          repoMutations: {
            detection: "ok",
            created: ["hook-output.tmp"],
            modified: ["allowed.txt"],
            deleted: [],
            error: null,
            timeoutMs: 500,
          },
          schemaViolations: ["hook result must be valid JSON"],
          contextKeys: ["verify.results"],
          contextBytes: 96,
        },
      ],
    },
  ],
};

function runLog(runId: string, input: { hookEvidence?: WorkerRunHookEvidence } = {}): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId,
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    task,
    agent,
    input: { repoRoot: "/repo", worktreesDir: "worktrees" },
    result: {
      preparation: {
        taskId: task.id,
        agentId: agent.id,
        worktreePath: "/repo/worktrees/show-fixture",
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
    },
    ...(input.hookEvidence ? { hookEvidence: input.hookEvidence } : {}),
  };
}

function defaultVisibilitySummary(): RunVisibilitySummary {
  return {
    threadNavigation: {
      status: "missing",
      threadId: null,
    },
    harnessStatus: "pass",
    topLevelPass: true,
    candidateCommitStatus: "present",
    candidateCommitHash: "a".repeat(40),
    scopeStatus: "in_scope",
    changedFileCount: 1,
    scopeViolationCount: 0,
    verificationStatus: "missing",
    verificationResultCount: 0,
    mergeStatus: "not_started",
    cleanupStatus: "not_started",
    finalGitStatus: "not_captured",
  };
}

function runSummary(runId: string, logPath: string): RunSummary {
  return {
    schemaVersion: 1,
    runId,
    taskId: task.id,
    taskTitle: task.title,
    agentId: agent.id,
    repoRoot: "/repo",
    worktreePath: "/repo/worktrees/show-fixture",
    logPath,
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    outcome: "pass",
    pass: true,
    commit: "a".repeat(40),
  };
}

function lifecycleRecord(runId: string, logPath: string): RunLifecycleRecord {
  return {
    schemaVersion: 1,
    runId,
    taskId: task.id,
    repoRoot: "/repo",
    runLogPath: logPath,
    commit: "a".repeat(40),
    mergedAt: "2026-05-12T10:02:00.000Z",
    cleanedAt: "2026-05-12T10:03:00.000Z",
    updatedAt: "2026-05-12T10:03:00.000Z",
  };
}

async function writeRunFixture(input: {
  runsDir: string;
  runId: string;
  hookEvidence?: WorkerRunHookEvidence;
  log?: WorkerRunLog;
}): Promise<{
  summary: RunSummary;
  log: WorkerRunLog;
  logPath: string;
}> {
  await mkdir(input.runsDir, { recursive: true });
  const logPath = join(input.runsDir, `${input.runId}.json`);
  const log = input.log ?? runLog(input.runId, { hookEvidence: input.hookEvidence });
  const summary = runSummary(input.runId, logPath);

  await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  await new RunIndex(join(input.runsDir, "index.jsonl")).append(summary);

  return { summary, log, logPath };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("showRun", () => {
  test("returns summary, log, and lifecycle evidence for a merged and cleaned run", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-show-"));
    tmpRoots.push(root);
    const runsDir = join(root, "runs");
    const { summary, log, logPath } = await writeRunFixture({ runsDir, runId: "run-1" });
    const lifecycle = lifecycleRecord("run-1", logPath);
    await writeFile(join(runsDir, "run-lifecycle.jsonl"), `${JSON.stringify(lifecycle)}\n`, "utf8");

    await expect(showRun({ runId: "run-1", runsDir })).resolves.toEqual({
      summary,
      log,
      lifecycle,
      visibilitySummary: defaultVisibilitySummary(),
    });
  });

  test("returns lifecycle null when no lifecycle record matches the run", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-show-"));
    tmpRoots.push(root);
    const runsDir = join(root, "runs");
    const { summary, log, logPath } = await writeRunFixture({ runsDir, runId: "run-without-record" });
    const otherLifecycle = lifecycleRecord("other-run", logPath);
    await writeFile(join(runsDir, "run-lifecycle.jsonl"), `${JSON.stringify(otherLifecycle)}\n`, "utf8");

    await expect(showRun({ runId: "run-without-record", runsDir })).resolves.toEqual({
      summary,
      log,
      lifecycle: null,
      visibilitySummary: defaultVisibilitySummary(),
    });
  });

  test("returns visibility summary from run log evidence without treating thread id as trusted state", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-show-"));
    tmpRoots.push(root);
    const runsDir = join(root, "runs");
    const log = runLog("run-log-only-evidence");
    log.result.runtime = {
      kind: "codex-sdk",
      approvalPolicy: "never",
      threadId: "thread_advisory_navigation_only",
    };
    log.result.pass = false;
    log.result.evaluation = {
      pass: false,
      harness: { status: "rework", note: "worker requested rework", commit: "" },
      changedFiles: ["allowed.txt", "state/leak.txt"],
      scopeViolations: [
        {
          file: "state/leak.txt",
          reason: "forbidden",
          matchedPattern: "state/**",
        },
      ],
      verifyResults: [
        {
          command: "test -f allowed.txt",
          exitCode: 1,
          stdout: "",
          stderr: "missing allowed.txt",
        },
      ],
    };
    log.result.commit = undefined;
    log.trajectory = [
      {
        sequence: 1,
        event: "merge_checked",
        status: "completed",
        note: "merge check fixture",
      },
      {
        sequence: 2,
        event: "cleanup_finished",
        status: "failed",
        note: "cleanup failure fixture",
      },
    ];

    const { summary, logPath } = await writeRunFixture({
      runsDir,
      runId: "run-log-only-evidence",
      log,
    });
    const lifecycle = lifecycleRecord("run-log-only-evidence", logPath);
    await writeFile(join(runsDir, "run-lifecycle.jsonl"), `${JSON.stringify(lifecycle)}\n`, "utf8");

    const result = await showRun({ runId: "run-log-only-evidence", runsDir });

    expect(result.summary).toEqual(summary);
    expect(result.summary.pass).toBe(true);
    expect(result.lifecycle).toEqual(lifecycle);
    expect(result.visibilitySummary).toEqual({
      threadNavigation: {
        status: "available",
        threadId: "thread_advisory_navigation_only",
      },
      harnessStatus: "rework",
      topLevelPass: false,
      candidateCommitStatus: "missing",
      candidateCommitHash: null,
      scopeStatus: "violations",
      changedFileCount: 2,
      scopeViolationCount: 1,
      verificationStatus: "failed",
      verificationResultCount: 1,
      mergeStatus: "checked",
      cleanupStatus: "failed",
      finalGitStatus: "not_captured",
    });
  });

  test("summarizes hook evidence without replacing raw run log evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-show-"));
    tmpRoots.push(root);
    const runsDir = join(root, "runs");
    const { summary, log } = await writeRunFixture({
      runsDir,
      runId: "run-with-hooks",
      hookEvidence,
    });

    const result = await showRun({ runId: "run-with-hooks", runsDir });

    expect(result.summary).toEqual(summary);
    expect(result.summary.outcome).toBe("pass");
    expect(result.log).toEqual(log);
    expect(result.visibilitySummary).toEqual(defaultVisibilitySummary());
    expect(result.log.hookEvidence).toEqual(hookEvidence);
    expect(result.log.hookEvidence?.events[1].invocations[0].stdout).toBe("blocked raw stdout evidence");
    expect(result.log.hookEvidence?.events[1].invocations[0].stdoutTruncated).toBe(true);
    expect(result.hookSummary).toEqual({
      eventCount: 3,
      hookInvocationCount: 5,
      totalDurationMs: 150,
      trustGateDecisions: [
        {
          event: "task_spec.preflight",
          eventVersion: 1,
          decision: "allow",
          blockingHookId: null,
          summary: "Preflight trust gate allowed the task.",
        },
        {
          event: "worker.pre_dispatch",
          eventVersion: 1,
          decision: "block",
          blockingHookId: "dispatch-block",
          summary: "Dispatch trust gate blocked the worker command.",
        },
      ],
      advisoryFailures: [
        {
          event: "verification.completed",
          eventVersion: 1,
          hookId: "advisory-review",
          summary: "Advisory hook exited non-zero.",
        },
      ],
      timeouts: [
        {
          event: "verification.completed",
          eventVersion: 1,
          hookId: "timeout-advisory",
          summary: "Hook timed out after 100ms.",
          timeoutMs: 100,
          timeoutDetails: "command exceeded timeoutMs=100",
        },
      ],
      schemaInvalidResults: [
        {
          event: "verification.completed",
          eventVersion: 1,
          hookId: "schema-advisory",
          summary: "Hook result schema invalid.",
          schemaViolations: ["hook result must be valid JSON"],
        },
      ],
      repoMutationEvidence: [
        {
          event: "verification.completed",
          eventVersion: 1,
          hookId: "schema-advisory",
          detection: "ok",
          created: ["hook-output.tmp"],
          modified: ["allowed.txt"],
          deleted: [],
          error: null,
        },
      ],
    });
    expect(JSON.stringify(result.hookSummary)).not.toContain("blocked raw stdout evidence");
    expect(JSON.stringify(result.hookSummary)).not.toContain("advisory raw stdout evidence");
  });
});
