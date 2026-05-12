import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git, gitHead } from "../src/core/git";
import { evaluateMergeGate } from "../src/core/merge-gate";
import type { WorkerRunLog } from "../src/core/run-log";

let tmpRoots: string[] = [];

async function makeRepo(): Promise<{
  root: string;
  baseCommit: string;
  workerCommit: string;
  logPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "samantha-merge-"));
  const logRoot = await mkdtemp(join(tmpdir(), "samantha-merge-log-"));
  tmpRoots.push(root, logRoot);

  await git(["init", "-b", "main"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, "allowed.txt"), "base\n", "utf8");
  await git(["add", "allowed.txt"], root);
  await git(["commit", "-m", "chore: initial"], root);
  const baseCommit = await gitHead(root);

  await git(["checkout", "-b", "samantha/fixture"], root);
  await writeFile(join(root, "allowed.txt"), "changed\n", "utf8");
  await git(["add", "allowed.txt"], root);
  await git(["commit", "-m", "feat: worker change"], root);
  const workerCommit = await gitHead(root);
  await git(["checkout", "main"], root);

  const log: WorkerRunLog = {
    schemaVersion: 1,
    runId: "run-1",
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    task: {
      id: "merge-fixture",
      title: "Merge fixture",
      targetAgent: "codex-worker",
      targetFiles: ["allowed.txt"],
      forbiddenChanges: ["state/**"],
      verifyCommands: ["grep -q changed allowed.txt"],
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
    input: { repoRoot: root },
    result: {
      preparation: {
        taskId: "merge-fixture",
        agentId: "codex-worker",
        worktreePath: join(root, "worktrees/merge-fixture"),
        allocation: {
          taskId: "merge-fixture",
          repoRoot: root,
          worktreePath: join(root, "worktrees/merge-fixture"),
          branch: "samantha/fixture",
          baseCommit,
        },
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
        commitHash: workerCommit,
      },
      pass: true,
    },
  };
  const logPath = join(logRoot, "run.json");
  await writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return { root, baseCommit, workerCommit, logPath };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("evaluateMergeGate", () => {
  test("allows a clean fast-forward merge candidate", async () => {
    const { root, workerCommit, logPath } = await makeRepo();

    const result = await evaluateMergeGate({ runLogPath: logPath, repoRoot: root });

    expect(result.mayMerge).toBe(true);
    expect(result.alreadyMerged).toBe(false);
    expect(result.status).toBe("mergeable");
    expect(result.commit).toBe(workerCommit);
    expect(result.command).toEqual(["git", "merge", "--ff-only", workerCommit]);
  });

  test("recognizes an already integrated worker commit", async () => {
    const { root, workerCommit, logPath } = await makeRepo();
    await git(["merge", "--ff-only", workerCommit], root);

    const result = await evaluateMergeGate({ runLogPath: logPath, repoRoot: root });

    expect(result.mayMerge).toBe(false);
    expect(result.alreadyMerged).toBe(true);
    expect(result.status).toBe("already_merged");
    expect(result.command).toBeUndefined();
    expect(result.violations).toEqual([]);
  });

  test("blocks stale base and dirty target repositories", async () => {
    const stale = await makeRepo();
    await writeFile(join(stale.root, "allowed.txt"), "target changed\n", "utf8");
    await git(["add", "allowed.txt"], stale.root);
    await git(["commit", "-m", "feat: target change"], stale.root);

    const dirty = await makeRepo();
    await writeFile(join(dirty.root, "dirty.txt"), "dirty\n", "utf8");

    const staleResult = await evaluateMergeGate({ runLogPath: stale.logPath, repoRoot: stale.root });
    const dirtyResult = await evaluateMergeGate({ runLogPath: dirty.logPath, repoRoot: dirty.root });

    expect(staleResult.mayMerge).toBe(false);
    expect(staleResult.status).toBe("stale_base");
    expect(staleResult.violations).toContain("target repo HEAD no longer matches the worker base commit");
    expect(dirtyResult.mayMerge).toBe(false);
    expect(dirtyResult.status).toBe("dirty_target_repo");
    expect(dirtyResult.violations).toContain("target repo has uncommitted changes");
  });

  test("classifies failed verification and missing commits", async () => {
    const failed = await makeRepo();
    const failedLog = JSON.parse(await readFile(failed.logPath, "utf8")) as WorkerRunLog;
    failedLog.result.pass = false;
    if (!failedLog.result.evaluation) throw new Error("fixture evaluation missing");
    failedLog.result.evaluation.pass = false;
    failedLog.result.evaluation.verifyResults = [
      { command: "bun test", exitCode: 1, stdout: "", stderr: "failed" },
    ];
    await writeFile(failed.logPath, `${JSON.stringify(failedLog, null, 2)}\n`, "utf8");

    const missing = await makeRepo();
    const missingLog = JSON.parse(await readFile(missing.logPath, "utf8")) as WorkerRunLog;
    missingLog.result.commit = undefined;
    if (!missingLog.result.evaluation) throw new Error("fixture evaluation missing");
    missingLog.result.evaluation.harness = { status: "pass", note: "commit missing", commit: "" };
    await writeFile(missing.logPath, `${JSON.stringify(missingLog, null, 2)}\n`, "utf8");

    const failedResult = await evaluateMergeGate({ runLogPath: failed.logPath, repoRoot: failed.root });
    const missingResult = await evaluateMergeGate({ runLogPath: missing.logPath, repoRoot: missing.root });

    expect(failedResult.status).toBe("failed_verification");
    expect(failedResult.violations).toContain("run did not pass Samantha evaluation");
    expect(missingResult.status).toBe("missing_commit");
    expect(missingResult.violations).toContain("run did not report a commit");
  });

  test("blocks wrong target branch without creating a push command", async () => {
    const { root, logPath } = await makeRepo();

    const result = await evaluateMergeGate({
      runLogPath: logPath,
      repoRoot: root,
      targetBranch: "release",
    });

    expect(result.status).toBe("blocked");
    expect(result.mayMerge).toBe(false);
    expect(result.command).toBeUndefined();
    expect(result.violations).toContain("target repo is on main, expected release");
  });
});
