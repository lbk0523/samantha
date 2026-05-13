import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { draftLessonFromRunLog } from "../src/core/lesson-draft";
import type { RunSummary } from "../src/core/ledger";
import type { RunLifecycleRecord } from "../src/core/run-lifecycle-store";
import { buildWorkerRunLog, type WorkerRunLog } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "lesson-fixture",
  title: "Draft lesson fixture",
  targetAgent: "codex-worker",
  targetFiles: ["src/allowed.ts", "tests/allowed.test.ts"],
  forbiddenChanges: ["docs/**"],
  setupCommands: [],
  verifyCommands: ["bun test tests/allowed.test.ts"],
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

function execution(overrides: Partial<WorkerDispatchExecution> = {}): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: task.id,
      agentId: agent.id,
      worktreePath: "/tmp/samantha-worktree",
      codex: {
        prompt: "prompt",
        command: ["codex", "exec"],
      },
    },
    setupResults: [],
    command: {
      command: ["codex", "exec"],
      exitCode: 0,
      stdout: 'HARNESS_RESULT: {"status":"pass","note":"ok","commit":""}',
      stderr: "",
    },
    evaluation: {
      pass: true,
      harness: {
        status: "pass",
        note: "ok",
        commit: "",
      },
      changedFiles: ["src/allowed.ts", "tests/allowed.test.ts"],
      scopeViolations: [],
      verifyResults: [
        {
          command: "bun test tests/allowed.test.ts",
          exitCode: 0,
          stdout: "",
          stderr: "",
        },
      ],
    },
    commit: {
      subject: "test: lesson fixture",
      files: ["src/allowed.ts", "tests/allowed.test.ts"],
      add: {
        command: ["git", "add", "--", "src/allowed.ts", "tests/allowed.test.ts"],
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
      commit: {
        command: ["git", "commit", "-m", "test: lesson fixture"],
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
      commitHash: "a".repeat(40),
    },
    pass: true,
    ...overrides,
  };
}

