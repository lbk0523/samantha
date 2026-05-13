import { mkdir, readFile, writeFile } from "node:fs/promises";
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

export type WorkerRunTrajectoryEvent =
  | "planned"
  | "worktree_created"
  | "worker_dispatched"
  | "worker_output_received"
  | "harness_result_parsed"
  | "verification_started"
  | "verification_finished"
  | "merge_checked"
  | "lifecycle_marked"
  | "cleanup_finished";

export type WorkerRunTrajectoryStatus = "completed" | "failed" | "skipped";

export interface WorkerRunTrajectoryEntry {
  sequence: number;
  event: WorkerRunTrajectoryEvent;
  status: WorkerRunTrajectoryStatus;
  note: string;
  details?: Record<string, string | number | boolean | string[]>;
}

export type WorkerRunTrajectoryEntryInput = Omit<WorkerRunTrajectoryEntry, "sequence">;

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
  trajectory?: WorkerRunTrajectoryEntry[];
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

export function buildWorkerRunTrajectory(input: WorkerRunLogInput): WorkerRunTrajectoryEntry[] {
  const execution = input.execution;
  const entries: Omit<WorkerRunTrajectoryEntry, "sequence">[] = [
    execution.dispatchError
      ? {
          event: "planned",
          status: "failed",
          note: "dispatch blocked before worker start",
          details: {
            taskId: input.task.id,
            agentId: input.agent.id,
            reason: execution.dispatchError,
          },
        }
      : {
          event: "planned",
          status: "completed",
          note: "task accepted for worker dispatch",
          details: {
            taskId: input.task.id,
            agentId: input.agent.id,
          },
        },
    execution.preparation.allocation
      ? {
          event: "worktree_created",
          status: "completed",
          note: "worker worktree allocated",
          details: {
            worktreePath: execution.preparation.worktreePath,
            branch: execution.preparation.allocation.branch,
            baseCommit: execution.preparation.allocation.baseCommit,
          },
        }
      : {
          event: "worktree_created",
          status: "skipped",
          note: execution.dispatchError
            ? "dispatch blocked before worktree allocation"
            : "worker did not use an allocated worktree",
          details: {
            worktreePath: execution.preparation.worktreePath,
          },
        },
    execution.command
      ? {
          event: "worker_dispatched",
          status: "completed",
          note: "worker command started",
          details: {
            command: execution.command.command,
          },
        }
      : {
          event: "worker_dispatched",
          status: "skipped",
          note: "worker command was not run",
        },
    execution.command
      ? {
          event: "worker_output_received",
          status: execution.command.exitCode === 0 ? "completed" : "failed",
          note: "worker command finished",
          details: {
            exitCode: execution.command.exitCode,
          },
        }
      : {
          event: "worker_output_received",
          status: "skipped",
          note: "worker output was not available",
        },
    execution.evaluation?.harness
      ? {
          event: "harness_result_parsed",
          status: "completed",
          note: "HARNESS_RESULT parsed",
          details: {
            harnessStatus: execution.evaluation.harness.status,
          },
        }
      : execution.evaluation?.parseError
        ? {
            event: "harness_result_parsed",
            status: "failed",
            note: "HARNESS_RESULT parse failed",
            details: {
              parseError: execution.evaluation.parseError,
            },
          }
        : {
            event: "harness_result_parsed",
            status: "skipped",
            note: "worker result was not evaluated",
          },
  ];
  const verifyResults = execution.evaluation?.verifyResults ?? [];

  if (verifyResults.length > 0) {
    const failed = verifyResults.filter((result) => result.exitCode !== 0).length;
    const passed = verifyResults.length - failed;
    entries.push(
      {
        event: "verification_started",
        status: "completed",
        note: "declared verification commands started",
        details: {
          commandCount: verifyResults.length,
        },
      },
      {
        event: "verification_finished",
        status: failed === 0 ? "completed" : "failed",
        note: "declared verification commands finished",
        details: {
          passed,
          failed,
        },
      },
    );
  } else {
    entries.push(
      {
        event: "verification_started",
        status: "skipped",
        note: "verification commands were not run",
      },
      {
        event: "verification_finished",
        status: "skipped",
        note: "verification results were not available",
      },
    );
  }

  return entries.map((entry, index) => ({
    sequence: index + 1,
    ...entry,
  }));
}

export async function appendWorkerRunTrajectoryEntry(
  runLogPath: string,
  input: WorkerRunTrajectoryEntryInput,
): Promise<WorkerRunTrajectoryEntry> {
  const log = JSON.parse(await readFile(runLogPath, "utf8")) as WorkerRunLog;
  const trajectory = log.trajectory ?? [];
  const lastSequence = trajectory.reduce((max, entry) => Math.max(max, entry.sequence), 0);
  const entry: WorkerRunTrajectoryEntry = {
    sequence: lastSequence + 1,
    ...input,
  };
  const updated: WorkerRunLog = {
    ...log,
    trajectory: [...trajectory, entry],
  };

  await writeFile(runLogPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");

  return entry;
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
    trajectory: buildWorkerRunTrajectory(input),
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
