import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunLifecycleStore, type RunLifecycleRecord } from "../src/core/run-lifecycle-store";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

const base: RunLifecycleRecord = {
  schemaVersion: 1,
  runId: "run-1",
  taskId: "task-1",
  repoRoot: "/repo",
  runLogPath: "/repo/runs/run-1.json",
  commit: "abc123",
  updatedAt: "2026-05-12T10:00:00.000Z",
};

describe("RunLifecycleStore", () => {
  test("marks explicit merge and cleanup lifecycle events", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-lifecycle-"));
    tmpRoots.push(root);
    const store = new RunLifecycleStore(join(root, "state", "run-lifecycle.jsonl"));

    await store.mark(base, "merged", "2026-05-12T10:01:00.000Z");
    const cleaned = await store.mark(base, "cleaned", "2026-05-12T10:02:00.000Z");

    expect(cleaned).toMatchObject({
      runId: "run-1",
      mergedAt: "2026-05-12T10:01:00.000Z",
      cleanedAt: "2026-05-12T10:02:00.000Z",
      updatedAt: "2026-05-12T10:02:00.000Z",
    });
    expect(await store.find("run-1")).toEqual(cleaned);
    expect(await store.list()).toEqual([cleaned]);
  });
});
