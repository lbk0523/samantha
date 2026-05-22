import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  lifecycleBaseFromRunLog,
  RunLifecycleStore,
  type RunLifecycleRecord,
} from "../src/core/run-lifecycle-store";
import type { WorkerRunLog } from "../src/core/run-log";

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

  test("does not use report-only HARNESS_RESULT commits for lifecycle records", () => {
    const log: WorkerRunLog = {
      schemaVersion: 1,
      runId: "run-1",
      startedAt: "2026-05-12T10:00:00.000Z",
      finishedAt: "2026-05-12T10:01:00.000Z",
      task: {
        id: "report-fixture",
        title: "Report fixture",
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: [],
        instructions: "Review only.",
        resultMode: "report",
        status: "pending",
      },
      agent: {
        id: "codex-reviewer",
        role: "reviewer",
        model: "gpt-5.5",
        writerClass: "non-writer",
        worktreePolicy: "none",
        mergePolicy: "none",
        skillPolicy: {
          requiredBundles: [],
          blockedSkills: [],
        },
      },
      input: { repoRoot: "/repo" },
      result: {
        preparation: {
          taskId: "report-fixture",
          agentId: "codex-reviewer",
          worktreePath: "/repo",
          codex: { prompt: "prompt", command: ["codex", "exec"] },
        },
        setupResults: [],
        command: { command: ["codex", "exec"], exitCode: 0, stdout: "", stderr: "" },
        evaluation: {
          pass: true,
          harness: { status: "pass", note: "report only", commit: "a".repeat(40) },
          changedFiles: [],
          scopeViolations: [],
          verifyResults: [],
        },
        pass: true,
      },
    };

    const record = lifecycleBaseFromRunLog({
      log,
      runLogPath: "/repo/runs/run-1.json",
      repoRoot: "/repo",
      updatedAt: "2026-05-12T10:02:00.000Z",
    });

    expect(record.commit).toBe("");
  });
});
