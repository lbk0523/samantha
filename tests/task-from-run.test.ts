import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import type { RunOutcome, RunSummary } from "../src/core/ledger";
import { validateDispatch } from "../src/core/policy";
import type { RecommendedNextAction } from "../src/core/run-diagnose";
import type { RunLifecycleRecord } from "../src/core/run-lifecycle-store";
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

function runSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    schemaVersion: 1,
    runId: "run-1",
    taskId: task.id,
    taskTitle: task.title,
    agentId: agent.id,
    repoRoot: "/repo",
    worktreePath: "/repo/worktrees/original-task",
    logPath: "/repo/runs/run-1.json",
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    outcome: "blocked",
    pass: false,
    commit: "",
    ...overrides,
  };
}

function lifecycleRecord(overrides: Partial<RunLifecycleRecord> = {}): RunLifecycleRecord {
  return {
    schemaVersion: 1,
    runId: "run-2",
    taskId: task.id,
    repoRoot: "/repo",
    runLogPath: "/repo/runs/run-2.json",
    commit: "b".repeat(40),
    updatedAt: "2026-05-12T10:04:00.000Z",
    ...overrides,
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

async function writeJsonLines<T>(path: string, items: T[]): Promise<void> {
  await writeFile(path, `${items.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

function blockedLog(taskId: string, note: string): WorkerRunLog {
  return baseLog({
    task: {
      ...task,
      id: taskId,
    },
    result: baseExecution({
      evaluation: {
        pass: false,
        harness: { status: "blocked", note, commit: "" },
        changedFiles: [],
        scopeViolations: [],
        verifyResults: [],
      },
      commit: undefined,
      pass: false,
    }),
  });
}

function reportOnlyTask(taskId: string): TaskSpec {
  return {
    ...task,
    id: taskId,
    targetAgent: "codex-reviewer",
    targetFiles: [],
    forbiddenChanges: ["**/*"],
    setupCommands: [],
    verifyCommands: [],
    resultMode: "report",
    expectedCommitSubject: undefined,
  };
}

function reviewerAgent(): AgentProfile {
  return {
    ...agent,
    id: "codex-reviewer",
    role: "reviewer",
    writerClass: "non-writer",
    worktreePolicy: "none",
    mergePolicy: "none",
  };
}

function reportOnlyReworkLog(taskId: string, note: string): WorkerRunLog {
  return baseLog({
    task: reportOnlyTask(taskId),
    agent: reviewerAgent(),
    result: baseExecution({
      evaluation: {
        pass: false,
        harness: { status: "rework", note, commit: "" },
        changedFiles: [],
        scopeViolations: [],
        verifyResults: [],
      },
      commit: undefined,
      pass: false,
    }),
  });
}

async function writeSupersedingRunEvidence(input: {
  root: string;
  sourceLog: WorkerRunLog;
  cleanedAt?: string;
}): Promise<void> {
  const acceptedRunCommit = "b".repeat(40);
  const acceptedRunLogPath = join(input.root, "run-2.json");
  await writeJsonLines(join(input.root, "index.jsonl"), [
    runSummary({
      runId: input.sourceLog.runId,
      taskId: input.sourceLog.task.id,
      taskTitle: input.sourceLog.task.title,
      logPath: join(input.root, `${input.sourceLog.runId}.json`),
    }),
    runSummary({
      runId: "run-2",
      taskId: `${input.sourceLog.task.id}-v2`,
      taskTitle: input.sourceLog.task.title,
      logPath: acceptedRunLogPath,
      startedAt: "2026-05-12T10:02:00.000Z",
      finishedAt: "2026-05-12T10:03:00.000Z",
      outcome: "pass",
      pass: true,
      commit: acceptedRunCommit,
    }),
  ]);
  await writeJsonLines(join(input.root, "run-lifecycle.jsonl"), [
    lifecycleRecord({
      runId: "run-2",
      taskId: `${input.sourceLog.task.id}-v2`,
      runLogPath: acceptedRunLogPath,
      commit: acceptedRunCommit,
      ...(input.cleanedAt ? { cleanedAt: input.cleanedAt } : {}),
    }),
  ]);
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

  test("creates dispatch-safe report-only follow-up tasks from legacy failed report logs", async () => {
    const root = await makeRoot();
    const reportTask: TaskSpec = {
      ...task,
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      setupCommands: ["bun install"],
      verifyCommands: ["bun run typecheck", "bun test"],
      resultMode: "report",
      expectedCommitSubject: undefined,
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
          setupResults: [],
          evaluation: {
            pass: false,
            harness: { status: "rework", note: "report-only dirty-file blind spot", commit: "" },
            changedFiles: [],
            scopeViolations: [],
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
      taskId: "report-rework-follow-up",
      title: "Inspect report rework",
    });
    const generated = await readTask(result.path ?? "");

    expect(result).toMatchObject({
      status: "created",
      created: true,
      outcome: "rework",
    });
    expect(generated).toMatchObject({
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      setupCommands: [],
      verifyCommands: [],
      resultMode: "report",
    });
    expect(generated.expectedCommitSubject).toBeUndefined();
    expect(validateDispatch(generated, reviewer).violations).toEqual([]);
  });

  test("refuses report-only rework follow-ups superseded by a later clean report-only pass", async () => {
    const root = await makeRoot();
    const sourceLog = reportOnlyReworkLog("dogfood-report-reviewer", "stale report");
    const runLogPath = await writeRunLog(root, sourceLog);
    const cleanLog = {
      ...baseLog({
        task: reportOnlyTask("dogfood-report-reviewer-v2"),
        agent: reviewerAgent(),
        result: baseExecution({
          evaluation: {
            pass: true,
            harness: { status: "pass", note: "clean report", commit: "" },
            changedFiles: [],
            scopeViolations: [],
            verifyResults: [],
          },
          commit: undefined,
          pass: true,
        }),
      }),
      runId: "run-2",
      startedAt: "2026-05-12T10:02:00.000Z",
      finishedAt: "2026-05-12T10:03:00.000Z",
    };
    const cleanLogPath = await writeRunLog(root, cleanLog);
    await writeJsonLines(join(root, "index.jsonl"), [
      runSummary({
        runId: sourceLog.runId,
        taskId: sourceLog.task.id,
        taskTitle: sourceLog.task.title,
        logPath: runLogPath,
        outcome: "rework",
        pass: false,
      }),
      runSummary({
        runId: cleanLog.runId,
        taskId: cleanLog.task.id,
        taskTitle: cleanLog.task.title,
        logPath: cleanLogPath,
        startedAt: cleanLog.startedAt,
        finishedAt: cleanLog.finishedAt,
        outcome: "pass",
        pass: true,
        commit: "",
      }),
    ]);

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "report-superseded-follow-up",
      title: "Inspect superseded report",
    });

    expect(result).toEqual({
      status: "refused",
      created: false,
      runId: sourceLog.runId,
      taskId: "report-superseded-follow-up",
      outcome: "rework",
      recommendedNextAction: "inspect_evidence_then_narrow_or_rerun_with_explicit_reason",
      note: "run run-1 was superseded by clean report-only run run-2; no task was created",
    });
    await expect(readFile(join(root, "references", "tasks", "report-superseded-follow-up.json"), "utf8")).rejects.toThrow();
  });

  test("creates report-only follow-ups when the later report-only pass changed files", async () => {
    const root = await makeRoot();
    const sourceLog = reportOnlyReworkLog("dogfood-report-reviewer", "still needs report follow-up");
    const runLogPath = await writeRunLog(root, sourceLog);
    const dirtyLog = {
      ...baseLog({
        task: reportOnlyTask("dogfood-report-reviewer-v2"),
        agent: reviewerAgent(),
        result: baseExecution({
          evaluation: {
            pass: true,
            harness: { status: "pass", note: "dirty report", commit: "" },
            changedFiles: ["notes.md"],
            scopeViolations: [],
            verifyResults: [],
          },
          commit: undefined,
          pass: true,
        }),
      }),
      runId: "run-2",
      startedAt: "2026-05-12T10:02:00.000Z",
      finishedAt: "2026-05-12T10:03:00.000Z",
    };
    const dirtyLogPath = await writeRunLog(root, dirtyLog);
    await writeJsonLines(join(root, "index.jsonl"), [
      runSummary({
        runId: sourceLog.runId,
        taskId: sourceLog.task.id,
        taskTitle: sourceLog.task.title,
        logPath: runLogPath,
        outcome: "rework",
        pass: false,
      }),
      runSummary({
        runId: dirtyLog.runId,
        taskId: dirtyLog.task.id,
        taskTitle: dirtyLog.task.title,
        logPath: dirtyLogPath,
        startedAt: dirtyLog.startedAt,
        finishedAt: dirtyLog.finishedAt,
        outcome: "pass",
        pass: true,
        commit: "",
      }),
    ]);

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "report-dirty-follow-up",
      title: "Inspect dirty report",
    });
    const generated = await readTask(result.path ?? "");

    expect(result).toMatchObject({
      status: "created",
      created: true,
      outcome: "rework",
    });
    expect(generated).toMatchObject({
      targetAgent: "codex-reviewer",
      targetFiles: [],
      verifyCommands: [],
      resultMode: "report",
    });
  });

  test("refuses blocked writer follow-ups superseded by a later accepted and cleaned family run", async () => {
    const root = await makeRoot();
    const sourceLog = blockedLog("expose-runs-show-lifecycle", "stale blocked run");
    const runLogPath = await writeRunLog(root, sourceLog);
    await writeSupersedingRunEvidence({
      root,
      sourceLog,
      cleanedAt: "2026-05-12T10:04:00.000Z",
    });

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "superseded-follow-up",
      title: "Inspect superseded run",
    });

    expect(result).toEqual({
      status: "refused",
      created: false,
      runId: sourceLog.runId,
      taskId: "superseded-follow-up",
      outcome: "blocked",
      recommendedNextAction: "resolve_blocker_and_rerun_new_task",
      note: "run run-1 was superseded by accepted and cleaned run run-2; no task was created",
    });
    await expect(readFile(join(root, "references", "tasks", "superseded-follow-up.json"), "utf8")).rejects.toThrow();
  });

  test("creates blocked writer follow-ups when the later accepted family run has not been cleaned", async () => {
    const root = await makeRoot();
    const sourceLog = blockedLog("expose-runs-show-lifecycle", "still needs follow-up");
    const runLogPath = await writeRunLog(root, sourceLog);
    await writeSupersedingRunEvidence({ root, sourceLog });

    const result = await createTaskFromRun({
      repoRoot: root,
      runLogPath,
      taskId: "uncleaned-follow-up",
      title: "Inspect uncleaned run",
    });
    const generated = await readTask(result.path ?? "");

    expect(result).toMatchObject({
      status: "created",
      created: true,
      outcome: "blocked",
      recommendedNextAction: "resolve_blocker_and_rerun_new_task",
    });
    expect(generated.instructions).toContain("Resolve the worker-reported blocker");
  });

  test("refuses stale writer follow-ups for non-blocked failures superseded by accepted and cleaned family runs", async () => {
    const cases: Array<{
      name: string;
      sourceLog: WorkerRunLog;
      outcome: RunOutcome;
      recommendedNextAction: RecommendedNextAction;
    }> = [
      {
        name: "verify",
        outcome: "verify_failed",
        recommendedNextAction: "create_rework_task_keep_failed_verify_command",
        sourceLog: baseLog({
          task: { ...task, id: "phase-one-closeout" },
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
        }),
      },
      {
        name: "scope",
        outcome: "scope_failed",
        recommendedNextAction: "reject_output_and_create_narrower_task",
        sourceLog: baseLog({
          task: { ...task, id: "phase-one-closeout" },
          result: baseExecution({
            evaluation: {
              pass: false,
              harness: { status: "pass", note: "ok", commit: "" },
              changedFiles: ["runs/leak.json"],
              scopeViolations: [{ file: "runs/leak.json", reason: "forbidden", matchedPattern: "runs/**" }],
              verifyResults: [],
            },
            commit: undefined,
            pass: false,
          }),
        }),
      },
      {
        name: "setup",
        outcome: "setup_failed",
        recommendedNextAction: "fix_setup_task_or_environment_and_rerun_new_task",
        sourceLog: baseLog({
          task: { ...task, id: "phase-one-closeout", setupCommands: ["bun install --frozen-lockfile"] },
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
      },
      {
        name: "worker",
        outcome: "worker_failed",
        recommendedNextAction: "inspect_evidence_then_narrow_or_rerun_with_explicit_reason",
        sourceLog: baseLog({
          task: { ...task, id: "phase-one-closeout" },
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
      },
      {
        name: "malformed",
        outcome: "missing_harness_result",
        recommendedNextAction: "inspect_evidence_then_narrow_or_rerun_with_explicit_reason",
        sourceLog: baseLog({
          task: { ...task, id: "phase-one-closeout" },
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
        }),
      },
    ];

    for (const item of cases) {
      const root = await makeRoot();
      const runLogPath = await writeRunLog(root, item.sourceLog);
      await writeSupersedingRunEvidence({
        root,
        sourceLog: item.sourceLog,
        cleanedAt: "2026-05-12T10:04:00.000Z",
      });

      const result = await createTaskFromRun({
        repoRoot: root,
        runLogPath,
        taskId: `${item.name}-superseded-follow-up`,
        title: "Inspect superseded run",
      });

      expect(result).toEqual({
        status: "refused",
        created: false,
        runId: item.sourceLog.runId,
        taskId: `${item.name}-superseded-follow-up`,
        outcome: item.outcome,
        recommendedNextAction: item.recommendedNextAction,
        note: "run run-1 was superseded by accepted and cleaned run run-2; no task was created",
      });
      await expect(
        readFile(join(root, "references", "tasks", `${item.name}-superseded-follow-up.json`), "utf8"),
      ).rejects.toThrow();
    }
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
