import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentProfile, TaskSpec } from "../core/contracts";
import { RunIndex, summarizeWorkerRun, type RunSummary } from "../core/ledger";
import { writeWorkerRunLog, type WorkerRunLogWrite } from "../core/run-log";
import { executeWorkerDispatch, type WorkerDispatchExecution } from "../core/worker-dispatch";

export interface RunTaskCommandInput {
  taskPath: string;
  repoRoot: string;
  agentPath?: string;
  worktreesDir?: string;
  runsDir?: string;
  codexBin?: string;
}

export interface RunTaskCommandResult {
  execution: WorkerDispatchExecution;
  runLog: WorkerRunLogWrite;
  runSummary: RunSummary;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function defaultAgentPath(task: TaskSpec): string {
  return resolve("references", "agent-profiles", `${task.targetAgent}.json`);
}

export async function runTaskCommand(input: RunTaskCommandInput): Promise<RunTaskCommandResult> {
  const task = await readJson<TaskSpec>(resolve(input.taskPath));
  const agent = await readJson<AgentProfile>(resolve(input.agentPath ?? defaultAgentPath(task)));
  const repoRoot = resolve(input.repoRoot);
  const runsDir = resolve(input.runsDir ?? resolve(repoRoot, "runs"));
  const startedAt = new Date().toISOString();
  const execution = await executeWorkerDispatch({
    task,
    agent,
    repoRoot,
    worktreesDir: input.worktreesDir,
    codexBin: input.codexBin,
  });
  const finishedAt = new Date().toISOString();
  const logInput = {
    task,
    agent,
    repoRoot,
    worktreesDir: input.worktreesDir,
    startedAt,
    finishedAt,
    execution,
  };
  const runLog = await writeWorkerRunLog(runsDir, logInput);
  const runSummary = summarizeWorkerRun({
    ...logInput,
    runId: runLog.runId,
    logPath: runLog.path,
  });
  await new RunIndex(join(runsDir, "index.jsonl")).append(runSummary);

  return { execution, runLog, runSummary };
}
