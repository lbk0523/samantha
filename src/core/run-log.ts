import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "./contracts";
import type { WorkerDispatchExecution } from "./worker-dispatch";
import { sanitizeTaskId } from "./worktree";

export interface WorkerRunLogInput {
  task: TaskSpec;
  agent: AgentProfile;
  repoRoot: string;
  worktreesDir?: string;
  startedAt: string;
  finishedAt: string;
  execution: WorkerDispatchExecution;
}

export interface WorkerRunLog {
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  finishedAt: string;
  task: TaskSpec;
  agent: AgentProfile;
  input: {
    repoRoot: string;
    worktreesDir?: string;
  };
  result: WorkerDispatchExecution;
}

export interface WorkerRunLogWrite {
  path: string;
  runId: string;
}

export function timestampForFile(value: string): string {
  return value.replace(/[:.]/g, "-");
}

export function buildWorkerRunId(input: { startedAt: string; taskId: string }): string {
  return `${timestampForFile(input.startedAt)}-${sanitizeTaskId(input.taskId)}`;
}

export function buildWorkerRunLog(input: WorkerRunLogInput): WorkerRunLog {
  const runId = buildWorkerRunId({ startedAt: input.startedAt, taskId: input.task.id });

  return {
    schemaVersion: 1,
    runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    task: input.task,
    agent: input.agent,
    input: {
      repoRoot: input.repoRoot,
      ...(input.worktreesDir ? { worktreesDir: input.worktreesDir } : {}),
    },
    result: input.execution,
  };
}

export async function writeWorkerRunLog(
  logDir: string,
  input: WorkerRunLogInput,
): Promise<WorkerRunLogWrite> {
  const log = buildWorkerRunLog(input);
  const path = join(logDir, `${log.runId}.json`);

  await mkdir(logDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");

  return { path, runId: log.runId };
}
