import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordCleanupFinished,
  recordLifecycleMarked,
  recordMergeChecked,
} from "../src/core/post-run-trajectory";
import type { MergeGateResult } from "../src/core/merge-gate";
import type { RunLifecycleRecord } from "../src/core/run-lifecycle-store";
import type { WorkerRunLog } from "../src/core/run-log";
import type { WorktreeCleanupResult } from "../src/core/worktree-cleanup";

let tmpRoots: string[] = [];

function baseRunLog(): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId: "post-run-trajectory",
    startedAt: "2026-05-13T10:00:00.000Z",
    finishedAt: "2026-05-13T10:01:00.000Z",
    task: {
      id: "post-run-trajectory",
      title: "Post-run trajectory",
      taskFamily: "core-module",
      workMode: "tdd-first",
      riskClass: "lifecycle-sensitive",
      targetAgent: "codex-worker",
      targetFiles: ["allowed.txt"],
      forbiddenChanges: ["state/**"],
      verifyCommands: ["test -f allowed.txt"],
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
    input: { repoRoot: "/repo" },
    trajectory: [
      {
        sequence: 1,
        event: "planned",
        status: "completed",
        note: "task accepted for worker dispatch",
      },
    ],
    result: {
      preparation: {
        taskId: "post-run-trajectory",
        agentId: "codex-worker",
        worktreePath: "/repo/worktrees/post-run-trajectory",
        codex: { prompt: "prompt", command: ["codex", "exec"] },
      },
      setupResults: [],
      pass: true,
    },
  };
}

async function writeRunLog(root: string, log: WorkerRunLog): Promise<string> {
  const path = join(root, "run.json");
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return path;
}

async function readRunLog(path: string): Promise<WorkerRunLog> {
  return JSON.parse(await readFile(path, "utf8")) as WorkerRunLog;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("post-run trajectory", () => {
  test("appends merge, lifecycle, and cleanup events in order", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-post-run-trajectory-"));
    tmpRoots.push(root);
    const path = await writeRunLog(root, baseRunLog());
    const merge: MergeGateResult = {
      mayMerge: false,
      alreadyMerged: false,
      status: "dirty_target_repo",
      targetBranch: "main",
      commit: "a".repeat(40),
      violations: ["target repo has uncommitted changes"],
    };
    const lifecycle: RunLifecycleRecord = {
      schemaVersion: 1,
      runId: "post-run-trajectory",
      taskId: "post-run-trajectory",
      repoRoot: "/repo",
      runLogPath: path,
      commit: "a".repeat(40),
      mergedAt: "2026-05-13T10:02:00.000Z",
      updatedAt: "2026-05-13T10:02:00.000Z",
    };
    const cleanup: WorktreeCleanupResult = {
      mayCleanup: true,
      cleaned: true,
      classification: "completed",
      targetBranch: "main",
      worktreePath: "/repo/worktrees/post-run-trajectory",
      branch: "samantha/post-run-trajectory",
      commit: "a".repeat(40),
      violations: [],
    };

    await recordMergeChecked(path, merge);
    await recordLifecycleMarked(path, "merged", lifecycle);
    await recordCleanupFinished(path, cleanup);

    const log = await readRunLog(path);

    expect(log.trajectory?.map((entry) => entry.event)).toEqual([
      "planned",
      "merge_checked",
      "lifecycle_marked",
      "cleanup_finished",
    ]);
    expect(log.trajectory?.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4]);
    expect(log.trajectory?.[1]).toMatchObject({
      event: "merge_checked",
      status: "failed",
      details: {
        mergeStatus: "dirty_target_repo",
        mayMerge: false,
        violationCount: 1,
      },
    });
    expect(log.trajectory?.[2]).toMatchObject({
      event: "lifecycle_marked",
      status: "completed",
      details: {
        event: "merged",
        mergedAt: "2026-05-13T10:02:00.000Z",
      },
    });
    expect(log.trajectory?.[3]).toMatchObject({
      event: "cleanup_finished",
      status: "completed",
      details: {
        classification: "completed",
        cleaned: true,
      },
    });
  });

  test("can append to legacy run logs without trajectory", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-post-run-trajectory-"));
    tmpRoots.push(root);
    const log = baseRunLog();
    delete log.trajectory;
    const path = await writeRunLog(root, log);

    await recordMergeChecked(path, {
      mayMerge: true,
      alreadyMerged: false,
      status: "mergeable",
      targetBranch: "main",
      commit: "a".repeat(40),
      command: ["git", "merge", "--ff-only", "a".repeat(40)],
      violations: [],
    });

    const updated = await readRunLog(path);

    expect(updated.trajectory).toHaveLength(1);
    expect(updated.trajectory?.[0]).toMatchObject({
      sequence: 1,
      event: "merge_checked",
      status: "completed",
    });
  });
});
