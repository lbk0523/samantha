import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { diagnoseRun, diagnoseWorkerRun } from "../src/core/run-diagnose";
import type { WorkerRunLog } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "diagnose-fixture",
  title: "Diagnose fixture",
  taskFamily: "core-module",
  workMode: "diagnosis-first",
  riskClass: "routine",
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

function commandResult(exitCode = 0, stderr = "") {
  return { command: ["codex", "exec"], exitCode, stdout: "", stderr };
}

function baseExecution(overrides: Partial<WorkerDispatchExecution> = {}): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: task.id,
      agentId: agent.id,
      worktreePath: "/repo/worktrees/diagnose-fixture",
      codex: { prompt: "prompt", command: ["codex", "exec"] },
    },
    setupResults: [],
    command: commandResult(),
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

function baseLog(overrides: {
  task?: TaskSpec;
  agent?: AgentProfile;
  result?: WorkerDispatchExecution;
} = {}): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId: "diagnose-run",
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    task: overrides.task ?? task,
    agent: overrides.agent ?? agent,
    input: { repoRoot: "/repo", worktreesDir: "worktrees" },
    result: overrides.result ?? baseExecution(),
  };
}

async function writeRunLog(log: WorkerRunLog): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-diagnose-"));
  tmpRoots.push(root);
  const path = join(root, "run.json");
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return path;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("diagnoseRun", () => {
  test("reads a passing writer run log and recommends accept", async () => {
    const logPath = await writeRunLog(baseLog());

    await expect(diagnoseRun({ runLogPath: logPath })).resolves.toEqual({
      outcome: "pass",
      trustedWorkerOutput: true,
      recommendedNextAction: "runs:accept",
    });
  });

  test("reports passing report-only runs as evidence instead of mergeable work", () => {
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

    expect(
      diagnoseWorkerRun(
        baseLog({
          task: reportTask,
          agent: reviewer,
          result: baseExecution({
            evaluation: {
              pass: true,
              harness: { status: "pass", note: "report", commit: "a".repeat(40) },
              changedFiles: [],
              scopeViolations: [],
              verifyResults: [],
            },
            commit: undefined,
            pass: true,
          }),
        }),
        "/repo/runs/report.json",
      ),
    ).toEqual({
      outcome: "pass",
      trustedWorkerOutput: true,
      recommendedNextAction: "record_report_evidence_do_not_merge",
    });
  });

  test("classifies setup failures as task or environment fixes", () => {
    const diagnosis = diagnoseWorkerRun(
      baseLog({
        result: baseExecution({
          setupResults: [{ command: ["bash", "-lc", "bun install"], exitCode: 1, stdout: "", stderr: "" }],
          command: undefined,
          evaluation: undefined,
          commit: undefined,
          pass: false,
        }),
      }),
      "/repo/runs/setup.json",
    );

    expect(diagnosis).toEqual({
      outcome: "setup_failed",
      failureReason: "setup command failed (1): bash -lc bun install",
      trustedWorkerOutput: false,
      recommendedNextAction: "fix_setup_task_or_environment_and_rerun_new_task",
    });
  });

  test("routes worker command failures and malformed harness results to evidence inspection", () => {
    expect(
      diagnoseWorkerRun(
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
        "/repo/runs/worker-failed.json",
      ),
    ).toEqual({
      outcome: "worker_failed",
      failureReason: "worker command failed (7)",
      trustedWorkerOutput: false,
      recommendedNextAction: "inspect_evidence_then_narrow_or_rerun_with_explicit_reason",
    });

    expect(
      diagnoseWorkerRun(
        baseLog({
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
        "/repo/runs/malformed.json",
      ),
    ).toEqual({
      outcome: "missing_harness_result",
      failureReason: "invalid HARNESS_RESULT JSON",
      trustedWorkerOutput: false,
      recommendedNextAction: "inspect_evidence_then_narrow_or_rerun_with_explicit_reason",
    });
  });

  test("maps scope, verify, and commit failures to distinct local actions", () => {
    expect(
      diagnoseWorkerRun(
        baseLog({
          result: baseExecution({
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
        }),
        "/repo/runs/scope.json",
      ),
    ).toEqual({
      outcome: "scope_failed",
      failureReason: "1 scope violation(s)",
      trustedWorkerOutput: false,
      recommendedNextAction: "reject_output_and_create_narrower_task",
    });

    expect(
      diagnoseWorkerRun(
        baseLog({
          result: baseExecution({
            evaluation: {
              pass: false,
              harness: { status: "pass", note: "ok", commit: "" },
              changedFiles: ["allowed.txt"],
              scopeViolations: [],
              verifyResults: [{ command: "bun test tests/run-diagnose.test.ts", exitCode: 1, stdout: "", stderr: "" }],
            },
            commit: undefined,
            pass: false,
          }),
        }),
        "/repo/runs/verify.json",
      ),
    ).toEqual({
      outcome: "verify_failed",
      failureReason: "verify command failed (1): bun test tests/run-diagnose.test.ts",
      trustedWorkerOutput: false,
      recommendedNextAction: "create_rework_task_keep_failed_verify_command",
    });

    expect(
      diagnoseWorkerRun(
        baseLog({
          result: baseExecution({
            commit: {
              subject: "feat: worker change",
              files: ["allowed.txt"],
              add: { command: ["git", "add", "--", "allowed.txt"], exitCode: 0, stdout: "", stderr: "" },
              commit: {
                command: ["git", "commit", "-m", "feat: worker change"],
                exitCode: 1,
                stdout: "",
                stderr: "nothing to commit",
              },
              commitHash: "",
            },
            pass: false,
          }),
        }),
        "/repo/runs/commit.json",
      ),
    ).toEqual({
      outcome: "commit_failed",
      failureReason: "git commit failed (1): nothing to commit",
      trustedWorkerOutput: false,
      recommendedNextAction: "inspect_locally_do_not_trust_worker_lifecycle",
    });
  });
});
