import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { OperationTiming } from "./command-runner";
import type { AgentProfile, TaskSpec } from "./contracts";
import type { HookEvent, HookRunEvidence, TrustGateFinalResult } from "./hooks";
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
  hookEvidence?: WorkerRunHookEvidence;
}

export interface WorkerRunHookFileDigest {
  path: string;
  digest: string;
}

export interface WorkerRunHookDefinitionDigest extends WorkerRunHookFileDigest {
  hookId: string;
}

export interface WorkerRunHookEventEvidence {
  event: HookEvent;
  eventVersion: number;
  contextKeys: string[];
  contextBytes: number;
  trustGate?: TrustGateFinalResult;
  invocations: HookRunEvidence[];
}

export interface WorkerRunHookEvidence {
  policy: WorkerRunHookFileDigest;
  definitions: WorkerRunHookDefinitionDigest[];
  events: WorkerRunHookEventEvidence[];
}

export type WorkerRunTrajectoryEvent =
  | "planned"
  | "worktree_created"
  | "setup_finished"
  | "worker_dispatched"
  | "worker_output_received"
  | "harness_result_parsed"
  | "verification_started"
  | "verification_finished"
  | "worker_commit_finished"
  | "merge_checked"
  | "merge_finished"
  | "final_git_status_captured"
  | "lifecycle_marked"
  | "cleanup_finished";

export type WorkerRunTrajectoryStatus = "completed" | "failed" | "skipped";

export interface WorkerRunTrajectoryEntry {
  sequence: number;
  event: WorkerRunTrajectoryEvent;
  status: WorkerRunTrajectoryStatus;
  note: string;
  details?: Record<string, string | number | boolean | string[]>;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
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
  hookEvidence?: WorkerRunHookEvidence;
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

function timingFields(
  timing: Partial<OperationTiming> | undefined,
): Partial<WorkerRunTrajectoryEntry> {
  return isCompleteTiming(timing)
    ? {
        startedAt: timing.startedAt,
        finishedAt: timing.finishedAt,
        durationMs: timing.durationMs,
      }
    : {};
}

function isCompleteTiming(input: Partial<OperationTiming> | undefined): input is OperationTiming {
  return Boolean(input?.startedAt && input.finishedAt && typeof input.durationMs === "number");
}

function aggregateTiming(
  timings: Array<Partial<OperationTiming> | undefined>,
): OperationTiming | undefined {
  const complete = timings.filter(isCompleteTiming);
  if (complete.length === 0) return undefined;
  const startedAt = complete.reduce((earliest, timing) =>
    Date.parse(timing.startedAt) < Date.parse(earliest.startedAt) ? timing : earliest,
  ).startedAt;
  const finishedAt = complete.reduce((latest, timing) =>
    Date.parse(timing.finishedAt) > Date.parse(latest.finishedAt) ? timing : latest,
  ).finishedAt;
  return {
    startedAt,
    finishedAt,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
  };
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
          ...timingFields(execution.preparation.allocationTiming),
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
  ];

  if (execution.setupResults.length > 0) {
    const failed = execution.setupResults.filter((result) => result.exitCode !== 0).length;
    entries.push({
      event: "setup_finished",
      status: failed === 0 ? "completed" : "failed",
      note: "setup commands finished",
      details: {
        commandCount: execution.setupResults.length,
        passed: execution.setupResults.length - failed,
        failed,
      },
      ...timingFields(aggregateTiming(execution.setupResults)),
    });
  }

  entries.push(
    execution.command
      ? {
          event: "worker_dispatched",
          status: "completed",
          note: "worker command started",
          details: {
            command: execution.command.command,
            ...(execution.runtime ? { runtimeKind: execution.runtime.kind } : {}),
            ...(execution.runtime?.approvalPolicy
              ? { approvalPolicy: execution.runtime.approvalPolicy }
              : {}),
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
            ...(execution.evaluation?.workerVerifyEvidence
              ? { workerVerifyEvidence: execution.evaluation.workerVerifyEvidence.status }
              : {}),
          },
          ...timingFields(execution.command),
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
          ...timingFields(execution.evaluation.harnessTiming),
        }
      : execution.evaluation?.parseError
        ? {
            event: "harness_result_parsed",
            status: "failed",
            note: "HARNESS_RESULT parse failed",
            details: {
              parseError: execution.evaluation.parseError,
            },
            ...timingFields(execution.evaluation.harnessTiming),
          }
        : {
            event: "harness_result_parsed",
            status: "skipped",
            note: "worker result was not evaluated",
          },
  );
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
        ...timingFields(execution.evaluation?.verificationTiming ?? aggregateTiming(verifyResults)),
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

  if (execution.commit) {
    const commitFailed =
      execution.commit.add.exitCode !== 0 || execution.commit.commit.exitCode !== 0;
    entries.push({
      event: "worker_commit_finished",
      status: commitFailed ? "failed" : "completed",
      note: "worker commit finished",
      details: {
        subject: execution.commit.subject,
        fileCount: execution.commit.files.length,
        commitHash: execution.commit.commitHash,
      },
      ...timingFields(aggregateTiming([execution.commit.add, execution.commit.commit])),
    });
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
  const { hookEvidence: _transientHookEvidence, ...result } = input.execution;

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
    result,
    ...(input.hookEvidence ? { hookEvidence: input.hookEvidence } : {}),
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
