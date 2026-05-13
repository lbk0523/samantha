import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { RunIndex, type RunSummary } from "../src/core/ledger";
import type { RunLifecycleRecord } from "../src/core/run-lifecycle-store";
import type { WorkerRunLog } from "../src/core/run-log";
import { showRun } from "../src/core/run-show";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "show-fixture",
  title: "Show fixture",
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

function runLog(runId: string): WorkerRunLog {
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

async function writeRunFixture(input: { runsDir: string; runId: string }): Promise<{
  summary: RunSummary;
  log: WorkerRunLog;
  logPath: string;
}> {
  await mkdir(input.runsDir, { recursive: true });
  const logPath = join(input.runsDir, `${input.runId}.json`);
  const log = runLog(input.runId);
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
    });
  });
});
