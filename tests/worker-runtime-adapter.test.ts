import { describe, expect, test } from "bun:test";
import type { AgentProfile } from "../src/core/contracts";
import { createCodexSdkWorkerRuntimeAdapter } from "../src/core/worker-runtime-adapter";

const reviewer: AgentProfile = {
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
};

const dispatch = {
  prompt: "Review evidence and report only.",
  command: ["codex-sdk", "run", "--cd", "/tmp/samantha-worktree", "--sandbox", "read-only"],
};

function expectCommandTiming(result: {
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}): void {
  expect(result.startedAt).toBeTruthy();
  expect(result.finishedAt).toBeTruthy();
  expect(Number.isNaN(Date.parse(result.startedAt!))).toBe(false);
  expect(Number.isNaN(Date.parse(result.finishedAt!))).toBe(false);
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
}

describe("codex-sdk worker runtime adapter", () => {
  test("returns timeout evidence when a codex-sdk stream never completes", async () => {
    let observedSignal: AbortSignal | undefined;
    const adapter = createCodexSdkWorkerRuntimeAdapter({
      createClient: () => ({
        startThread: () => ({
          id: "thread-from-fake-sdk",
          async runStreamed(_input, turnOptions) {
            observedSignal = turnOptions?.signal;
            async function* events() {
              yield { type: "thread.started", thread_id: "thread-from-event" } as const;
              yield { type: "turn.started" } as const;
              yield {
                type: "item.completed",
                item: {
                  id: "message-1",
                  type: "agent_message",
                  text: "partial SDK response before timeout",
                },
              } as const;
              await new Promise<never>(() => undefined);
            }
            return { events: events() };
          },
        }),
      }),
    });

    const startedAt = Date.now();
    const result = await adapter.execute({
      dispatch,
      agent: reviewer,
      worktreePath: "/tmp/samantha-worktree",
      workerTimeoutMs: 25,
    });

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(observedSignal?.aborted).toBe(true);
    expect(result.command).toMatchObject({
      command: dispatch.command,
      exitCode: 124,
      stdout: "partial SDK response before timeout",
      stderr: "codex-sdk runtime timed out after 25ms",
      timedOut: true,
      timeoutMs: 25,
      timeoutDetails: {
        reason: "command-timeout",
        signal: "SIGTERM",
      },
    });
    expectCommandTiming(result.command);
    expect(result.runtime).toEqual({
      kind: "codex-sdk",
      approvalPolicy: "never",
      threadId: "thread-from-event",
      eventCounts: {
        "thread.started": 1,
        "turn.started": 1,
        "item.completed": 1,
      },
    });
  });

  test("returns timeout evidence when codex-sdk runStreamed never returns", async () => {
    let observedSignal: AbortSignal | undefined;
    const adapter = createCodexSdkWorkerRuntimeAdapter({
      createClient: () => ({
        startThread: () => ({
          id: "thread-before-stream",
          async runStreamed(_input, turnOptions) {
            observedSignal = turnOptions?.signal;
            return await new Promise<never>(() => undefined);
          },
        }),
      }),
    });

    const result = await adapter.execute({
      dispatch,
      agent: reviewer,
      worktreePath: "/tmp/samantha-worktree",
      workerTimeoutMs: 25,
    });

    expect(observedSignal?.aborted).toBe(true);
    expect(result.command).toMatchObject({
      exitCode: 124,
      stdout: "",
      stderr: "codex-sdk runtime timed out after 25ms",
      timedOut: true,
      timeoutMs: 25,
    });
    expect(result.runtime).toEqual({
      kind: "codex-sdk",
      approvalPolicy: "never",
      threadId: "thread-before-stream",
      eventCounts: {},
    });
  });
});
