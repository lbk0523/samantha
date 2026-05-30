import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { defaultPreviousKstDate, runDailyLessonReview } from "../src/core/lesson-daily-review";
import type { RunSummary } from "../src/core/ledger";
import { buildWorkerRunLog, type WorkerRunLog } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];
const execFileAsync = promisify(execFile);

const agent: AgentProfile = {
  id: "codex-worker",
  role: "writer",
  model: "gpt-5.5",
  writerClass: "writer",
  worktreePolicy: "per-task",
  mergePolicy: "samantha-controlled",
  skillPolicy: {
    requiredBundles: [],
    blockedSkills: [],
  },
};

function task(id: string): TaskSpec {
  return {
    id,
    title: `Task ${id}`,
    taskFamily: "cli-command",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetAgent: "codex-worker",
    targetFiles: ["src/cli.ts", "tests/cli.test.ts"],
    forbiddenChanges: ["runs/**"],
    setupCommands: [],
    verifyCommands: ["bun test tests/cli.test.ts"],
    instructions: "Fixture.",
    status: "pending",
  };
}

function execution(overrides: Partial<WorkerDispatchExecution> = {}): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: "daily-lesson-window",
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
      stdout: 'HARNESS_RESULT: {"status":"pass","note":"ok"}',
      stderr: "",
    },
    evaluation: {
      pass: true,
      harness: {
        status: "pass",
        note: "ok",
        commit: "",
      },
      changedFiles: ["src/cli.ts", "tests/cli.test.ts"],
      scopeViolations: [],
      verifyResults: [
        {
          command: "bun test tests/cli.test.ts",
          exitCode: 0,
          stdout: "",
          stderr: "",
        },
      ],
    },
    commit: {
      subject: "test: daily lesson fixture",
      files: ["src/cli.ts", "tests/cli.test.ts"],
      add: {
        command: ["git", "add", "--", "src/cli.ts", "tests/cli.test.ts"],
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
      commit: {
        command: ["git", "commit", "-m", "test: daily lesson fixture"],
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
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${items.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
}

async function writeInboxCandidate(root: string, name: string, markdown: string): Promise<string> {
  const path = join(root, "references", "lessons", "inbox", name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, markdown, "utf8");
  return path;
}

function promotionCandidateMarkdown(input: {
  runId: string;
  taskId: string;
  taskFamily?: string;
  recurrenceCount?: number;
  suggestedArtifactType?: string;
}): string {
  return `# Lesson Candidate: ${input.runId}

## Source
- Source run id: ${input.runId}
- Task id: ${input.taskId}
- Task title: Repeated CLI command
- Run log: /repo/runs/${input.runId}.json

## Evidence
- Observed outcome: pass

### Superseded Context
- Superseded status: not detected

### Recurrence
${input.taskFamily ? `- Task family: ${input.taskFamily}\n` : ""}- Recurrence outcome: pass
- Recurrence count: ${input.recurrenceCount ?? 2}
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Promote the repeated CLI command pattern.
- Affected layer: playbook
- Suggested artifact type: ${input.suggestedArtifactType ?? "playbook"}
- Risk if adopted: Promotion still requires manual review.
`;
}

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync("git", ["-C", root, "init"]);
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
    outcome: log.result.pass ? "pass" : "verify_failed",
    pass: log.result.pass,
    commit: log.result.commit?.commitHash ?? "",
    ...overrides,
  };
}

function acceptedLog(input: { taskId: string; startedAt: string; finishedAt: string }): WorkerRunLog {
  return buildWorkerRunLog({
    task: task(input.taskId),
    agent,
    repoRoot: "/repo",
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    execution: execution({
      preparation: {
        ...execution().preparation,
        taskId: input.taskId,
      },
    }),
  });
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("daily lesson review", () => {
  test("selects runs inside the target KST day and writes the daily report after inbox review", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-daily-lesson-"));
    tmpRoots.push(root);
    const first = acceptedLog({
      taskId: "daily-lesson-window-v2",
      startedAt: "2026-05-22T14:59:00.000Z",
      finishedAt: "2026-05-22T15:00:00.000Z",
    });
    const second = acceptedLog({
      taskId: "daily-lesson-window-v3",
      startedAt: "2026-05-23T14:58:00.000Z",
      finishedAt: "2026-05-23T14:59:59.999Z",
    });
    const firstLogPath = await writeRunLog(root, first);
    const secondLogPath = await writeRunLog(root, second);
    await writeJsonLines(join(root, "runs", "index.jsonl"), [
      runSummary(first, firstLogPath, {
        runId: "prior-verify-failed",
        taskId: "daily-lesson-window",
        taskTitle: "Prior failure",
        finishedAt: "2026-05-22T12:00:00.000Z",
        outcome: "verify_failed",
        pass: false,
        commit: "",
      }),
      runSummary(first, firstLogPath, {
        runId: "before-window",
        taskId: "outside-before",
        taskTitle: "Outside before",
        finishedAt: "2026-05-22T14:59:59.999Z",
      }),
      runSummary(first, firstLogPath),
      runSummary(second, secondLogPath),
      runSummary(second, secondLogPath, {
        runId: "after-window",
        finishedAt: "2026-05-23T15:00:00.000Z",
      }),
    ]);
    await writeJsonLines(join(root, "runs", "run-lifecycle.jsonl"), [
      {
        schemaVersion: 1,
        runId: first.runId,
        taskId: first.task.id,
        repoRoot: "/repo",
        runLogPath: firstLogPath,
        commit: "a".repeat(40),
        mergedAt: "2026-05-22T15:02:00.000Z",
        cleanedAt: "2026-05-22T15:03:00.000Z",
        updatedAt: "2026-05-22T15:03:00.000Z",
      },
      {
        schemaVersion: 1,
        runId: second.runId,
        taskId: second.task.id,
        repoRoot: "/repo",
        runLogPath: secondLogPath,
        commit: "a".repeat(40),
        mergedAt: "2026-05-23T15:02:00.000Z",
        cleanedAt: "2026-05-23T15:03:00.000Z",
        updatedAt: "2026-05-23T15:03:00.000Z",
      },
    ]);

    const result = await runDailyLessonReview({ repoRoot: root, date: "2026-05-23" });

    expect(result).toMatchObject({
      schemaVersion: 1,
      targetDate: "2026-05-23",
      kstWindow: {
        start: "2026-05-23T00:00:00+09:00",
        end: "2026-05-24T00:00:00+09:00",
      },
      selectedRunCount: 2,
      draftResults: [
        {
          runId: first.runId,
          status: "created",
          reason: "verify_failed recovery success",
          path: join(root, "references", "lessons", "inbox", `${first.runId}.md`),
        },
        {
          runId: second.runId,
          status: "created",
          reason: "verify_failed recovery success",
          path: join(root, "references", "lessons", "inbox", `${second.runId}.md`),
        },
      ],
      reviewIndexPath: join(root, "references", "lessons", "reviews", "index.json"),
      summary: {
        total: 2,
        needsMoreEvidence: 1,
        promotionCandidates: 1,
      },
    });
    expect(result.promotionQueue.map((entry) => entry.runId)).toEqual([second.runId, first.runId]);
    expect(JSON.parse(await readFile(result.reportPath, "utf8"))).toEqual(result);
  });

  test("defaults to the previous KST calendar date from the injected clock", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-daily-lesson-"));
    tmpRoots.push(root);

    const result = await runDailyLessonReview({
      repoRoot: root,
      now: new Date("2026-05-23T15:30:00.000Z"),
    });

    expect(defaultPreviousKstDate(new Date("2026-05-23T15:30:00.000Z"))).toBe("2026-05-23");
    expect(result.targetDate).toBe("2026-05-23");
    expect(result.selectedRunCount).toBe(0);
    expect(JSON.parse(await readFile(result.reportPath, "utf8"))).toEqual(result);
  });

  test("keeps existing candidate markdown and reports already_exists on repeated review", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-daily-lesson-"));
    tmpRoots.push(root);
    const log = acceptedLog({
      taskId: "daily-lesson-idempotency-v2",
      startedAt: "2026-05-22T16:00:00.000Z",
      finishedAt: "2026-05-22T16:01:00.000Z",
    });
    const runLogPath = await writeRunLog(root, log);
    const candidatePath = join(root, "references", "lessons", "inbox", `${log.runId}.md`);
    await mkdir(join(root, "references", "lessons", "inbox"), { recursive: true });
    await writeFile(candidatePath, "manual candidate\n", "utf8");
    await writeJsonLines(join(root, "runs", "index.jsonl"), [
      runSummary(log, runLogPath, {
        runId: "prior-verify-failed",
        taskId: "daily-lesson-idempotency",
        taskTitle: "Prior failure",
        finishedAt: "2026-05-22T12:00:00.000Z",
        outcome: "verify_failed",
        pass: false,
        commit: "",
      }),
      runSummary(log, runLogPath),
    ]);
    await writeJsonLines(join(root, "runs", "run-lifecycle.jsonl"), [
      {
        schemaVersion: 1,
        runId: log.runId,
        taskId: log.task.id,
        repoRoot: "/repo",
        runLogPath,
        commit: "a".repeat(40),
        mergedAt: "2026-05-22T16:02:00.000Z",
        cleanedAt: "2026-05-22T16:03:00.000Z",
        updatedAt: "2026-05-22T16:03:00.000Z",
      },
    ]);

    const result = await runDailyLessonReview({ repoRoot: root, date: "2026-05-23" });
    const second = await runDailyLessonReview({ repoRoot: root, date: "2026-05-23" });

    expect(result.draftResults).toEqual([
      {
        runId: log.runId,
        status: "already_exists",
        reason: "lesson candidate already exists",
        path: candidatePath,
      },
    ]);
    expect(second.draftResults).toEqual(result.draftResults);
    expect(await readFile(candidatePath, "utf8")).toBe("manual candidate\n");
    expect(JSON.parse(await readFile(second.reportPath, "utf8"))).toEqual(second);
  });

  test("auto-promotes eligible playbook candidates using task family as the playbook id", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-daily-lesson-"));
    tmpRoots.push(root);
    await writeInboxCandidate(
      root,
      "promotion-candidate-run.md",
      promotionCandidateMarkdown({
        runId: "promotion-candidate-run",
        taskId: "specific-cli-command-v2",
        taskFamily: "cli-command",
      }),
    );

    const result = await runDailyLessonReview({ repoRoot: root, date: "2026-05-23" });
    const artifactPath = join(root, "references", "playbooks", "cli-command.md");

    expect(result.autoPromotion).toEqual({
      schemaVersion: 1,
      targetDate: "2026-05-23",
      dirtyTreeBlocked: false,
      promoted: [
        {
          candidatePath: "references/lessons/inbox/promotion-candidate-run.md",
          reviewPath: "references/lessons/reviews/promotion-candidate-run.json",
          runId: "promotion-candidate-run",
          taskId: "specific-cli-command-v2",
          playbookId: "cli-command",
          artifactPath: "references/playbooks/cli-command.md",
          reason: "promoted playbook",
        },
      ],
      skipped: [],
      blocked: [],
      summary: {
        total: 1,
        promoted: 1,
        skipped: 0,
        blocked: 0,
      },
    });
    await expect(readFile(artifactPath, "utf8")).resolves.toContain("# Playbook: cli-command");
    expect(JSON.parse(await readFile(result.reportPath, "utf8"))).toEqual(result);
  });

  test("blocks all playbook creation when the target repo is dirty", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-daily-lesson-"));
    tmpRoots.push(root);
    await initGitRepo(root);
    await writeFile(join(root, "dirty.txt"), "dirty\n", "utf8");
    await writeInboxCandidate(
      root,
      "promotion-candidate-run.md",
      promotionCandidateMarkdown({
        runId: "promotion-candidate-run",
        taskId: "specific-cli-command-v2",
        taskFamily: "cli-command",
      }),
    );

    const result = await runDailyLessonReview({ repoRoot: root, date: "2026-05-23" });

    expect(result.autoPromotion).toEqual({
      schemaVersion: 1,
      targetDate: "2026-05-23",
      dirtyTreeBlocked: true,
      promoted: [],
      skipped: [],
      blocked: [
        {
          candidatePath: "references/lessons/inbox/promotion-candidate-run.md",
          reviewPath: "references/lessons/reviews/promotion-candidate-run.json",
          runId: "promotion-candidate-run",
          taskId: "specific-cli-command-v2",
          playbookId: "cli-command",
          artifactPath: "references/playbooks/cli-command.md",
          reason: "dirty target repo",
        },
      ],
      summary: {
        total: 1,
        promoted: 0,
        skipped: 0,
        blocked: 1,
      },
    });
    await expect(readFile(join(root, "references", "playbooks", "cli-command.md"), "utf8")).rejects.toThrow();
  });

  test("skips existing playbooks without overwrite", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-daily-lesson-"));
    tmpRoots.push(root);
    await writeInboxCandidate(
      root,
      "promotion-candidate-run.md",
      promotionCandidateMarkdown({
        runId: "promotion-candidate-run",
        taskId: "specific-cli-command-v2",
        taskFamily: "cli-command",
      }),
    );
    const artifactPath = join(root, "references", "playbooks", "cli-command.md");
    await mkdir(dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, "existing\n", "utf8");

    const result = await runDailyLessonReview({ repoRoot: root, date: "2026-05-23" });

    expect(result.autoPromotion.promoted).toEqual([]);
    expect(result.autoPromotion.blocked).toEqual([]);
    expect(result.autoPromotion.schemaVersion).toBe(1);
    expect(result.autoPromotion.targetDate).toBe("2026-05-23");
    expect(result.autoPromotion.skipped).toEqual([
      {
        candidatePath: "references/lessons/inbox/promotion-candidate-run.md",
        reviewPath: "references/lessons/reviews/promotion-candidate-run.json",
        runId: "promotion-candidate-run",
        taskId: "specific-cli-command-v2",
        playbookId: "cli-command",
        artifactPath: "references/playbooks/cli-command.md",
        reason: "playbook already exists",
      },
    ]);
    expect(result.autoPromotion.summary).toEqual({
      total: 1,
      promoted: 0,
      skipped: 1,
      blocked: 0,
    });
    await expect(readFile(artifactPath, "utf8")).resolves.toBe("existing\n");
  });

  test("skips non-eligible playbook candidates without creating playbooks", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-daily-lesson-"));
    tmpRoots.push(root);
    await writeInboxCandidate(
      root,
      "needs-more-evidence-run.md",
      promotionCandidateMarkdown({
        runId: "needs-more-evidence-run",
        taskId: "specific-cli-command-v2",
        taskFamily: "cli-command",
        recurrenceCount: 1,
      }),
    );

    const result = await runDailyLessonReview({ repoRoot: root, date: "2026-05-23" });

    expect(result.autoPromotion).toEqual({
      schemaVersion: 1,
      targetDate: "2026-05-23",
      dirtyTreeBlocked: false,
      promoted: [],
      skipped: [
        {
          candidatePath: "references/lessons/inbox/needs-more-evidence-run.md",
          reviewPath: "references/lessons/reviews/needs-more-evidence-run.json",
          runId: "needs-more-evidence-run",
          taskId: "specific-cli-command-v2",
          playbookId: "cli-command",
          artifactPath: "references/playbooks/cli-command.md",
          reason: "not eligible for auto-promotion: playbook candidate needs more evidence before promotion (1/2)",
        },
      ],
      blocked: [],
      summary: {
        total: 1,
        promoted: 0,
        skipped: 1,
        blocked: 0,
      },
    });
    await expect(readFile(join(root, "references", "playbooks", "cli-command.md"), "utf8")).rejects.toThrow();
  });
});
