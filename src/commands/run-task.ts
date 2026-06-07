import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentProfile, TaskSpec } from "../core/contracts";
import { RunIndex, summarizeWorkerRun, type RunSummary } from "../core/ledger";
import { buildProjectContext } from "../core/project-context";
import { projectPaths } from "../core/project-paths";
import { acquireProjectWriterLock, type ProjectWriterLockHandle } from "../core/project-writer-lock";
import { appendRunEvent } from "../core/run-events";
import { buildWorkerRunId, writeWorkerRunLog, type WorkerRunLogWrite } from "../core/run-log";
import { executeWorkerDispatch, type WorkerDispatchExecution } from "../core/worker-dispatch";
import { workerRuntimeAdapterForKind } from "../core/worker-runtime-adapter";
import type { WorkerRuntimeKind } from "../core/worker-runtime-metadata";

export interface RunTaskCommandInput {
  taskPath: string;
  repoRoot: string;
  agentPath?: string;
  worktreesDir?: string;
  runsDir?: string;
  codexBin?: string;
  runtimeKind?: WorkerRuntimeKind;
}

export interface RunTaskCommandResult {
  execution: WorkerDispatchExecution;
  runLog: WorkerRunLogWrite;
  runSummary: RunSummary;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function isDispatchBlock(err: unknown): err is Error {
  return err instanceof Error && err.message.startsWith("dispatch blocked:");
}

function blockedExecution(input: {
  task: TaskSpec;
  agent: AgentProfile;
  repoRoot: string;
  codexBin?: string;
  runtimeKind: WorkerRuntimeKind;
  error: Error;
}): WorkerDispatchExecution {
  const runtimeAdapter = workerRuntimeAdapterForKind(input.runtimeKind);
  return {
    preparation: {
      taskId: input.task.id,
      agentId: input.agent.id,
      worktreePath: input.repoRoot,
      codex: runtimeAdapter.prepare({
        task: input.task,
        agent: input.agent,
        worktreePath: input.repoRoot,
        codexBin: input.codexBin,
      }),
    },
    setupResults: [],
    dispatchError: input.error.message,
    pass: false,
  };
}

export async function runTaskCommand(input: RunTaskCommandInput): Promise<RunTaskCommandResult> {
  const task = await readJson<TaskSpec>(resolve(input.taskPath));
  const repoRoot = resolve(input.repoRoot);
  const projectContext = await buildProjectContext({ targetRepoRoot: repoRoot });
  const agent = await readJson<AgentProfile>(
    resolve(input.agentPath ?? projectPaths.agentProfilePath(projectContext, task.targetAgent)),
  );
  const runsDir = resolve(input.runsDir ?? projectPaths.runsDir(projectContext));
  const worktreesDir = input.worktreesDir ?? projectPaths.worktreesRoot(projectContext);
  const runtimeKind = input.runtimeKind ?? "codex-sdk";
  const startedAt = new Date().toISOString();
  const runId = buildWorkerRunId({ startedAt, taskId: task.id });
  let execution: WorkerDispatchExecution;
  let writerLock: ProjectWriterLockHandle | undefined;
  try {
    if (agent.writerClass === "writer" && task.resultMode !== "report") {
      writerLock = await acquireProjectWriterLock({
        projectContext,
        taskId: task.id,
        runId,
      });
    }
    execution = await executeWorkerDispatch({
      task,
      agent,
      repoRoot,
      worktreesDir,
      codexBin: input.codexBin,
      runtimeKind,
      hookRunId: runId,
      onWorkerTurnCompleted: async (event) => {
        await appendRunEvent({ runsDir, event });
      },
    });
  } catch (err) {
    if (!isDispatchBlock(err)) throw err;
    execution = blockedExecution({
      task,
      agent,
      repoRoot,
      codexBin: input.codexBin,
      runtimeKind,
      error: err,
    });
  } finally {
    await writerLock?.release();
  }
  const finishedAt = new Date().toISOString();
  const logInput = {
    task,
    agent,
    repoRoot,
    worktreesDir,
    startedAt,
    finishedAt,
    execution,
    ...(execution.hookEvidence ? { hookEvidence: execution.hookEvidence } : {}),
  };
  const runLog = await writeWorkerRunLog(runsDir, logInput);
  const runSummary = summarizeWorkerRun({
    ...logInput,
    runId: runLog.runId,
    logPath: runLog.path,
  });
  await new RunIndex(join(runsDir, "index.jsonl")).append(runSummary);
  await appendRunEvent({
    runsDir,
    event: {
      eventType: "worker_run_log_written",
      runId: runLog.runId,
      taskId: task.id,
      runLogPath: runLog.path,
      pass: execution.pass,
      outcome: runSummary.outcome,
      ...(execution.evaluation?.harness
        ? { harnessResultStatus: execution.evaluation.harness.status }
        : {}),
    },
  });

  return { execution, runLog, runSummary };
}
