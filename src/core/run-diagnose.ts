import { readFile } from "node:fs/promises";
import { summarizeWorkerRun, type RunOutcome } from "./ledger";
import type { WorkerRunLog } from "./run-log";

export type RecommendedNextAction =
  | "runs:accept"
  | "record_report_evidence_do_not_merge"
  | "fix_setup_task_or_environment_and_rerun_new_task"
  | "inspect_evidence_then_narrow_or_rerun_with_explicit_reason"
  | "reject_output_and_create_narrower_task"
  | "create_rework_task_keep_failed_verify_command"
  | "inspect_locally_do_not_trust_worker_lifecycle"
  | "resolve_blocker_and_rerun_new_task";

export interface RunDiagnosis {
  outcome: RunOutcome;
  failureReason?: string;
  trustedWorkerOutput: boolean;
  recommendedNextAction: RecommendedNextAction;
}

function isReportOnlyRun(log: WorkerRunLog): boolean {
  return log.task.resultMode === "report" || log.agent.writerClass === "non-writer";
}

function recommendNextAction(log: WorkerRunLog, outcome: RunOutcome): RecommendedNextAction {
  if (outcome === "pass") {
    return isReportOnlyRun(log) ? "record_report_evidence_do_not_merge" : "runs:accept";
  }
  if (outcome === "setup_failed") {
    return "fix_setup_task_or_environment_and_rerun_new_task";
  }
  if (outcome === "scope_failed") {
    return "reject_output_and_create_narrower_task";
  }
  if (outcome === "verify_failed") {
    return "create_rework_task_keep_failed_verify_command";
  }
  if (outcome === "commit_failed") {
    return "inspect_locally_do_not_trust_worker_lifecycle";
  }
  if (outcome === "blocked") {
    return "resolve_blocker_and_rerun_new_task";
  }
  return "inspect_evidence_then_narrow_or_rerun_with_explicit_reason";
}

export function diagnoseWorkerRun(log: WorkerRunLog, runLogPath: string): RunDiagnosis {
  const summary = summarizeWorkerRun({
    task: log.task,
    agent: log.agent,
    repoRoot: log.input.repoRoot,
    worktreesDir: log.input.worktreesDir,
    startedAt: log.startedAt,
    finishedAt: log.finishedAt,
    execution: log.result,
    runId: log.runId,
    logPath: runLogPath,
  });

  return {
    outcome: summary.outcome,
    ...(summary.failureReason ? { failureReason: summary.failureReason } : {}),
    trustedWorkerOutput: summary.outcome === "pass",
    recommendedNextAction: recommendNextAction(log, summary.outcome),
  };
}

export async function diagnoseRun(input: { runLogPath: string }): Promise<RunDiagnosis> {
  const log = JSON.parse(await readFile(input.runLogPath, "utf8")) as WorkerRunLog;
  return diagnoseWorkerRun(log, input.runLogPath);
}
