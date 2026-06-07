import { afterEach, describe, expect, test } from "bun:test";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendRunEvent,
  readRunEvents,
  runEventsPath,
  waitForRunEvent,
} from "../src/core/run-events";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

async function makeRunsDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-run-events-"));
  tmpRoots.push(root);
  return join(root, "runs");
}

describe("run events", () => {
  test("appends JSONL events and reads recent events with filters", async () => {
    const runsDir = await makeRunsDir();
    await appendRunEvent({
      runsDir,
      eventId: "event-1",
      createdAt: "2026-06-07T00:00:00.000Z",
      event: {
        eventType: "worker_turn_completed",
        runId: "run-1",
        taskId: "task-1",
        worktreePath: "/tmp/worktree-1",
        workerExitCode: 0,
        pass: true,
        runtimeKind: "codex-sdk",
        threadId: "thread-1",
        harnessResultStatus: "pass",
      },
    });
    await appendRunEvent({
      runsDir,
      eventId: "event-2",
      createdAt: "2026-06-07T00:00:01.000Z",
      event: {
        eventType: "worker_run_log_written",
        runId: "run-1",
        taskId: "task-1",
        runLogPath: "/tmp/runs/run-1.json",
        pass: true,
        outcome: "pass",
        harnessResultStatus: "pass",
      },
    });
    await appendRunEvent({
      runsDir,
      eventId: "event-3",
      createdAt: "2026-06-07T00:00:02.000Z",
      event: {
        eventType: "worker_run_log_written",
        runId: "run-2",
        taskId: "task-2",
        runLogPath: "/tmp/runs/run-2.json",
        pass: false,
        outcome: "blocked",
      },
    });

    const all = await readRunEvents({ runsDir });
    expect(all.events.map((event) => event.eventId)).toEqual(["event-1", "event-2", "event-3"]);
    expect(all.malformedLines).toEqual([]);

    const filtered = await readRunEvents({
      runsDir,
      filter: { eventType: "worker_run_log_written", taskId: "task-1" },
    });
    expect(filtered.events.map((event) => event.eventId)).toEqual(["event-2"]);

    const recent = await readRunEvents({ runsDir, filter: { eventType: "worker_run_log_written" }, limit: 1 });
    expect(recent.events.map((event) => event.eventId)).toEqual(["event-3"]);
  });

  test("reports malformed lines without trusting them", async () => {
    const runsDir = await makeRunsDir();
    await appendRunEvent({
      runsDir,
      eventId: "event-good",
      createdAt: "2026-06-07T00:00:00.000Z",
      event: {
        eventType: "worker_run_log_written",
        runId: "run-good",
        taskId: "task-good",
        runLogPath: "/tmp/runs/run-good.json",
        pass: true,
        harnessResultStatus: "pass",
      },
    });
    await appendFile(runEventsPath({ runsDir }), "{not-json}\n", "utf8");
    await appendFile(
      runEventsPath({ runsDir }),
      `${JSON.stringify({
        schemaVersion: 1,
        eventId: "event-extra",
        eventType: "worker_run_log_written",
        runId: "run-extra",
        taskId: "task-extra",
        createdAt: "2026-06-07T00:00:01.000Z",
        advisoryOnly: true,
        runLogPath: "/tmp/runs/run-extra.json",
        pass: true,
        automaticAccept: true,
      })}\n`,
      "utf8",
    );

    const result = await readRunEvents({ runsDir });
    expect(result.events.map((event) => event.eventId)).toEqual(["event-good"]);
    expect(result.malformedLines).toEqual([
      { lineNumber: 2, reason: expect.stringContaining("JSON") },
      { lineNumber: 3, reason: "unexpected event field(s): automaticAccept" },
    ]);
  });

  test("waits for a matching event and times out when none arrives", async () => {
    const runsDir = await makeRunsDir();
    const wait = waitForRunEvent({
      runsDir,
      filter: { eventType: "worker_turn_completed", taskId: "task-wait" },
      timeoutMs: 250,
      pollIntervalMs: 5,
    });
    setTimeout(() => {
      void appendRunEvent({
        runsDir,
        eventId: "event-wait",
        createdAt: "2026-06-07T00:00:00.000Z",
        event: {
          eventType: "worker_turn_completed",
          runId: "run-wait",
          taskId: "task-wait",
          worktreePath: "/tmp/worktree-wait",
          workerExitCode: 0,
          pass: true,
        },
      });
    }, 10);

    await expect(wait).resolves.toMatchObject({
      status: "found",
      event: {
        eventId: "event-wait",
        runId: "run-wait",
        taskId: "task-wait",
      },
    });

    await expect(
      waitForRunEvent({
        runsDir,
        filter: { eventType: "worker_run_log_written", runId: "missing-run" },
        timeoutMs: 20,
        pollIntervalMs: 5,
      }),
    ).resolves.toMatchObject({
      status: "timeout",
      timeoutMs: 20,
    });
  });
});
