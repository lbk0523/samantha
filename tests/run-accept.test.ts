import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git, gitHead } from "../src/core/git";
import { acceptRun, type RunAcceptCommandResult } from "../src/core/run-accept";
import type { RunLifecycleRecord } from "../src/core/run-lifecycle-store";
import type { WorkerRunLog } from "../src/core/run-log";
import { allocateWorktree } from "../src/core/worktree";

let tmpRoots: string[] = [];

function expectTiming(entry: { startedAt?: string; finishedAt?: string; durationMs?: number }) {
  expect(entry.startedAt).toBeTruthy();
  expect(entry.finishedAt).toBeTruthy();
  expect(Number.isNaN(Date.parse(entry.startedAt!))).toBe(false);
  expect(Number.isNaN(Date.parse(entry.finishedAt!))).toBe(false);
  expect(entry.durationMs).toBeGreaterThanOrEqual(0);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-accept-"));
  tmpRoots.push(root);
  await git(["init", "-b", "main"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, ".gitignore"), "worktrees/\nstate/\n", "utf8");
  await writeFile(join(root, "allowed.txt"), "base\n", "utf8");
  await git(["add", ".gitignore", "allowed.txt"], root);
  await git(["commit", "-m", "chore: initial fixture"], root);
  return root;
}

async function makeRun(): Promise<{
  root: string;
  logPath: string;
  stateDir: string;
  worktreePath: string;
  branch: string;
  baseCommit: string;
  commit: string;
}> {
  const root = await makeRepo();
  const allocation = await allocateWorktree({
    repoRoot: root,
    taskId: "accept-fixture",
    worktreesDir: "worktrees",
  });
  await writeFile(join(allocation.worktreePath, "allowed.txt"), "changed\n", "utf8");
  await git(["add", "allowed.txt"], allocation.worktreePath);
  await git(["commit", "-m", "feat: worker change"], allocation.worktreePath);
  const commit = await gitHead(allocation.worktreePath);
  const logRoot = await mkdtemp(join(tmpdir(), "samantha-accept-log-"));
  tmpRoots.push(logRoot);
  const logPath = join(logRoot, "run.json");
  const stateDir = join(logRoot, "state");

  const log: WorkerRunLog = {
    schemaVersion: 1,
    runId: "accept-run",
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    task: {
      id: "accept-fixture",
      title: "Accept fixture",
      taskFamily: "core-module",
      workMode: "tdd-first",
      riskClass: "lifecycle-sensitive",
      targetAgent: "codex-worker",
      targetFiles: ["allowed.txt"],
      forbiddenChanges: ["state/**"],
      verifyCommands: [],
      instructions: "Fixture.",
      status: "pending",
    },
    agent: {
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
    },
    input: { repoRoot: root, worktreesDir: "worktrees" },
    result: {
      preparation: {
        taskId: "accept-fixture",
        agentId: "codex-worker",
        worktreePath: allocation.worktreePath,
        allocation,
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
        commitHash: commit,
      },
      pass: true,
    },
  };

  await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  await writeFile(
    join(logRoot, "index.jsonl"),
    `${JSON.stringify({
      schemaVersion: 1,
      runId: "prior-verify-failed",
      taskId: "accept-fixture",
      taskTitle: "Accept fixture prior failure",
      agentId: "codex-worker",
      repoRoot: root,
      worktreePath: join(root, "worktrees", "prior-verify-failed"),
      logPath: join(logRoot, "prior-verify-failed.json"),
      startedAt: "2026-05-12T09:00:00.000Z",
      finishedAt: "2026-05-12T09:01:00.000Z",
      outcome: "verify_failed",
      pass: false,
      commit: "",
    })}\n`,
    "utf8",
  );
  return {
    root,
    logPath,
    stateDir,
    worktreePath: allocation.worktreePath,
    branch: allocation.branch,
    baseCommit: allocation.baseCommit,
    commit,
  };
}

async function readLog(path: string): Promise<WorkerRunLog> {
  return JSON.parse(await readFile(path, "utf8")) as WorkerRunLog;
}

async function readLifecycle(path: string): Promise<RunLifecycleRecord[]> {
  const raw = await readFile(path, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunLifecycleRecord);
}

