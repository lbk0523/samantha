import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";
import { RunIndex, type RunSummary } from "../src/core/ledger";
import { buildReadinessReport, summarizeInitiativeBrief } from "../src/core/readiness";
import type { WorkerRunLog } from "../src/core/run-log";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "readiness-fixture",
  title: "Readiness fixture",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "lifecycle-sensitive",
  targetAgent: "codex-worker",
  targetFiles: ["src/example.ts", "tests/example.test.ts"],
  forbiddenChanges: ["runs/**", "worktrees/**"],
  setupCommands: [],
  verifyCommands: ["bun test tests/example.test.ts"],
  instructions: "Make the focused fixture change.",
  expectedCommitSubject: "feat: add readiness fixture",
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

function initiativeMarkdown(currentNext = "Start S2."): string {
  return `# Initiative: readiness fixture

Status: active
Source: test fixture

## Goal

Keep multi-session work coherent.

## Accepted Decisions

- Use a parent artifact.

## Non-Goals

- No dashboard.

## Invariants

- Do not bypass verification.

## Slice Queue

| Slice | Status | Objective | Depends on | Verification | Next prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | completed | Seed continuity. | none | docs check passed. | n/a |
| S2 | ready | Implement readiness. | S1 | focused tests. | prompt |
| S3 | pending | Dogfood readiness. | S2 | CLI check. | later |

## Current Next Slice

${currentNext}

## End-of-Session Update Rule

Update status and next slice.

## Completion Rule

All slices completed and verified.
`;
}

function runLog(verifyExitCode = 0): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId: "readiness-run",
    startedAt: "2026-05-15T10:00:00.000Z",
    finishedAt: "2026-05-15T10:01:00.000Z",
    task,
    agent,
    input: { repoRoot: "/repo", worktreesDir: "worktrees" },
    result: {
      preparation: {
        taskId: task.id,
        agentId: agent.id,
        worktreePath: "/repo/worktrees/readiness-fixture",
        codex: { prompt: "prompt", command: ["codex", "exec"] },
      },
      setupResults: [],
      command: { command: ["codex", "exec"], exitCode: 0, stdout: "", stderr: "" },
      evaluation: {
        pass: verifyExitCode === 0,
        harness: { status: "pass", note: "ok", commit: "" },
        changedFiles: ["src/example.ts", "tests/example.test.ts"],
        scopeViolations: [],
        verifyResults: [
          {
            command: "bun test tests/example.test.ts",
            exitCode: verifyExitCode,
            stdout: "",
            stderr: verifyExitCode === 0 ? "" : "failed",
          },
        ],
      },
      commit: {
        subject: "feat: add readiness fixture",
        files: ["src/example.ts", "tests/example.test.ts"],
        add: { command: ["git", "add", "--", "src/example.ts"], exitCode: 0, stdout: "", stderr: "" },
        commit: { command: ["git", "commit", "-m", "feat: add readiness fixture"], exitCode: 0, stdout: "", stderr: "" },
        commitHash: "a".repeat(40),
      },
      pass: verifyExitCode === 0,
    },
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function initReadinessRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-readiness-repo-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  return root;
}

async function commitReadinessFixture(root: string, subject: string): Promise<string> {
  await writeFile(join(root, "fixture.txt"), `${subject}\n`, "utf8");
  await git(["add", "fixture.txt"], root);
  await git(["commit", "-m", subject], root);
  return gitHead(root);
}

async function writeReadinessBaseline(
  root: string,
  commits: Array<{ commit: string; subject: string }>,
): Promise<void> {
  await mkdir(join(root, "references", "operations"), { recursive: true });
  await writeJson(join(root, "references", "operations", "evidence-baseline.json"), {
    schemaVersion: 1,
    reviewedAt: "2026-05-15T10:00:00.000Z",
    reason:
      "Test baseline closes only historical pre-audit evidence gaps and does not fabricate run logs.",
    commits,
  });
}

