import { Codex, type ThreadEvent, type ThreadOptions, type TurnOptions } from "@openai/codex-sdk";
import {
  finishOperationTiming,
  runCommand,
  startOperationTiming,
  type CommandRunResult,
} from "./command-runner";
import type { AgentProfile, TaskSpec } from "./contracts";
import { buildCodexWorkerPrompt, type PreparedCodexDispatch } from "./codex-dispatch";
import type { WorkerRuntimeKind, WorkerRuntimeMetadata } from "./worker-runtime-metadata";

export interface WorkerRuntimeExecution {
  command: CommandRunResult;
  runtime: WorkerRuntimeMetadata;
}

export interface WorkerRuntimeAdapter {
  kind: WorkerRuntimeKind;
  prepare(input: {
    task: TaskSpec;
    agent: AgentProfile;
    worktreePath: string;
    codexBin?: string;
  }): PreparedCodexDispatch;
  execute(input: {
    dispatch: PreparedCodexDispatch;
    agent: AgentProfile;
    worktreePath: string;
    codexBin?: string;
    workerTimeoutMs: number;
  }): Promise<WorkerRuntimeExecution>;
}

export function buildExecJsonCommand(input: {
  agent: AgentProfile;
  worktreePath: string;
  prompt: string;
  codexBin?: string;
}): string[] {
  const command = [
    input.codexBin ?? "codex",
    "exec",
    "--cd",
    input.worktreePath,
    "--sandbox",
    input.agent.writerClass === "non-writer" ? "read-only" : "workspace-write",
    "--json",
    "-c",
    'approval_policy="never"',
  ];

  if (input.agent.model) {
    command.push("--model", input.agent.model);
  }
  if (input.agent.codexProfile) {
    command.push("--profile", input.agent.codexProfile);
  }

  command.push(input.prompt);
  return command;
}

export const execJsonWorkerRuntimeAdapter: WorkerRuntimeAdapter = {
  kind: "exec-json",
  prepare(input) {
    const prompt = buildCodexWorkerPrompt(input.task, input.agent);
    return {
      prompt,
      command: buildExecJsonCommand({
        agent: input.agent,
        worktreePath: input.worktreePath,
        prompt,
        codexBin: input.codexBin,
      }),
    };
  },
  async execute(input) {
    return {
      command: await runCommand(input.dispatch.command, { timeoutMs: input.workerTimeoutMs }),
      runtime: { kind: "exec-json", approvalPolicy: "never" },
    };
  },
};

interface CodexSdkThread {
  id: string | null;
  runStreamed(input: string, turnOptions?: TurnOptions): Promise<{ events: AsyncGenerator<ThreadEvent> }>;
}

interface CodexSdkClient {
  startThread(options?: ThreadOptions): CodexSdkThread;
}

const CODEX_SDK_TIMEOUT = Symbol("codex-sdk-timeout");
const CODEX_SDK_TIMEOUT_EXIT_CODE = 124;
const CODEX_SDK_TIMEOUT_DETAILS = {
  reason: "command-timeout" as const,
  signal: "SIGTERM" as const,
};

export function buildCodexSdkCommand(input: {
  agent: AgentProfile;
  worktreePath: string;
}): string[] {
  const command = [
    "codex-sdk",
    "run",
    "--cd",
    input.worktreePath,
    "--sandbox",
    input.agent.writerClass === "non-writer" ? "read-only" : "workspace-write",
  ];

  if (input.agent.model) {
    command.push("--model", input.agent.model);
  }

  return command;
}

