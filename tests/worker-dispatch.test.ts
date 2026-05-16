import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";
import {
  commitWorkerChanges,
  executeWorkerDispatch,
  prepareWorkerDispatch,
  runCommand,
  runSetupCommands,
} from "../src/core/worker-dispatch";
import { runTaskCommand } from "../src/commands/run-task";

let tmpRoots: string[] = [];

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

const task: TaskSpec = {
  id: "worker-dispatch-fixture",
  title: "Run worker dispatch",
  targetAgent: "codex-worker",
  targetFiles: ["README.md"],
  forbiddenChanges: ["runs/**", "worktrees/**"],
  setupCommands: ["test -f README.md"],
  verifyCommands: ["grep -q changed README.md"],
  instructions: "Change README.md to contain the word changed.",
  expectedCommitSubject: "test: dispatch worker fixture",
  status: "pending",
};

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-dispatch-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, "README.md"), "base\n", "utf8");
  await git(["add", "README.md"], root);
  await git(["commit", "-m", "chore: initial fixture"], root);
  return root;
}

async function makeFakeCodex(lines: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-fake-codex-"));
  tmpRoots.push(root);
  const path = join(root, "fake-codex");
  await writeFile(path, ["#!/usr/bin/env bash", ...lines, ""].join("\n"), "utf8");
  await chmod(path, 0o755);
  return path;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("worker dispatch", () => {
  test("prepares a policy-checked Codex command in an allocated worktree", async () => {
    const repo = await makeRepo();
    const prepared = await prepareWorkerDispatch({
      task,
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
    });

    expect(prepared.taskId).toBe(task.id);
    expect(prepared.agentId).toBe(agent.id);
    expect(prepared.allocation?.branch).toBe("samantha/worker-dispatch-fixture");
    expect(prepared.codex.command).toContain(prepared.worktreePath);
  });

  test("blocks dispatch when generated task placeholders were not narrowed", async () => {
    const repo = await makeRepo();

    await expect(
      prepareWorkerDispatch({
        task: {
          ...task,
          targetFiles: ["src/core/<module>.ts"],
          verifyCommands: ["bun test tests/<module>.test.ts"],
          expectedCommitSubject: "feat: add <module> core behavior",
        },
        agent,
        repoRoot: repo,
        worktreesDir: "worktrees",
      }),
    ).rejects.toThrow("task contains unresolved dispatch placeholders: module");
  });

  test("allows instruction-only CLI metavars during dispatch", async () => {
    const repo = await makeRepo();
    const prepared = await prepareWorkerDispatch({
      task: {
        ...task,
        instructions: "Keep command usage examples like --run-log=<path> in the prompt.",
      },
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
    });

    expect(prepared.taskId).toBe(task.id);
  });

  test("prepares non-writer report tasks without allocating a worktree", async () => {
    const repo = await makeRepo();
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const reportTask: TaskSpec = {
      id: "review-fixture",
      title: "Review fixture",
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      instructions: "Review evidence and report only.",
      resultMode: "report",
      status: "pending",
    };

    const prepared = await prepareWorkerDispatch({
      task: reportTask,
      agent: reviewer,
      repoRoot: repo,
      worktreesDir: "worktrees",
    });

    expect(prepared.worktreePath).toBe(repo);
    expect(prepared.allocation).toBeUndefined();
    expect(prepared.codex.command).toContain("read-only");
  });

  test("runs setup, Codex, evaluation, and Samantha-owned commit after gates pass", async () => {
    const repo = await makeRepo();
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed > README.md",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"changed readme","commit":""}'`,
    ]);

    const result = await executeWorkerDispatch({
      task,
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(true);
    expect(result.setupResults[0]?.exitCode).toBe(0);
    expect(result.command?.command[0]).toBe(fakeCodex);
    expect(result.command?.command).toEqual(result.preparation.codex.command);
    expect(result.evaluation?.changedFiles).toEqual(["README.md"]);
    expect(result.commit?.subject).toBe("test: dispatch worker fixture");
    expect(result.commit?.commitHash).toHaveLength(40);
    expect(await git(["log", "-1", "--pretty=%s"], result.preparation.worktreePath)).toBe(
      "test: dispatch worker fixture",
    );
  });

  test("runs report-only reviewer tasks without committing", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "dirty-before-review.txt"), "pre-existing change\n", "utf8");
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const reportTask: TaskSpec = {
      id: "review-fixture",
      title: "Review fixture",
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      instructions: "Review evidence and report only.",
      resultMode: "report",
      status: "pending",
    };
    const fakeCodex = await makeFakeCodex([
      `echo 'Review: README.md exists and no write is needed.'`,
      `echo 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}'`,
    ]);

    const result = await executeWorkerDispatch({
      task: reportTask,
      agent: reviewer,
      repoRoot: repo,
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(true);
    expect(result.preparation.worktreePath).toBe(repo);
    expect(result.preparation.allocation).toBeUndefined();
    expect(result.evaluation?.changedFiles).toEqual([]);
    expect(result.evaluation?.verifyResults).toEqual([]);
    expect(result.commit).toBeUndefined();
  });

  test("fails report-only reviewer tasks that change pre-existing dirty files", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "dirty-before-review.txt"), "pre-existing change\n", "utf8");
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const reportTask: TaskSpec = {
      id: "review-fixture",
      title: "Review fixture",
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      instructions: "Review evidence and report only.",
      resultMode: "report",
      status: "pending",
    };
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed by reviewer > dirty-before-review.txt",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}'`,
    ]);

    const result = await executeWorkerDispatch({
      task: reportTask,
      agent: reviewer,
      repoRoot: repo,
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(false);
    expect(result.evaluation?.changedFiles).toEqual(["dirty-before-review.txt"]);
    expect(result.evaluation?.scopeViolations).toContainEqual({
      file: "dirty-before-review.txt",
      reason: "forbidden",
      matchedPattern: "**/*",
    });
    expect(result.commit).toBeUndefined();
  });

  test("stops before Codex when setup fails", async () => {
    const repo = await makeRepo();
    const fakeCodex = await makeFakeCodex(["echo should-not-run"]);

    const result = await executeWorkerDispatch({
      task: { ...task, setupCommands: ["test -f missing.txt"] },
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(false);
    expect(result.setupResults[0]?.exitCode).not.toBe(0);
    expect(result.command).toBeUndefined();
    expect(result.evaluation).toBeUndefined();
    expect(result.commit).toBeUndefined();
  });

  test("does not commit failed verification and still writes a failed run log", async () => {
    const repo = await makeRepo();
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed > README.md",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"verify should fail","commit":""}'`,
    ]);
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(
      taskPath,
      `${JSON.stringify({ ...task, verifyCommands: ["grep -q missing README.md"] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
      codexBin: fakeCodex,
    });
    const rawLog = await readFile(result.runLog.path, "utf8");
    const parsed = JSON.parse(rawLog);

    expect(result.execution.pass).toBe(false);
    expect(result.execution.commit).toBeUndefined();
    expect(result.execution.evaluation?.verifyResults[0]).toMatchObject({
      command: "grep -q missing README.md",
      exitCode: 1,
    });
    expect(parsed.result.pass).toBe(false);
    expect(result.execution.preparation.allocation).toBeDefined();
    expect(await gitHead(result.execution.preparation.worktreePath)).toBe(
      result.execution.preparation.allocation!.baseCommit,
    );
  });

  test("records dispatch-blocked tasks before worker start", async () => {
    const repo = await makeRepo();
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(
      taskPath,
      `${JSON.stringify(
        {
          ...task,
          targetFiles: ["src/core/<module>.ts"],
          verifyCommands: ["bun test tests/<module>.test.ts"],
          expectedCommitSubject: "feat: add <module> core behavior",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
    });
    const parsed = JSON.parse(await readFile(result.runLog.path, "utf8"));

    expect(result.execution.pass).toBe(false);
    expect(result.execution.dispatchError).toContain("task contains unresolved dispatch placeholders");
    expect(result.execution.preparation.worktreePath).toBe(repo);
    expect(result.execution.preparation.allocation).toBeUndefined();
    expect(result.execution.command).toBeUndefined();
    expect(result.runSummary).toMatchObject({
      outcome: "blocked",
      pass: false,
      failureReason: result.execution.dispatchError,
      worktreePath: repo,
    });
    expect(parsed.trajectory[0]).toMatchObject({
      event: "planned",
      status: "failed",
      note: "dispatch blocked before worker start",
    });
  });

  test("captures command stdout, stderr, and exit code", async () => {
    const result = await runCommand(["bash", "-lc", "echo out && echo err >&2"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("out");
    expect(result.stderr.trim()).toBe("err");
  });

  test("runs setup commands in order and stops after first failure", async () => {
    const pass = await runSetupCommands(["echo one", "echo two"], "/tmp");
    const fail = await runSetupCommands(["echo one", "exit 7", "echo skipped"], "/tmp");

    expect(pass.map((result) => result.stdout.trim())).toEqual(["one", "two"]);
    expect(fail).toHaveLength(2);
    expect(fail[1]?.exitCode).toBe(7);
  });

  test("creates a Samantha-owned commit from evaluated worker files", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "README.md"), "changed\n", "utf8");

    const result = await commitWorkerChanges({
      task,
      cwd: repo,
      files: ["README.md"],
    });

    expect(result.add.exitCode).toBe(0);
    expect(result.commit.exitCode).toBe(0);
    expect(result.commitHash).toHaveLength(40);
    expect(await git(["log", "-1", "--pretty=%s"], repo)).toBe("test: dispatch worker fixture");
  });
});
