import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { createTaskFromRun } from "../src/core/task-from-run";
import type { WorkerRunLog } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "original-task",
  title: "Original task",
  targetAgent: "codex-worker",
  targetFiles: ["src/core/original.ts", "tests/original.test.ts"],
  forbiddenChanges: ["runs/**", "worktrees/**"],
  setupCommands: [],
  verifyCommands: ["bun run typecheck", "bun test tests/original.test.ts"],
  instructions: "Original instructions.",
  expectedCommitSubject: "feat: original task",
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

function commandResult(exitCode = 0, stderr = "") {
  return { command: ["codex", "exec"], exitCode, stdout: "", stderr };
}

function baseExecution(overrides: Partial<WorkerDispatchExecution> = {}): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: task.id,
      agentId: agent.id,
      worktreePath: "/repo/worktrees/original-task",
      codex: { prompt: "prompt", command: ["codex", "exec"] },
    },
    setupResults: [],
    command: commandResult(),
    evaluation: {
      pass: true,
      harness: { status: "pass", note: "ok", commit: "" },
      changedFiles: ["src/core/original.ts"],
      scopeViolations: [],
      verifyResults: [],
    },
    commit: {
      subject: "feat: original task",
      files: ["src/core/original.ts"],
      add: { command: ["git", "add", "--", "src/core/original.ts"], exitCode: 0, stdout: "", stderr: "" },
      commit: { command: ["git", "commit", "-m", "feat: original task"], exitCode: 0, stdout: "", stderr: "" },
      commitHash: "a".repeat(40),
    },
    pass: true,
    ...overrides,
  };
}

function baseLog(overrides: {
  task?: TaskSpec;
  agent?: AgentProfile;
  result?: WorkerDispatchExecution;
} = {}): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId: "run-1",
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    task: overrides.task ?? task,
    agent: overrides.agent ?? agent,
    input: { repoRoot: "/repo", worktreesDir: "worktrees" },
    result: overrides.result ?? baseExecution(),
  };
}

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-task-from-run-"));
  tmpRoots.push(root);
  return root;
}

async function writeRunLog(root: string, log: WorkerRunLog): Promise<string> {
  const path = join(root, `${log.runId}.json`);
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return path;
}

