import type { OperationTiming } from "./command-runner";
import type { MergeGateResult } from "./merge-gate";
import type { RunLifecycleEvent, RunLifecycleRecord } from "./run-lifecycle-store";
import {
  appendWorkerRunTrajectoryEntry,
  type WorkerRunTrajectoryEntry,
  type WorkerRunTrajectoryStatus,
} from "./run-log";
import type { WorktreeCleanupResult } from "./worktree-cleanup";

function mergeStatus(result: MergeGateResult): WorkerRunTrajectoryStatus {
  return result.mayMerge || result.alreadyMerged ? "completed" : "failed";
}

function cleanupStatus(result: WorktreeCleanupResult): WorkerRunTrajectoryStatus {
  if (result.cleaned) return "completed";
  return result.violations.length > 0 ? "failed" : "skipped";
}

function timingFields(timing: OperationTiming | undefined): Partial<WorkerRunTrajectoryEntry> {
  return timing
    ? {
        startedAt: timing.startedAt,
        finishedAt: timing.finishedAt,
        durationMs: timing.durationMs,
      }
    : {};
}

export async function recordMergeChecked(
  runLogPath: string,
  result: MergeGateResult,
  timing?: OperationTiming,
): Promise<WorkerRunTrajectoryEntry> {
  return appendWorkerRunTrajectoryEntry(runLogPath, {
    event: "merge_checked",
    status: mergeStatus(result),
    note: "merge gate checked",
    details: {
      mergeStatus: result.status,
      mayMerge: result.mayMerge,
      alreadyMerged: result.alreadyMerged,
      targetBranch: result.targetBranch,
      violationCount: result.violations.length,
      ...(result.commit ? { commit: result.commit } : {}),
      ...(result.command ? { command: result.command } : {}),
      ...(result.violations.length > 0 ? { violations: result.violations } : {}),
    },
    ...timingFields(timing),
  });
}

export async function recordMergeFinished(
  runLogPath: string,
  result: {
    command: string[];
    exitCode: number;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
  },
): Promise<WorkerRunTrajectoryEntry> {
  return appendWorkerRunTrajectoryEntry(runLogPath, {
    event: "merge_finished",
    status: result.exitCode === 0 ? "completed" : "failed",
    note: "merge command finished",
    details: {
      command: result.command,
      exitCode: result.exitCode,
    },
    ...timingFields(
      result.startedAt && result.finishedAt && typeof result.durationMs === "number"
        ? {
            startedAt: result.startedAt,
            finishedAt: result.finishedAt,
            durationMs: result.durationMs,
          }
        : undefined,
    ),
  });
}

export async function recordLifecycleMarked(
  runLogPath: string,
  event: RunLifecycleEvent,
  record: RunLifecycleRecord,
  timing?: OperationTiming,
): Promise<WorkerRunTrajectoryEntry> {
  return appendWorkerRunTrajectoryEntry(runLogPath, {
    event: "lifecycle_marked",
    status: "completed",
    note: "run lifecycle marked",
    details: {
      event,
      commit: record.commit,
      ...(record.mergedAt ? { mergedAt: record.mergedAt } : {}),
      ...(record.cleanedAt ? { cleanedAt: record.cleanedAt } : {}),
      updatedAt: record.updatedAt,
    },
    ...timingFields(timing),
  });
}

export async function recordCleanupFinished(
  runLogPath: string,
  result: WorktreeCleanupResult,
  timing?: OperationTiming,
): Promise<WorkerRunTrajectoryEntry> {
  return appendWorkerRunTrajectoryEntry(runLogPath, {
    event: "cleanup_finished",
    status: cleanupStatus(result),
    note: "worker worktree cleanup finished",
    details: {
      classification: result.classification,
      mayCleanup: result.mayCleanup,
      cleaned: result.cleaned,
      targetBranch: result.targetBranch,
      worktreePath: result.worktreePath,
      branch: result.branch,
      ...(result.commit ? { commit: result.commit } : {}),
      ...(result.violations.length > 0 ? { violations: result.violations } : {}),
    },
    ...timingFields(timing),
  });
}