function readinessRunSummary(root: string, runId: string, commit: string): RunSummary {
  return {
    schemaVersion: 1,
    runId,
    taskId: runId,
    taskTitle: `Task ${runId}`,
    agentId: "codex-worker",
    repoRoot: root,
    worktreePath: join(root, "worktrees", runId),
    logPath: join(root, "runs", `${runId}.json`),
    startedAt: "2026-05-15T10:00:00.000Z",
    finishedAt: "2026-05-15T10:01:00.000Z",
    outcome: "pass",
    pass: true,
    commit,
  };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("readiness", () => {
  test("summarizes an initiative with a single ready next slice", () => {
    const summary = summarizeInitiativeBrief({
      path: "/repo/references/initiatives/readiness.md",
      markdown: initiativeMarkdown(),
    });

    expect(summary.title).toBe("readiness fixture");
    expect(summary.currentSlice?.slice).toBe("S2");
    expect(summary.checks.every((check) => check.status === "clear")).toBe(true);
  });

  test("marks the current next slice stale when it points at the wrong slice", () => {
    const summary = summarizeInitiativeBrief({
      path: "/repo/references/initiatives/readiness.md",
      markdown: initiativeMarkdown("Start S3."),
    });

    expect(summary.checks).toContainEqual(
      expect.objectContaining({
        id: "initiative.current-next-slice",
        status: "stale",
      }),
    );
  });

  test("audits a task spec against passing run evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-readiness-"));
    tmpRoots.push(root);
    await mkdir(join(root, "references", "tasks"), { recursive: true });
    await mkdir(join(root, "runs"), { recursive: true });
    const taskPath = join(root, "references", "tasks", "readiness-fixture.json");
    const runLogPath = join(root, "runs", "readiness-run.json");
    await writeJson(taskPath, task);
    await writeJson(runLogPath, runLog());

    const report = await buildReadinessReport({ taskPath, runLogPath });

    expect(report.overallStatus).toBe("clear");
    expect(report.planCompletion?.status).toBe("clear");
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: "plan.verification",
        status: "clear",
      }),
    );
  });

  test("reports missing run evidence for a task spec", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-readiness-"));
    tmpRoots.push(root);
    await mkdir(join(root, "references", "tasks"), { recursive: true });
    const taskPath = join(root, "references", "tasks", "readiness-fixture.json");
    await writeJson(taskPath, task);

    const report = await buildReadinessReport({ taskPath });

    expect(report.overallStatus).toBe("missing");
    expect(report.planCompletion?.checks).toContainEqual(
      expect.objectContaining({
        id: "plan.run-evidence",
        status: "missing",
      }),
    );
  });

  test("blocks readiness when declared verification failed", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-readiness-"));
    tmpRoots.push(root);
    await mkdir(join(root, "references", "tasks"), { recursive: true });
    await mkdir(join(root, "runs"), { recursive: true });
    const taskPath = join(root, "references", "tasks", "readiness-fixture.json");
    const runLogPath = join(root, "runs", "readiness-run.json");
    await writeJson(taskPath, task);
    await writeJson(runLogPath, runLog(1));

    const report = await buildReadinessReport({ taskPath, runLogPath });

    expect(report.overallStatus).toBe("blocked");
    expect(report.planCompletion?.checks).toContainEqual(
      expect.objectContaining({
        id: "plan.verification",
        status: "blocked",
      }),
    );
  });

  test("includes operations evidence audit when repoRoot is provided", async () => {
    const root = await initReadinessRepo();
    const runBacked = await commitReadinessFixture(root, "feat: run-backed change");
    const unevidenced = await commitReadinessFixture(root, "chore: manual change");
    await new RunIndex(join(root, "runs", "index.jsonl")).append(
      readinessRunSummary(root, "run-backed-change", runBacked),
    );

    const report = await buildReadinessReport({ repoRoot: root });

    expect(report.overallStatus).toBe("blocked");
    expect(report.operations?.status).toBe("blocked");
    expect(report.operations?.evidence.commitHistory.unevidencedCommits).toEqual([unevidenced]);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: "operations.evidence.commit-history",
        status: "blocked",
      }),
    );
    expect(report.recommendation).toBe(
      "blocked: first-parent history has commits without run summary evidence or reviewed baseline coverage",
    );
  });

  test("treats reviewed baseline commits as covered operations history", async () => {
    const root = await initReadinessRepo();
    const historical = await commitReadinessFixture(root, "feat: historical readiness change");
    await writeReadinessBaseline(root, [
      { commit: historical, subject: "feat: historical readiness change" },
    ]);

    const report = await buildReadinessReport({ repoRoot: root });

    expect(report.overallStatus).toBe("clear");
    expect(report.operations?.status).toBe("clear");
    expect(report.operations?.evidence.commitHistory.baselineCoveredCommits).toEqual([historical]);
    expect(report.recommendation).toBe("operations evidence audit is clear");
  });

  test("surfaces unreviewed learning debt in operations readiness", async () => {
    const root = await initReadinessRepo();
    const runBacked = await commitReadinessFixture(root, "feat: run-backed change");
    await new RunIndex(join(root, "runs", "index.jsonl")).append(
      readinessRunSummary(root, "run-backed-change", runBacked),
    );
    const candidateDir = join(root, "references", "lessons", "inbox");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(join(candidateDir, "run-backed-change.md"), "# Lesson Candidate: run-backed-change\n", "utf8");

    const report = await buildReadinessReport({ repoRoot: root });

    expect(report.overallStatus).toBe("missing");
    expect(report.operations?.evidence.lessonInbox.unreviewedCandidateCount).toBe(1);
    expect(report.operations?.evidence.lessonInbox.promotionCandidateCount).toBe(0);
    expect(report.recommendation).toBe(
      "missing: lesson inbox candidates exist but no review index exists; unreviewed lesson candidates 1, promotion candidates 0",
    );
  });
});
