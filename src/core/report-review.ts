import { resolve } from "node:path";
import { readWorkerRunLog } from "./merge-gate";
import type { WorkerRunLog } from "./run-log";

export type ReportReviewEvidenceStatus = "accepted" | "rejected";

export interface ReportReviewEvidence {
  runId: string;
  taskId: string;
  taskTitle: string;
  agentId: string;
  status: ReportReviewEvidenceStatus;
  harnessStatus: string | null;
  harnessNote: string | null;
  outputExcerpt: string;
  violations: string[];
}

export interface ReportReviewDecisionPoint {
  owner: "samantha";
  reviewerAuthority: "advice-only";
  trustedStateChanges: false;
  recommendation: "review_reports" | "inspect_rejected_runs";
  reason: string;
}

export interface ReportReviewSummary {
  schemaVersion: 1;
  runLogPaths: string[];
  runCount: number;
  acceptedReportCount: number;
  rejectedReportCount: number;
  decisionPoint: ReportReviewDecisionPoint;
  reports: ReportReviewEvidence[];
}

export interface SummarizeReportOnlyReviewsInput {
  runLogPaths: string[];
}

function reportOutput(log: WorkerRunLog): string {
  const command = log.result.command;
  if (!command) return "";
  return [command.stdout, command.stderr]
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .filter((line) => !line.startsWith("HARNESS_RESULT:"))
    .join("\n")
    .trim()
    .slice(0, 2000);
}

function reportOnlyViolations(log: WorkerRunLog): string[] {
  const violations: string[] = [];
  const execution = log.result;
  const evaluation = execution.evaluation;

  if (log.task.resultMode !== "report") {
    violations.push("task resultMode is not report");
  }
  if (log.agent.writerClass !== "non-writer") {
    violations.push("agent writerClass is not non-writer");
  }
  if (!execution.pass) {
    violations.push("report-only run did not pass Samantha evaluation");
  }
  if (!execution.command) {
    violations.push("report-only run did not produce reviewer output");
  }
  if (execution.preparation.allocation) {
    violations.push("report-only run allocated a worktree");
  }
  if (execution.setupResults.length > 0) {
    violations.push("report-only run executed setup commands");
  }
  if ((evaluation?.verifyResults ?? []).length > 0) {
    violations.push("report-only run executed verify commands");
  }
  if ((evaluation?.changedFiles ?? []).length > 0) {
    violations.push("report-only run changed files");
  }
  if ((evaluation?.scopeViolations ?? []).length > 0) {
    violations.push("report-only run has scope violations");
  }
  if (execution.commit) {
    violations.push("report-only run created a commit");
  }

  return violations;
}

export function summarizeReportReviewLog(log: WorkerRunLog): ReportReviewEvidence {
  const violations = reportOnlyViolations(log);
  const harness = log.result.evaluation?.harness;

  return {
    runId: log.runId,
    taskId: log.task.id,
    taskTitle: log.task.title,
    agentId: log.agent.id,
    status: violations.length === 0 ? "accepted" : "rejected",
    harnessStatus: harness?.status ?? null,
    harnessNote: harness?.note ?? null,
    outputExcerpt: reportOutput(log),
    violations,
  };
}

export async function summarizeReportOnlyReviews(
  input: SummarizeReportOnlyReviewsInput,
): Promise<ReportReviewSummary> {
  if (input.runLogPaths.length === 0) {
    throw new Error("reports:summarize requires at least one --run-log");
  }

  const runLogPaths = input.runLogPaths.map((path) => resolve(path));
  const logs = await Promise.all(runLogPaths.map((path) => readWorkerRunLog(path)));
  const reports = logs.map((log) => summarizeReportReviewLog(log));
  const rejectedReportCount = reports.filter((report) => report.status === "rejected").length;
  const acceptedReportCount = reports.length - rejectedReportCount;
  const recommendation = rejectedReportCount > 0 ? "inspect_rejected_runs" : "review_reports";

  return {
    schemaVersion: 1,
    runLogPaths,
    runCount: reports.length,
    acceptedReportCount,
    rejectedReportCount,
    decisionPoint: {
      owner: "samantha",
      reviewerAuthority: "advice-only",
      trustedStateChanges: false,
      recommendation,
      reason:
        recommendation === "inspect_rejected_runs"
          ? "one or more reviewer runs crossed report-only boundaries"
          : "reviewer outputs are evidence only and require a Samantha follow-up decision",
    },
    reports,
  };
}