async function writeRunLog(root: string, log: WorkerRunLog): Promise<string> {
  const runLogPath = join(root, "runs", `${log.runId}.json`);
  await mkdir(join(root, "runs"), { recursive: true });
  await writeFile(runLogPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return runLogPath;
}

async function writeJsonLines<T>(path: string, items: T[]): Promise<void> {
  await writeFile(path, `${items.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

function runSummary(log: WorkerRunLog, logPath: string, overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    schemaVersion: 1,
    runId: log.runId,
    taskId: log.task.id,
    taskTitle: log.task.title,
    agentId: log.agent.id,
    repoRoot: "/repo",
    worktreePath: log.result.preparation.worktreePath,
    logPath,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    outcome: log.result.pass ? "pass" : "blocked",
    pass: log.result.pass,
    commit: log.result.commit?.commitHash ?? "",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("lesson drafts", () => {
  test("writes a deterministic markdown candidate under the lesson inbox", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-"));
    tmpRoots.push(root);
    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution: execution(),
    });
    const runLogPath = await writeRunLog(root, log);
    await writeFile(
      join(root, "runs", "run-lifecycle.jsonl"),
      `${JSON.stringify({
        schemaVersion: 1,
        runId: log.runId,
        taskId: task.id,
        repoRoot: "/repo",
        runLogPath,
        commit: "a".repeat(40),
        mergedAt: "2026-05-12T10:02:00.000Z",
        cleanedAt: "2026-05-12T10:03:00.000Z",
        updatedAt: "2026-05-12T10:03:00.000Z",
      })}\n`,
      "utf8",
    );

    const draft = await draftLessonFromRunLog({ runLogPath, repoRoot: root });
    const markdown = await readFile(draft.path, "utf8");

    expect(draft).toEqual({
      path: join(root, "references", "lessons", "inbox", `${log.runId}.md`),
      runId: log.runId,
    });
    expect(markdown).toContain(`# Lesson Candidate: ${log.runId}`);
    expect(markdown).toContain(`- Source run id: ${log.runId}`);
    expect(markdown).toContain("- Task id: lesson-fixture");
    expect(markdown).toContain("- Observed outcome: pass");
    expect(markdown).toContain("- `src/allowed.ts`");
    expect(markdown).toContain("- `tests/allowed.test.ts`");
    expect(markdown).toContain("- 1 passed, 0 failed");
    expect(markdown).toContain("- `bun test tests/allowed.test.ts` -> pass (0)");
    expect(markdown).toContain("- Lifecycle state: merged and cleaned");
    expect(markdown).toContain("- Superseded status: not detected");
    expect(markdown).toContain("- Affected layer: playbook");
    expect(markdown).toContain("- Suggested artifact type: playbook");
    expect(markdown).toContain("Review manually before promotion.");
  });

  test("classifies verification failures without lifecycle records", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-"));
    tmpRoots.push(root);
    const log = buildWorkerRunLog({
      task,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution: execution({
        evaluation: {
          pass: false,
          harness: {
            status: "pass",
            note: "ok",
            commit: "",
          },
          changedFiles: ["src/allowed.ts"],
          scopeViolations: [],
          verifyResults: [
            {
              command: "bun test tests/allowed.test.ts",
              exitCode: 1,
              stdout: "",
              stderr: "missing assertion",
            },
          ],
        },
        commit: undefined,
        pass: false,
      }),
    });
    const runLogPath = await writeRunLog(root, log);

    const draft = await draftLessonFromRunLog({ runLogPath, repoRoot: root });
    const markdown = await readFile(draft.path, "utf8");

    expect(markdown).toContain("- Observed outcome: verify_failed");
    expect(markdown).toContain("- Lifecycle state: not recorded");
    expect(markdown).toContain("- Proposed lesson: Add or adjust focused verification before dispatching similar tasks.");
    expect(markdown).toContain("- Affected layer: task template");
    expect(markdown).toContain("- Suggested artifact type: task template or playbook");
    expect(markdown).toContain("- Risk if adopted: Overfitting to one verification failure can make future tasks slower without reducing real risk.");
  });

  test("marks blocked writer candidates as stale when a later family run was accepted and cleaned", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lesson-"));
    tmpRoots.push(root);
    const sourceTask: TaskSpec = {
      ...task,
      id: "expose-runs-show-lifecycle",
      title: "Expose lifecycle evidence in runs show",
    };
    const acceptedTask: TaskSpec = {
      ...sourceTask,
      id: "expose-runs-show-lifecycle-v2",
    };
    const sourceLog = buildWorkerRunLog({
      task: sourceTask,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      execution: execution({
        evaluation: {
          pass: false,
          harness: {
            status: "blocked",
            note: "typecheck blocked by missing @types/bun",
            commit: "",
          },
          changedFiles: ["src/allowed.ts"],
          scopeViolations: [],
          verifyResults: [],
        },
        commit: undefined,
        pass: false,
      }),
    });
    const acceptedLog = buildWorkerRunLog({
      task: acceptedTask,
      agent,
      repoRoot: "/repo",
      startedAt: "2026-05-12T10:02:00.000Z",
      finishedAt: "2026-05-12T10:03:00.000Z",
      execution: execution({
        commit: {
          ...execution().commit!,
          commitHash: "b".repeat(40),
        },
      }),
    });
    const sourceRunLogPath = await writeRunLog(root, sourceLog);
    const acceptedRunLogPath = await writeRunLog(root, acceptedLog);
    const lifecycle: RunLifecycleRecord = {
      schemaVersion: 1,
      runId: acceptedLog.runId,
      taskId: acceptedTask.id,
      repoRoot: "/repo",
      runLogPath: acceptedRunLogPath,
      commit: "b".repeat(40),
      mergedAt: "2026-05-12T10:04:00.000Z",
      cleanedAt: "2026-05-12T10:05:00.000Z",
      updatedAt: "2026-05-12T10:05:00.000Z",
    };
    await writeJsonLines(join(root, "runs", "index.jsonl"), [
      runSummary(sourceLog, sourceRunLogPath, {
        outcome: "blocked",
        pass: false,
        failureReason: "typecheck blocked by missing @types/bun",
      }),
      runSummary(acceptedLog, acceptedRunLogPath, {
        outcome: "pass",
        pass: true,
        commit: "b".repeat(40),
      }),
    ]);
    await writeJsonLines(join(root, "runs", "run-lifecycle.jsonl"), [lifecycle]);

    const draft = await draftLessonFromRunLog({ runLogPath: sourceRunLogPath, repoRoot: root });
    const markdown = await readFile(draft.path, "utf8");

    expect(markdown).toContain("- Observed outcome: blocked");
    expect(markdown).toContain("- Superseded status: superseded by accepted and cleaned run");
    expect(markdown).toContain(`- Superseding run id: ${acceptedLog.runId}`);
    expect(markdown).toContain("- Superseding task id: expose-runs-show-lifecycle-v2");
    expect(markdown).toContain("- Superseding lifecycle state: merged and cleaned");
    expect(markdown).toContain("- Proposed lesson: Treat this candidate as stale unless the same failure recurs after the superseding run.");
    expect(markdown).toContain("- Affected layer: evidence");
    expect(markdown).toContain("- Suggested artifact type: run summary / no promotion");
    expect(markdown).not.toContain("- Proposed lesson: Clarify the task contract before dispatching similar work.");
  });
});
