import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunIndex, type RunSummary } from "../src/core/ledger";
import { listRuns } from "../src/core/run-list";
import type { RunLifecycleRecord } from "../src/core/run-lifecycle-store";

let tmpRoots: string[] = [];

function runSummary(runId: string, root: string): RunSummary {
  return {
    schemaVersion: 1,
    runId,
    taskId: "list-fixture",
    taskTitle: "List fixture",
    agentId: "codex-worker",
    repoRoot: "/repo",
    worktreePath: "/repo/worktrees/list-fixture",
    logPath: join(root, "logs", `${runId}.json`),
    startedAt: "2026-05-12T10:00:00.000Z",
    finishedAt: "2026-05-12T10:01:00.000Z",
    outcome: "pass",
    pass: true,
    commit: "a".repeat(40),
  };
}

function lifecycleRecord(runId: string, logPath: string): RunLifecycleRecord {
  return {
    schemaVersion: 1,
    runId,
    taskId: "list-fixture",
    repoRoot: "/repo",
    runLogPath: logPath,
    commit: "a".repeat(40),
    mergedAt: "2026-05-12T10:02:00.000Z",
    cleanedAt: "2026-05-12T10:03:00.000Z",
    updatedAt: "2026-05-12T10:03:00.000Z",
  };
}

async function appendSummary(runsDir: string, summary: RunSummary): Promise<void> {
  await new RunIndex(join(runsDir, "index.jsonl")).append(summary);
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("listRuns", () => {
  test("includes lifecycle evidence for a merged and cleaned run", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-list-"));
    tmpRoots.push(root);
    const runsDir = join(root, "runs");
    const summary = runSummary("run-1", root);
    const lifecycle = lifecycleRecord("run-1", summary.logPath);
    await appendSummary(runsDir, summary);
    await writeFile(join(runsDir, "run-lifecycle.jsonl"), `${JSON.stringify(lifecycle)}\n`, "utf8");

    await expect(listRuns({ runsDir })).resolves.toEqual([
      {
        ...summary,
        lifecycle,
      },
    ]);
  });

  test("returns lifecycle null when no lifecycle record matches the run", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-run-list-"));
    tmpRoots.push(root);
    const runsDir = join(root, "runs");
    const summary = runSummary("run-without-record", root);
    const otherLifecycle = lifecycleRecord("other-run", join(root, "logs", "other-run.json"));
    await appendSummary(runsDir, summary);
    await writeFile(join(runsDir, "run-lifecycle.jsonl"), `${JSON.stringify(otherLifecycle)}\n`, "utf8");

    await expect(listRuns({ runsDir })).resolves.toEqual([
      {
        ...summary,
        lifecycle: null,
      },
    ]);
  });
});
