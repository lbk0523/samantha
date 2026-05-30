import type { HarnessStatus } from "./contracts";
import type { WorkerRunLog, WorkerRunTrajectoryEntry } from "./run-log";
import type { VerifyCommandResult, WorkerResultEvaluation } from "./worker-result";

export type ThreadNavigationStatus = "available" | "missing";
export type HarnessVisibilityStatus = HarnessStatus | "missing";
export type TopLevelPassStatus = boolean | "missing";
export type CandidateCommitStatus = "present" | "missing";
export type ScopeStatus = "in_scope" | "violations" | "missing" | "unknown";
export type VerificationStatus = "passed" | "failed" | "missing" | "unknown";
export type MergeStatus = "completed" | "checked" | "failed" | "not_started" | "unknown";
export type CleanupStatus = "completed" | "failed" | "not_started" | "unknown";
export type FinalGitStatus = "not_captured" | "clean" | "dirty" | "unavailable";

export interface RunVisibilitySummary {
  threadNavigation: {
    status: ThreadNavigationStatus;
    threadId: string | null;
  };
  harnessStatus: HarnessVisibilityStatus;
  topLevelPass: TopLevelPassStatus;
  candidateCommitStatus: CandidateCommitStatus;
  candidateCommitHash: string | null;
  scopeStatus: ScopeStatus;
  changedFileCount: number | null;
  scopeViolationCount: number | null;
  verificationStatus: VerificationStatus;
  verificationResultCount: number | null;
  mergeStatus: MergeStatus;
  cleanupStatus: CleanupStatus;
  finalGitStatus: FinalGitStatus;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function arrayField<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? value : null;
}

function summarizeScope(evaluation: Partial<WorkerResultEvaluation> | undefined): Pick<
  RunVisibilitySummary,
  "scopeStatus" | "changedFileCount" | "scopeViolationCount"
> {
  if (!evaluation) {
    return {
      scopeStatus: "unknown",
      changedFileCount: null,
      scopeViolationCount: null,
    };
  }

  const scopeViolations = arrayField(evaluation.scopeViolations);
  const changedFiles = arrayField(evaluation.changedFiles);

  if (!scopeViolations) {
    return {
      scopeStatus: "missing",
      changedFileCount: changedFiles?.length ?? null,
      scopeViolationCount: null,
    };
  }

  if (scopeViolations.length > 0) {
    return {
      scopeStatus: "violations",
      changedFileCount: changedFiles?.length ?? null,
      scopeViolationCount: scopeViolations.length,
    };
  }

  return {
    scopeStatus: changedFiles ? "in_scope" : "unknown",
    changedFileCount: changedFiles?.length ?? null,
    scopeViolationCount: 0,
  };
}

function summarizeVerification(
  evaluation: Partial<WorkerResultEvaluation> | undefined,
): Pick<RunVisibilitySummary, "verificationStatus" | "verificationResultCount"> {
  if (!evaluation) {
    return {
      verificationStatus: "unknown",
      verificationResultCount: null,
    };
  }

  const verifyResults = arrayField<VerifyCommandResult>(evaluation.verifyResults);
  if (!verifyResults || verifyResults.length === 0) {
    return {
      verificationStatus: "missing",
      verificationResultCount: verifyResults?.length ?? null,
    };
  }

  if (verifyResults.some((result) => typeof result.exitCode !== "number")) {
    return {
      verificationStatus: "unknown",
      verificationResultCount: verifyResults.length,
    };
  }

  return {
    verificationStatus: verifyResults.some((result) => result.exitCode !== 0)
      ? "failed"
      : "passed",
    verificationResultCount: verifyResults.length,
  };
}

function lastTrajectoryEntry(
  trajectory: WorkerRunTrajectoryEntry[] | undefined,
  event: WorkerRunTrajectoryEntry["event"],
): WorkerRunTrajectoryEntry | undefined {
  return trajectory?.filter((entry) => entry.event === event).at(-1);
}

function summarizeMerge(trajectory: WorkerRunTrajectoryEntry[] | undefined): MergeStatus {
  const mergeFinished = lastTrajectoryEntry(trajectory, "merge_finished");
  if (mergeFinished?.status === "completed") return "completed";
  if (mergeFinished?.status === "failed") return "failed";
  if (mergeFinished) return "unknown";

  const mergeChecked = lastTrajectoryEntry(trajectory, "merge_checked");
  if (mergeChecked?.status === "completed") return "checked";
  if (mergeChecked?.status === "failed") return "failed";
  if (mergeChecked) return "unknown";

  return "not_started";
}

function summarizeCleanup(trajectory: WorkerRunTrajectoryEntry[] | undefined): CleanupStatus {
  const cleanupFinished = lastTrajectoryEntry(trajectory, "cleanup_finished");
  if (cleanupFinished?.status === "completed") return "completed";
  if (cleanupFinished?.status === "failed") return "failed";
  if (cleanupFinished) return "unknown";
  return "not_started";
}

function isCapturedFinalGitStatus(value: unknown): value is Exclude<FinalGitStatus, "not_captured"> {
  return value === "clean" || value === "dirty" || value === "unavailable";
}

function summarizeFinalGitStatus(
  trajectory: WorkerRunTrajectoryEntry[] | undefined,
): FinalGitStatus {
  const finalGitStatusCaptured = lastTrajectoryEntry(trajectory, "final_git_status_captured");
  if (!finalGitStatusCaptured) return "not_captured";
  if (finalGitStatusCaptured.status !== "completed") return "unavailable";

  const finalGitStatus = finalGitStatusCaptured.details?.finalGitStatus;
  return isCapturedFinalGitStatus(finalGitStatus) ? finalGitStatus : "unavailable";
}

export function buildRunVisibilitySummary(log: WorkerRunLog): RunVisibilitySummary {
  const threadId = log.result.runtime?.threadId;
  const commitHash = log.result.commit?.commitHash;
  const evaluation = log.result.evaluation;
  const scope = summarizeScope(evaluation);
  const verification = summarizeVerification(evaluation);

  return {
    threadNavigation: {
      status: nonEmptyString(threadId) ? "available" : "missing",
      threadId: nonEmptyString(threadId) ? threadId : null,
    },
    harnessStatus: evaluation?.harness?.status ?? "missing",
    topLevelPass: typeof log.result.pass === "boolean" ? log.result.pass : "missing",
    candidateCommitStatus: nonEmptyString(commitHash) ? "present" : "missing",
    candidateCommitHash: nonEmptyString(commitHash) ? commitHash : null,
    ...scope,
    ...verification,
    mergeStatus: summarizeMerge(log.trajectory),
    cleanupStatus: summarizeCleanup(log.trajectory),
    finalGitStatus: summarizeFinalGitStatus(log.trajectory),
  };
}
