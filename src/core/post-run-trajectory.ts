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

export async function recordMergeChecked(
  runLogPath: string,
  result: MergeGateResult,
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
  });
}

export async function recordLifecycleMarked(
  runLogPath: string,
  event: RunLifecycleEvent,
  record: RunLifecycleRecord,
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
  });
}

export async function recordCleanupFinished(
  runLogPath: string,
  result: WorktreeCleanupResult,
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
  });
}
