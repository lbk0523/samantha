import { describe, expect, test } from "bun:test";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import {
  buildRunVisibilitySummary,
  type RunVisibilitySummary,
} from "../src/core/run-visibility";
import type { WorkerRunLog, WorkerRunTrajectoryEntry } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";
import type { ScopeViolation, VerifyCommandResult } from "../src/core/worker-result";

const task: TaskSpec = {
  id: "run-visibility-fixture",
  title: "Run visibility fixture",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "authority-sensitive",
  targetAgent: "codex-worker",
  targetFiles: ["src/core/run-visibility.ts", "tests/run-visibility.test.ts"],
  forbiddenChanges: ["runs/**"],
  verifyCommands: ["bun test tests/run-visibility.test.ts"],
  instructions: "Fixture only.",
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

function verifyResult(exitCode: number): VerifyCommandResult {
  return {
    command: "bun test tests/run-visibility.test.ts",
    exitCode,
    stdout: "",
    stderr: "",
  };
}

function trajectoryEntry(
  sequence: number,
  event: WorkerRunTrajectoryEntry["event"],
  status: WorkerRunTrajectoryEntry["status"],
  details?: WorkerRunTrajectoryEntry["details"],
): WorkerRunTrajectoryEntry {
  return {
    sequence,
    event,
    status,
    note: `${event} fixture`,
    ...(details ? { details } : {}),
  };
}

function execution(overrides: Partial<WorkerDispatchExecution> = {}): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: task.id,
      agentId: agent.id,
      worktreePath: "/repo/worktrees/run-visibility-fixture",
      codex: {
        prompt: "prompt",
        command: ["codex", "exec"],
      },
    },
    setupResults: [],
    command: {
      command: ["codex", "exec"],
      exitCode: 0,
      stdout: 'HARNESS_RESULT: {"status":"pass","note":"ok"}',
      stderr: "",
    },
    runtime: {
      kind: "codex-sdk",
      approvalPolicy: "never",
      threadId: "thread_run_visibility",
    },
    evaluation: {
      pass: true,
      harness: {
        status: "pass",
        note: "ok",
        commit: "",
      },
      changedFiles: ["src/core/run-visibility.ts", "tests/run-visibility.test.ts"],
      scopeViolations: [],
      verifyResults: [verifyResult(0)],
    },
    commit: {
      subject: "feat: add run visibility projection helper",
      files: ["src/core/run-visibility.ts", "tests/run-visibility.test.ts"],
      add: {
        command: ["git", "add", "--", "src/core/run-visibility.ts", "tests/run-visibility.test.ts"],
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
      commit: {
        command: ["git", "commit", "-m", "feat: add run visibility projection helper"],
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

function runLog(input: {
  result?: Partial<WorkerDispatchExecution>;
  trajectory?: WorkerRunTrajectoryEntry[];
} = {}): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId: "run-visibility-fixture",
    startedAt: "2026-05-30T10:00:00.000Z",
    finishedAt: "2026-05-30T10:01:00.000Z",
    task,
    agent,
    input: {
      repoRoot: "/repo",
    },
    trajectory:
      input.trajectory ??
      [
        trajectoryEntry(1, "merge_checked", "completed"),
        trajectoryEntry(2, "merge_finished", "completed"),
        trajectoryEntry(3, "cleanup_finished", "completed"),
      ],
    result: execution(input.result),
  };
}

function summary(input: Parameters<typeof runLog>[0] = {}): RunVisibilitySummary {
  return buildRunVisibilitySummary(runLog(input));
}

describe("buildRunVisibilitySummary", () => {
  test("projects a passing run without treating advisory thread id as trusted completion", () => {
    expect(summary()).toMatchObject({
      threadNavigation: {
        status: "available",
        threadId: "thread_run_visibility",
      },
      harnessStatus: "pass",
      topLevelPass: true,
      candidateCommitStatus: "present",
      candidateCommitHash: "a".repeat(40),
      scopeStatus: "in_scope",
      changedFileCount: 2,
      scopeViolationCount: 0,
      verificationStatus: "passed",
      verificationResultCount: 1,
      mergeStatus: "completed",
      cleanupStatus: "completed",
      finalGitStatus: "not_captured",
    });
  });

  test("keeps HARNESS_RESULT pass separate from top-level pass and candidate commit", () => {
    const result = execution({
      pass: false,
      commit: undefined,
    });

    expect(buildRunVisibilitySummary(runLog({ result }))).toMatchObject({
      harnessStatus: "pass",
      topLevelPass: false,
      candidateCommitStatus: "missing",
      candidateCommitHash: null,
    });
  });

  test("reports scope violations independently of verification and commits", () => {
    const violation: ScopeViolation = {
      file: "runs/leak.json",
      reason: "forbidden",
      matchedPattern: "runs/**",
    };

    expect(
      summary({
        result: {
          evaluation: {
            pass: false,
            harness: {
              status: "pass",
              note: "worker claimed pass",
              commit: "",
            },
            changedFiles: ["runs/leak.json"],
            scopeViolations: [violation],
            verifyResults: [verifyResult(0)],
          },
        },
      }),
    ).toMatchObject({
      harnessStatus: "pass",
      candidateCommitStatus: "present",
      scopeStatus: "violations",
      changedFileCount: 1,
      scopeViolationCount: 1,
      verificationStatus: "passed",
    });
  });

  test("reports verification failure from verify results", () => {
    expect(
      summary({
        result: {
          evaluation: {
            pass: false,
            harness: {
              status: "pass",
              note: "worker claimed pass",
              commit: "",
            },
            changedFiles: ["src/core/run-visibility.ts"],
            scopeViolations: [],
            verifyResults: [verifyResult(1)],
          },
        },
      }),
    ).toMatchObject({
      harnessStatus: "pass",
      verificationStatus: "failed",
      verificationResultCount: 1,
    });
  });

  test("reports missing verification results without inferring success from pass or commit", () => {
    expect(
      summary({
        result: {
          evaluation: {
            pass: true,
            harness: {
              status: "pass",
              note: "worker claimed pass",
              commit: "",
            },
            changedFiles: ["src/core/run-visibility.ts"],
            scopeViolations: [],
            verifyResults: [],
          },
        },
      }),
    ).toMatchObject({
      topLevelPass: true,
      candidateCommitStatus: "present",
      verificationStatus: "missing",
      verificationResultCount: 0,
    });
  });

  test("distinguishes merge checked from merge completed", () => {
    expect(
      summary({
        trajectory: [trajectoryEntry(1, "merge_checked", "completed")],
      }),
    ).toMatchObject({
      mergeStatus: "checked",
      cleanupStatus: "not_started",
    });
  });

  test("does not infer cleanup completion from merge completion", () => {
    expect(
      summary({
        trajectory: [
          trajectoryEntry(1, "merge_checked", "completed"),
          trajectoryEntry(2, "merge_finished", "completed"),
        ],
      }),
    ).toMatchObject({
      mergeStatus: "completed",
      cleanupStatus: "not_started",
    });
  });

  test("preserves blocked and rework harness statuses", () => {
    expect(
      summary({
        result: {
          pass: false,
          evaluation: {
            pass: false,
            harness: {
              status: "blocked",
              note: "blocked",
              commit: "",
            },
            changedFiles: [],
            scopeViolations: [],
            verifyResults: [],
          },
        },
        trajectory: [],
      }),
    ).toMatchObject({
      harnessStatus: "blocked",
      topLevelPass: false,
      mergeStatus: "not_started",
      cleanupStatus: "not_started",
    });

    expect(
      summary({
        result: {
          pass: false,
          evaluation: {
            pass: false,
            harness: {
              status: "rework",
              note: "needs rework",
              commit: "",
            },
            changedFiles: [],
            scopeViolations: [],
            verifyResults: [],
          },
        },
        trajectory: [],
      }),
    ).toMatchObject({
      harnessStatus: "rework",
      topLevelPass: false,
    });
  });

  test("reports final git status as not captured when no trajectory evidence exists", () => {
    expect(summary({ trajectory: [] }).finalGitStatus).toBe("not_captured");
  });

  test("does not infer final git status from merge and cleanup trajectory alone", () => {
    expect(summary().finalGitStatus).toBe("not_captured");
  });

  test("projects clean final git status from completed trajectory evidence", () => {
    expect(
      summary({
        trajectory: [
          trajectoryEntry(1, "merge_checked", "completed"),
          trajectoryEntry(2, "final_git_status_captured", "completed", {
            finalGitStatus: "clean",
          }),
        ],
      }).finalGitStatus,
    ).toBe("clean");
  });

  test("projects dirty final git status from the latest completed trajectory evidence", () => {
    expect(
      summary({
        trajectory: [
          trajectoryEntry(1, "final_git_status_captured", "completed", {
            finalGitStatus: "clean",
          }),
          trajectoryEntry(2, "final_git_status_captured", "completed", {
            finalGitStatus: "dirty",
          }),
        ],
      }).finalGitStatus,
    ).toBe("dirty");
  });

  test("projects unavailable for malformed or failed final git status evidence", () => {
    expect(
      summary({
        trajectory: [
          trajectoryEntry(1, "final_git_status_captured", "completed", {
            finalGitStatus: "pristine",
          }),
        ],
      }).finalGitStatus,
    ).toBe("unavailable");

    expect(
      summary({
        trajectory: [
          trajectoryEntry(1, "final_git_status_captured", "failed", {
            finalGitStatus: "clean",
          }),
        ],
      }).finalGitStatus,
    ).toBe("unavailable");
  });

  test("keeps thread id advisory and separate from final git status", () => {
    expect(
      summary({
        result: {
          runtime: {
            kind: "codex-sdk",
            approvalPolicy: "never",
            threadId: "thread_with_no_git_status_authority",
          },
        },
        trajectory: [],
      }),
    ).toMatchObject({
      threadNavigation: {
        status: "available",
        threadId: "thread_with_no_git_status_authority",
      },
      finalGitStatus: "not_captured",
    });
  });
});