async function runFixtureCommand(command: string[], cwd: string): Promise<RunAcceptCommandResult> {
  const child = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { command, exitCode, stdout, stderr };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("acceptRun", () => {
  test("merges a mergeable run, marks lifecycle, and cleans the worker worktree", async () => {
    const { root, logPath, stateDir, worktreePath, branch, commit } = await makeRun();

    const result = await acceptRun({ runLogPath: logPath, repoRoot: root, stateDir });

    expect(result.accepted).toBe(true);
    expect(result.status).toBe("accepted");
    expect(result.gate).toMatchObject({
      mayMerge: true,
      status: "mergeable",
      command: ["git", "merge", "--ff-only", commit],
    });
    expect(result.merge).toMatchObject({
      command: ["git", "merge", "--ff-only", commit],
      exitCode: 0,
    });
    expectTiming(result.merge!);
    expect(result.lifecycle?.merged.mergedAt).toBeTruthy();
    expect(result.lifecycle?.cleaned?.cleanedAt).toBeTruthy();
    expect(result.cleanup?.cleaned).toBe(true);
    expect(result.lessonDraft).toMatchObject({
      status: "created",
      reason: "verify_failed recovery success",
      path: join(root, "references", "lessons", "inbox", "accept-run.md"),
      runId: "accept-run",
    });
    expect(await gitHead(root)).toBe(commit);
    expect(await exists(worktreePath)).toBe(false);
    await expect(git(["rev-parse", "--verify", branch], root)).rejects.toThrow();

    const lifecycle = await readLifecycle(join(stateDir, "run-lifecycle.jsonl"));
    expect(lifecycle).toHaveLength(1);
    expect(lifecycle[0]).toMatchObject({
      runId: "accept-run",
      commit,
    });
    expect(lifecycle[0].mergedAt).toBeTruthy();
    expect(lifecycle[0].cleanedAt).toBeTruthy();

    const lessonCandidate = await readFile(join(root, "references", "lessons", "inbox", "accept-run.md"), "utf8");
    expect(lessonCandidate).toContain("# Lesson Candidate: accept-run");
    expect(lessonCandidate).toContain("- Observed outcome: pass");
    expect(lessonCandidate).toContain("- Lifecycle state: merged and cleaned");
    expect(lessonCandidate).toContain("- Review note: Review manually before promotion.");

    const log = await readLog(logPath);
    expect(log.trajectory?.map((entry) => entry.event)).toEqual([
      "merge_checked",
      "merge_finished",
      "lifecycle_marked",
      "cleanup_finished",
      "lifecycle_marked",
      "final_git_status_captured",
    ]);
    expect(log.trajectory?.[5]).toMatchObject({
      event: "final_git_status_captured",
      status: "completed",
      details: {
        finalGitStatus: "clean",
        command: ["git", "status", "--porcelain=v1"],
        exitCode: 0,
        porcelainLineCount: 0,
      },
    });
    for (const entry of log.trajectory ?? []) expectTiming(entry);
  });

  test("records dirty final git status from the injected git status command after cleanup", async () => {
    const { root, logPath, stateDir, commit } = await makeRun();
    const commands: string[][] = [];

    const result = await acceptRun(
      { runLogPath: logPath, repoRoot: root, stateDir },
      {
        runCommand: async (command, cwd) => {
          commands.push(command);
          if (command.join(" ") === "git status --porcelain=v1") {
            return {
              command,
              exitCode: 0,
              stdout: " M allowed.txt\n?? extra.txt\n",
              stderr: "",
            };
          }
          return runFixtureCommand(command, cwd);
        },
      },
    );

    expect(result.accepted).toBe(true);
    expect(commands).toEqual([
      ["git", "merge", "--ff-only", commit],
      ["git", "status", "--porcelain=v1"],
    ]);

    const log = await readLog(logPath);
    expect(log.trajectory?.map((entry) => entry.event)).toEqual([
      "merge_checked",
      "merge_finished",
      "lifecycle_marked",
      "cleanup_finished",
      "lifecycle_marked",
      "final_git_status_captured",
    ]);
    expect(log.trajectory?.[5]).toMatchObject({
      event: "final_git_status_captured",
      status: "completed",
      details: {
        finalGitStatus: "dirty",
        command: ["git", "status", "--porcelain=v1"],
        exitCode: 0,
        porcelainLineCount: 2,
      },
    });
    for (const entry of log.trajectory ?? []) expectTiming(entry);
  });

  test("records unavailable final git status when the injected git status command fails", async () => {
    const { root, logPath, stateDir, commit } = await makeRun();
    const commands: string[][] = [];

    const result = await acceptRun(
      { runLogPath: logPath, repoRoot: root, stateDir },
      {
        runCommand: async (command, cwd) => {
          commands.push(command);
          if (command.join(" ") === "git status --porcelain=v1") {
            return {
              command,
              exitCode: 2,
              stdout: "",
              stderr: "status failed by test",
            };
          }
          return runFixtureCommand(command, cwd);
        },
      },
    );

    expect(result.accepted).toBe(true);
    expect(commands).toEqual([
      ["git", "merge", "--ff-only", commit],
      ["git", "status", "--porcelain=v1"],
    ]);

    const log = await readLog(logPath);
    expect(log.trajectory?.[5]).toMatchObject({
      event: "final_git_status_captured",
      status: "failed",
      details: {
        finalGitStatus: "unavailable",
        command: ["git", "status", "--porcelain=v1"],
        exitCode: 2,
      },
    });
    expect(log.trajectory?.[5]?.details).not.toHaveProperty("porcelainLineCount");
    for (const entry of log.trajectory ?? []) expectTiming(entry);
  });

  test("records merge-check evidence and stops when the gate is not mergeable", async () => {
    const { root, logPath, stateDir, worktreePath, branch, baseCommit } = await makeRun();
    await writeFile(join(root, "dirty.txt"), "dirty\n", "utf8");

    const result = await acceptRun({ runLogPath: logPath, repoRoot: root, stateDir });

    expect(result).toMatchObject({
      accepted: false,
      status: "not_mergeable",
      gate: {
        mayMerge: false,
        status: "dirty_target_repo",
      },
    });
    expect(result.merge).toBeUndefined();
    expect(result.lifecycle).toBeUndefined();
    expect(result.cleanup).toBeUndefined();
    expect(await gitHead(root)).toBe(baseCommit);
    expect(await exists(worktreePath)).toBe(true);
    expect(await git(["rev-parse", "--verify", branch], root)).toBeTruthy();
    expect(await exists(join(stateDir, "run-lifecycle.jsonl"))).toBe(false);

    const log = await readLog(logPath);
    expect(log.trajectory?.map((entry) => entry.event)).toEqual(["merge_checked"]);
    expect(log.trajectory?.[0]).toMatchObject({
      event: "merge_checked",
      status: "failed",
      details: {
        mergeStatus: "dirty_target_repo",
        mayMerge: false,
      },
    });
    expectTiming(log.trajectory![0]!);
  });

  test("does not mark merged or clean up when the merge command fails", async () => {
    const { root, logPath, stateDir, worktreePath, branch, baseCommit, commit } = await makeRun();
    const commands: string[][] = [];

    const result = await acceptRun(
      { runLogPath: logPath, repoRoot: root, stateDir },
      {
        runCommand: async (command) => {
          commands.push(command);
          return {
            command,
            exitCode: 42,
            stdout: "",
            stderr: "merge failed by test",
          };
        },
      },
    );

    expect(commands).toEqual([["git", "merge", "--ff-only", commit]]);
    expect(result).toMatchObject({
      accepted: false,
      status: "merge_failed",
      merge: {
        command: ["git", "merge", "--ff-only", commit],
        exitCode: 42,
        stderr: "merge failed by test",
      },
    });
    expectTiming(result.merge!);
    expect(result.lifecycle).toBeUndefined();
    expect(result.cleanup).toBeUndefined();
    expect(await gitHead(root)).toBe(baseCommit);
    expect(await exists(worktreePath)).toBe(true);
    expect(await git(["rev-parse", "--verify", branch], root)).toBeTruthy();
    expect(await exists(join(stateDir, "run-lifecycle.jsonl"))).toBe(false);

    const log = await readLog(logPath);
    expect(log.trajectory?.map((entry) => entry.event)).toEqual(["merge_checked", "merge_finished"]);
    expect(log.trajectory?.[1]).toMatchObject({
      event: "merge_finished",
      status: "failed",
      details: {
        exitCode: 42,
      },
    });
    for (const entry of log.trajectory ?? []) expectTiming(entry);
  });
});