export function createCodexSdkWorkerRuntimeAdapter(input: {
  createClient?: (codexBin?: string) => CodexSdkClient;
} = {}): WorkerRuntimeAdapter {
  return {
    kind: "codex-sdk",
    prepare(run) {
      const prompt = buildCodexWorkerPrompt(run.task, run.agent);
      return {
        prompt,
        command: buildCodexSdkCommand({
          agent: run.agent,
          worktreePath: run.worktreePath,
        }),
      };
    },
    async execute(run) {
      const eventCounts: Record<string, number> = {};
      let finalResponse = "";
      let threadId: string | undefined;
      let thread: CodexSdkThread | undefined;
      let runtimeError: string | undefined;
      const timing = startOperationTiming();

      try {
        const client =
          input.createClient?.(run.codexBin) ??
          new Codex(run.codexBin ? { codexPathOverride: run.codexBin } : undefined);
        thread = client.startThread({
          workingDirectory: run.worktreePath,
          model: run.agent.model,
          sandboxMode: run.agent.writerClass === "non-writer" ? "read-only" : "workspace-write",
          approvalPolicy: "never",
        });

        const abortController = new AbortController();
        let timeoutFired = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<typeof CODEX_SDK_TIMEOUT>((resolve) => {
          timeoutId = setTimeout(() => {
            timeoutFired = true;
            abortController.abort();
            resolve(CODEX_SDK_TIMEOUT);
          }, run.workerTimeoutMs);
        });
        const raceWithTimeout = <T>(promise: Promise<T>): Promise<T | typeof CODEX_SDK_TIMEOUT> =>
          Promise.race([promise, timeout]);
        const timeoutResult = (): WorkerRuntimeExecution => {
          threadId ??= thread?.id ?? undefined;
          return {
            command: {
              command: run.dispatch.command,
              exitCode: CODEX_SDK_TIMEOUT_EXIT_CODE,
              stdout: finalResponse,
              stderr: `codex-sdk runtime timed out after ${run.workerTimeoutMs}ms`,
              timedOut: true,
              timeoutMs: run.workerTimeoutMs,
              timeoutDetails: CODEX_SDK_TIMEOUT_DETAILS,
              ...finishOperationTiming(timing),
            },
            runtime: {
              kind: "codex-sdk",
              approvalPolicy: "never",
              ...(threadId ? { threadId } : {}),
              eventCounts,
            },
          };
        };

        try {
          const stream = await raceWithTimeout(
            thread.runStreamed(run.dispatch.prompt, { signal: abortController.signal }),
          );
          if (stream === CODEX_SDK_TIMEOUT) return timeoutResult();

          const events = stream.events[Symbol.asyncIterator]();
          while (true) {
            const next = await raceWithTimeout(events.next());
            if (next === CODEX_SDK_TIMEOUT) {
              const close = events.return?.(undefined);
              if (close) void close.catch(() => undefined);
              return timeoutResult();
            }
            if (next.done) break;

            const event = next.value;
            eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
            if (event.type === "thread.started") {
              threadId = event.thread_id;
            } else if (event.type === "item.completed" && event.item.type === "agent_message") {
              finalResponse = event.item.text;
            } else if (event.type === "turn.failed") {
              runtimeError = event.error.message;
            } else if (event.type === "error") {
              runtimeError = event.message;
            }
          }
        } catch (err) {
          if (timeoutFired) return timeoutResult();
          throw err;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
        threadId ??= thread.id ?? undefined;

        return {
          command: {
            command: run.dispatch.command,
            exitCode: runtimeError ? 1 : 0,
            stdout: finalResponse,
            stderr: runtimeError ?? "",
            ...finishOperationTiming(timing),
          },
          runtime: {
            kind: "codex-sdk",
            approvalPolicy: "never",
            ...(threadId ? { threadId } : {}),
            eventCounts,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        threadId ??= thread?.id ?? undefined;
        return {
          command: {
            command: run.dispatch.command,
            exitCode: 1,
            stdout: finalResponse,
            stderr: `codex-sdk runtime failed: ${message}`,
            ...finishOperationTiming(timing),
          },
          runtime: {
            kind: "codex-sdk",
            approvalPolicy: "never",
            ...(threadId ? { threadId } : {}),
            eventCounts,
          },
        };
      }
    },
  };
}

export function workerRuntimeAdapterForKind(kind: WorkerRuntimeKind): WorkerRuntimeAdapter {
  return kind === "codex-sdk" ? createCodexSdkWorkerRuntimeAdapter() : execJsonWorkerRuntimeAdapter;
}
