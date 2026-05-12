import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "../src/core/git";
import {
  allocateWorktree,
  branchForTask,
  defaultWorktreesRoot,
  releaseWorktree,
  sanitizeTaskId,
  worktreePathForTask,
} from "../src/core/worktree";

let tmpRoots: string[] = [];

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-worktree-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, "README.md"), "# fixture\n", "utf8");
  await git(["add", "README.md"], root);
  await git(["commit", "-m", "chore: initial fixture"], root);
  return root;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("worktree allocation", () => {
  test("sanitizes task ids for branch and path names", () => {
    expect(sanitizeTaskId("Feature A / Step 1")).toBe("feature-a-step-1");
    expect(branchForTask("Feature A / Step 1")).toBe("samantha/feature-a-step-1");
  });

  test("defaults task worktrees outside the target repo", async () => {
    const repo = await makeRepo();

    expect(defaultWorktreesRoot(repo)).toContain(".samantha-worktrees");
    expect(worktreePathForTask(repo, "Task 1").startsWith(repo)).toBe(false);
  });

  test("allocates a task worktree and releases it", async () => {
    const repo = await makeRepo();
    const allocation = await allocateWorktree({
      repoRoot: repo,
      taskId: "Task 1",
      worktreesDir: "worktrees",
    });

    expect(allocation.branch).toBe("samantha/task-1");
    expect(await git(["rev-parse", "--abbrev-ref", "HEAD"], allocation.worktreePath)).toBe(
      "samantha/task-1",
    );

    await releaseWorktree({ repoRoot: repo, allocation });
    await expect(git(["rev-parse", "--verify", allocation.branch], repo)).rejects.toThrow();
  });

  test("reuses an existing clean task worktree for the same base", async () => {
    const repo = await makeRepo();
    const first = await allocateWorktree({
      repoRoot: repo,
      taskId: "Task 1",
      worktreesDir: "worktrees",
    });
    const second = await allocateWorktree({
      repoRoot: repo,
      taskId: "Task 1",
      worktreesDir: "worktrees",
    });

    expect(second).toEqual(first);
  });

  test("rejects an existing dirty task worktree", async () => {
    const repo = await makeRepo();
    const allocation = await allocateWorktree({
      repoRoot: repo,
      taskId: "Task 1",
      worktreesDir: "worktrees",
    });
    await writeFile(join(allocation.worktreePath, "dirty.txt"), "dirty\n", "utf8");

    await expect(
      allocateWorktree({ repoRoot: repo, taskId: "Task 1", worktreesDir: "worktrees" }),
    ).rejects.toThrow("existing worktree is not clean");
  });

  test("rejects an existing worktree on the wrong branch", async () => {
    const repo = await makeRepo();
    const path = worktreePathForTask(repo, "Task 2", "worktrees");
    await mkdir(join(repo, "worktrees"), { recursive: true });
    await git(["worktree", "add", "-b", "unexpected-branch", path, "HEAD"], repo);

    await expect(
      allocateWorktree({ repoRoot: repo, taskId: "Task 2", worktreesDir: "worktrees" }),
    ).rejects.toThrow("existing worktree has unexpected branch");
  });

  test("rejects an existing worktree from a stale base", async () => {
    const repo = await makeRepo();
    await allocateWorktree({ repoRoot: repo, taskId: "Task 1", worktreesDir: "worktrees" });
    await writeFile(join(repo, "README.md"), "# fixture\n\nupdated\n", "utf8");
    await git(["add", "README.md"], repo);
    await git(["commit", "-m", "chore: update base"], repo);

    await expect(
      allocateWorktree({ repoRoot: repo, taskId: "Task 1", worktreesDir: "worktrees" }),
    ).rejects.toThrow("existing worktree HEAD does not match base ref");
  });
});