async function readTask(path: string): Promise<TaskSpec> {
  return JSON.parse(await readFile(path, "utf8")) as TaskSpec;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("task creation from run evidence", () => {
  test("refuses passing writer runs and recommends accept", async () => {
    const root = await makeRoot();
    const runLogPath = await writeRunLog(root, baseLog());

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "follow-up",
      title: "Follow up",
    });

    expect(result).toEqual({
      status: "refused",
      created: false,
      runId: "run-1",
      taskId: "follow-up",
      outcome: "pass",
      recommendedNextAction: "runs:accept",
      note: "passing writer run should be accepted with runs:accept; no task was created",
    });
    await expect(readFile(join(root, "references", "tasks", "follow-up.json"), "utf8")).rejects.toThrow();
  });

  test("refuses passing report-only runs as evidence-only", async () => {
    const root = await makeRoot();
    const reportTask: TaskSpec = {
      ...task,
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      resultMode: "report",
    };
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const runLogPath = await writeRunLog(
      root,
      baseLog({
        task: reportTask,
        agent: reviewer,
        result: baseExecution({
          evaluation: {
            pass: true,
            harness: { status: "pass", note: "report", commit: "" },
            changedFiles: [],
            scopeViolations: [],
            verifyResults: [],
          },
          commit: undefined,
          pass: true,
        }),
      }),
    );

    await expect(
      createTaskFromRun({
        repoRoot: root,
        runLogPath,
        taskId: "report-follow-up",
        title: "Report follow up",
      }),
    ).resolves.toMatchObject({
      status: "refused",
      created: false,
      outcome: "pass",
      recommendedNextAction: "record_report_evidence_do_not_merge",
      note: "passing report-only run is evidence-only; no task was created",
    });
  });

  test("creates verify rework tasks that keep the failed verify command first", async () => {
    const root = await makeRoot();
    const runLogPath = await writeRunLog(
      root,
      baseLog({
        result: baseExecution({
          evaluation: {
            pass: false,
            harness: { status: "pass", note: "ok", commit: "" },
            changedFiles: ["src/core/original.ts"],
            scopeViolations: [],
            verifyResults: [
              { command: "bun run typecheck", exitCode: 0, stdout: "", stderr: "" },
              { command: "bun test tests/original.test.ts", exitCode: 1, stdout: "", stderr: "" },
            ],
          },
          commit: undefined,
          pass: false,
        }),
      }),
    );

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "verify-follow-up",
      title: "Fix original verification",
    });
    const generated = await readTask(result.path ?? "");

    expect(result).toMatchObject({
      status: "created",
      created: true,
      outcome: "verify_failed",
      recommendedNextAction: "create_rework_task_keep_failed_verify_command",
    });
    expect(generated.verifyCommands).toEqual([
      "bun test tests/original.test.ts",
      "bun run typecheck",
    ]);
    expect(generated.instructions).toContain("Keep this failed verify command in verifyCommands: bun test tests/original.test.ts");
  });

  test("creates scope follow-up tasks that cite violations and reject untrusted output", async () => {
    const root = await makeRoot();
    const runLogPath = await writeRunLog(
      root,
      baseLog({
        result: baseExecution({
          evaluation: {
            pass: false,
            harness: { status: "pass", note: "ok", commit: "" },
            changedFiles: ["src/core/original.ts", "runs/leak.json"],
            scopeViolations: [{ file: "runs/leak.json", reason: "forbidden", matchedPattern: "runs/**" }],
            verifyResults: [],
          },
          commit: undefined,
          pass: false,
        }),
      }),
    );

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "scope-follow-up",
      title: "Narrow original scope",
    });
    const generated = await readTask(result.path ?? "");

    expect(result).toMatchObject({
      status: "created",
      created: true,
      outcome: "scope_failed",
      recommendedNextAction: "reject_output_and_create_narrower_task",
    });
    expect(generated.targetFiles).toEqual(task.targetFiles);
    expect(generated.instructions).toContain("reject the previous worker output as untrusted");
    expect(generated.instructions).toContain("runs/leak.json: forbidden matched runs/**");
  });

  test("creates setup follow-up tasks that let the worker start and verify setup correction", async () => {
    const root = await makeRoot();
    const setupTask: TaskSpec = {
      ...task,
      setupCommands: ["bun install --frozen-lockfile"],
    };
    const runLogPath = await writeRunLog(
      root,
      baseLog({
        task: setupTask,
        result: baseExecution({
          setupResults: [
            { command: ["bash", "-lc", "bun install --frozen-lockfile"], exitCode: 1, stdout: "", stderr: "" },
          ],
          command: undefined,
          evaluation: undefined,
          commit: undefined,
          pass: false,
        }),
      }),
    );

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "setup-follow-up",
      title: "Fix setup failure",
    });
    const generated = await readTask(result.path ?? "");

    expect(result).toMatchObject({
      status: "created",
      created: true,
      outcome: "setup_failed",
      recommendedNextAction: "fix_setup_task_or_environment_and_rerun_new_task",
    });
    expect(generated.setupCommands).toEqual([]);
    expect(generated.verifyCommands[0]).toBe("bun install --frozen-lockfile");
    expect(generated.instructions).toContain("Focus on setup, task, or environment correction");
  });

  test("creates evidence-inspection tasks for worker failures and malformed harness results", async () => {
    const root = await makeRoot();
    const workerFailedPath = await writeRunLog(
      root,
      baseLog({
        result: baseExecution({
          command: commandResult(7),
          evaluation: {
            pass: false,
            parseError: "missing HARNESS_RESULT",
            changedFiles: [],
            scopeViolations: [],
            verifyResults: [],
          },
          commit: undefined,
          pass: false,
        }),
      }),
    );
    const malformedPath = await writeRunLog(root, {
      ...baseLog(),
      runId: "run-2",
      result: baseExecution({
        evaluation: {
          pass: false,
          parseError: "invalid HARNESS_RESULT JSON",
          changedFiles: [],
          scopeViolations: [],
          verifyResults: [],
        },
        commit: undefined,
        pass: false,
      }),
    });

    const workerFailed = await createTaskFromRun({
      repoRoot: root,
      runLogPath: workerFailedPath,
      taskId: "worker-failed-follow-up",
      title: "Inspect worker failure",
    });
    const malformed = await createTaskFromRun({
      repoRoot: root,
      runLogPath: malformedPath,
      taskId: "malformed-follow-up",
      title: "Inspect malformed result",
    });

    expect((await readTask(workerFailed.path ?? "")).instructions).toContain("Do not trust worker output");
    expect((await readTask(malformed.path ?? "")).instructions).toContain("malformed HARNESS_RESULT");
    expect(workerFailed.outcome).toBe("worker_failed");
    expect(malformed.outcome).toBe("missing_harness_result");
  });

  test("refuses commit failures and refuses to overwrite existing task specs", async () => {
    const root = await makeRoot();
    const commitFailedPath = await writeRunLog(
      root,
      baseLog({
        result: baseExecution({
          commit: {
            subject: "feat: original task",
            files: ["src/core/original.ts"],
            add: { command: ["git", "add", "--", "src/core/original.ts"], exitCode: 0, stdout: "", stderr: "" },
            commit: {
              command: ["git", "commit", "-m", "feat: original task"],
              exitCode: 1,
              stdout: "",
              stderr: "nothing to commit",
            },
            commitHash: "",
          },
          pass: false,
        }),
      }),
    );

    await expect(
      createTaskFromRun({
        repoRoot: root,
        runLogPath: commitFailedPath,
        taskId: "commit-follow-up",
        title: "Inspect commit failure",
      }),
    ).resolves.toMatchObject({
      status: "refused",
      created: false,
      outcome: "commit_failed",
      recommendedNextAction: "inspect_locally_do_not_trust_worker_lifecycle",
      note: "commit failure requires explicit local inspection; no task was created and lifecycle is untrusted",
    });

    await mkdir(join(root, "references", "tasks"), { recursive: true });
    await writeFile(join(root, "references", "tasks", "existing-task.json"), "{}\n", "utf8");
    const verifyFailedPath = await writeRunLog(root, {
      ...baseLog(),
      runId: "run-2",
      result: baseExecution({
        evaluation: {
          pass: false,
          harness: { status: "pass", note: "ok", commit: "" },
          changedFiles: ["src/core/original.ts"],
          scopeViolations: [],
          verifyResults: [{ command: "bun test tests/original.test.ts", exitCode: 1, stdout: "", stderr: "" }],
        },
        commit: undefined,
        pass: false,
      }),
    });
    await expect(
      createTaskFromRun({
        repoRoot: root,
        runLogPath: verifyFailedPath,
        taskId: "existing-task",
        title: "Existing task",
      }),
    ).rejects.toThrow("task already exists: existing-task");
  });
});
