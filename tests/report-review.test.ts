import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AgentProfile, TaskSpec, WorktreeAllocation } from "../src/core/contracts";
import {
  summarizeReportOnlyReviews,
  summarizeReportReviewLog,
} from "../src/core/report-review";
import type { WorkerRunLog } from "../src/core/run-log";
import type { WorkerCommitResult, WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const reportTask: TaskSpec = {
  id: "review-fixture",
  title: "Review fixture evidence",
  taskFamily: "report-review",
  workMode: "diagnosis-first",
  riskClass: "routine",
  targetAgent: "codex-reviewer",
  targetFiles: [],
  forbiddenChanges: ["**/*"],
  setupCommands: [],
  verifyCommands: [],
  instructions: "Review evidence and report only.",
  resultMode: "report",
  status: "pending",
};

const reviewer: AgentProfile = {
  id: "codex-reviewer",
  role: "reviewer",
  model: "gpt-5.5",
  writerClass: "non-writer",
  worktreePolicy: "none",
  mergePolicy: "none",
  skillPolicy: {
    requiredBundles: [],
    blockedSkills: [
      "using-git-worktrees",
      "dispatching-parallel-agents",
      "subagent-driven-development",
    ],
  },
};

function reportExecution(runId: string, stdout: string): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: reportTask.id,
      agentId: reviewer.id,
      worktreePath: "/repo",
      codex: {
        prompt: "prompt",
        command: ["codex", "exec"],
      },
    },
    setupResults: [],
    command: {
      command: ["codex", "exec"],
      exitCode: 0,
      stdout,
      stderr: "",
    },
    evaluation: {
      pass: true,
      harness: {
        status: "pass",
        note: `${runId} report complete`,
        commit: "",
      },
      changedFiles: [],
      scopeViolations: [],
      verifyResults: [],
    },
    pass: true,
  };
}

function reportLog(runId: string, stdout: string): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId,
    startedAt: "2026-05-13T00:00:00.000Z",
    finishedAt: "2026-05-13T00:01:00.000Z",
    task: reportTask,
    agent: reviewer,
    input: {
      repoRoot: "/repo",
    },
    result: reportExecution(runId, stdout),
  };
}

async function writeRunLog(root: string, log: WorkerRunLog): Promise<string> {
  const path = join(root, `${log.runId}.json`);
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return path;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("report review summary", () => {
  test("summarizes multiple report-only runs into one Samantha decision point", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-report-review-"));
    tmpRoots.push(root);
    const first = await writeRunLog(
      root,
      reportLog(
        "review-a",
        'Finding A: policy boundary is clear.\nHARNESS_RESULT: {"status":"pass","note":"ok","commit":""}',
      ),
    );
    const second = await writeRunLog(root, reportLog("review-b", "Finding B: add a focused test."));

    const summary = await summarizeReportOnlyReviews({ runLogPaths: [first, second] });

    expect(summary).toMatchObject({
      schemaVersion: 1,
      runLogPaths: [resolve(first), resolve(second)],
      runCount: 2,
      acceptedReportCount: 2,
      rejectedReportCount: 0,
      decisionPoint: {
        owner: "samantha",
        reviewerAuthority: "advice-only",
        trustedStateChanges: false,
        recommendation: "review_reports",
      },
    });
    expect(summary.reports.map((report) => report.status)).toEqual(["accepted", "accepted"]);
    expect(summary.reports[0]?.outputExcerpt).toBe("Finding A: policy boundary is clear.");
    expect(summary.reports[1]?.outputExcerpt).toBe("Finding B: add a focused test.");
  });

  test("rejects run evidence that crosses report-only boundaries", () => {
    const log = reportLog("review-with-writes", "I changed files.");
    const allocation: WorktreeAllocation = {
      taskId: "review-with-writes",
      repoRoot: "/repo",
      worktreePath: "/repo/worktrees/review-with-writes",
      branch: "samantha/review-with-writes",
      baseCommit: "a".repeat(40),
    };
    const commit: WorkerCommitResult = {
      subject: "test: illegal reviewer commit",
      files: ["README.md"],
      add: {
        command: ["git", "add", "--", "README.md"],
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
      commit: {
        command: ["git", "commit", "-m", "test: illegal reviewer commit"],
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
      commitHash: "b".repeat(40),
    };
    log.result.preparation.allocation = allocation;
    log.result.setupResults = [
      {
        command: ["bash", "-lc", "bun install"],
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
    ];
    log.result.evaluation!.changedFiles = ["README.md"];
    log.result.evaluation!.scopeViolations = [
      {
        file: "README.md",
        reason: "forbidden",
        matchedPattern: "**/*",
      },
    ];
    log.result.evaluation!.verifyResults = [
      {
        command: "bun test",
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
    ];
    log.result.commit = commit;

    const summary = summarizeReportReviewLog(log);

    expect(summary.status).toBe("rejected");
    expect(summary.violations).toEqual([
      "report-only run allocated a worktree",
      "report-only run executed setup commands",
      "report-only run executed verify commands",
      "report-only run changed files",
      "report-only run has scope violations",
      "report-only run created a commit",
    ]);
  });

  test("rejects writer run evidence instead of treating it as reviewer advice", () => {
    const log = reportLog("writer-run", "Writer output.");
    log.task = {
      ...reportTask,
      targetAgent: "codex-worker",
      resultMode: "write",
    };
    log.agent = {
      ...reviewer,
      id: "codex-worker",
      role: "writer",
      writerClass: "writer",
      worktreePolicy: "per-task",
      mergePolicy: "samantha-controlled",
    };

    expect(summarizeReportReviewLog(log)).toMatchObject({
      status: "rejected",
      violations: ["task resultMode is not report", "agent writerClass is not non-writer"],
    });
  });

  test("rejects incomplete report-only runs instead of promoting weak evidence", () => {
    const log = reportLog("failed-report", "");
    log.result.command = undefined;
    log.result.evaluation = undefined;
    log.result.pass = false;

    expect(summarizeReportReviewLog(log)).toMatchObject({
      status: "rejected",
      violations: [
        "report-only run did not pass Samantha evaluation",
        "report-only run did not produce reviewer output",
      ],
    });
  });

  test("requires at least one run log path", async () => {
    await expect(summarizeReportOnlyReviews({ runLogPaths: [] })).rejects.toThrow(
      "reports:summarize requires at least one --run-log",
    );
  });
});
