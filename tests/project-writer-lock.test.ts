import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProjectContext } from "../src/core/project-context";
import { projectPaths } from "../src/core/project-paths";
import { acquireProjectWriterLock, type ProjectWriterLockRecord } from "../src/core/project-writer-lock";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

async function makeContext(root: string) {
  const targetRepoRoot = join(root, "target");
  const harnessRoot = join(root, "harness");
  await mkdir(targetRepoRoot, { recursive: true });
  await mkdir(harnessRoot, { recursive: true });
  return buildProjectContext({
    targetRepoRoot,
    harnessRoot,
    projectId: "project-a",
    stateRoot: join(root, "state"),
  });
}

describe("project writer lock", () => {
  test("creates and releases a project-scoped writer lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-writer-lock-"));
    tmpRoots.push(root);
    const ctx = await makeContext(root);

    const lock = await acquireProjectWriterLock({
      projectContext: ctx,
      taskId: "task-a",
      runId: "run-a",
      now: new Date("2026-06-07T01:02:03.000Z"),
    });

    expect(lock.path).toBe(projectPaths.writerLockPath(ctx));
    expect(JSON.parse(await readFile(lock.path, "utf8"))).toMatchObject({
      schemaVersion: 1,
      projectId: "project-a",
      taskId: "task-a",
      runId: "run-a",
      acquiredAt: "2026-06-07T01:02:03.000Z",
    });

    await lock.release();
    await expect(readFile(lock.path, "utf8")).rejects.toThrow();
  });

  test("blocks a second writer for the same project", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-writer-lock-"));
    tmpRoots.push(root);
    const ctx = await makeContext(root);
    const first = await acquireProjectWriterLock({
      projectContext: ctx,
      taskId: "task-a",
      runId: "run-a",
      now: new Date("2026-06-07T01:02:03.000Z"),
    });

    await expect(
      acquireProjectWriterLock({
        projectContext: ctx,
        taskId: "task-b",
        runId: "run-b",
      }),
    ).rejects.toThrow(
      "dispatch blocked:\nproject writer lock is already held for project-a: held by task task-a run run-a since 2026-06-07T01:02:03.000Z",
    );

    await first.release();
  });

  test("release does not remove a lock owned by another token", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-writer-lock-"));
    tmpRoots.push(root);
    const ctx = await makeContext(root);
    const first = await acquireProjectWriterLock({
      projectContext: ctx,
      taskId: "task-a",
      runId: "run-a",
    });
    const replacement: ProjectWriterLockRecord = {
      ...first.record,
      taskId: "task-b",
      runId: "run-b",
      token: "replacement-token",
    };
    await writeFile(first.path, `${JSON.stringify(replacement, null, 2)}\n`, "utf8");

    await first.release();

    expect(JSON.parse(await readFile(first.path, "utf8"))).toMatchObject({
      taskId: "task-b",
      runId: "run-b",
      token: "replacement-token",
    });
  });
});
