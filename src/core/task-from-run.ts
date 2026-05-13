import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { TaskSpec } from "./contracts";
import {
  diagnoseWorkerRun,
  type RecommendedNextAction,
  type RunDiagnosis,
} from "./run-diagnose";
import { RunIndex, type RunOutcome, type RunSummary } from "./ledger";
import { RunLifecycleStore, type RunLifecycleRecord } from "./run-lifecycle-store";
import type { WorkerRunLog } from "./run-log";
import type { ScopeViolation } from "./worker-result";

export interface CreateTaskFromRunInput {
  runLogPath: string;
  taskId: string;
  title: string;
  repoRoot?: string;
}

export type CreateTaskFromRunStatus = "created" | "refused";

export interface CreateTaskFromRunResult {
  status: CreateTaskFromRunStatus;
  created: boolean;
  runId: string;
  taskId: string;
  outcome: RunOutcome;
  recommendedNextAction: RecommendedNextAction;
  note: string;
  path?: string;
}

function assertFileStem(label: string, value: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`${label} must contain only letters, numbers, dots, underscores, or dashes`);
  }
}

function isReportOnlyRun(log: WorkerRunLog): boolean {
  return log.task.resultMode === "report" || log.agent.writerClass === "non-writer";
}

function refusalNote(log: WorkerRunLog, diagnosis: RunDiagnosis): string | undefined {
  if (diagnosis.outcome === "pass") {
    return isReportOnlyRun(log)
      ? "passing report-only run is evidence-only; no task was created"
      : "passing writer run should be accepted with runs:accept; no task was created";
  }
  if (diagnosis.outcome === "commit_failed") {
    return "commit failure requires explicit local inspection; no task was created and lifecycle is untrusted";
  }
  return undefined;
}

function taskFamily(taskId: string): string {
  return taskId.replace(/-v\d+$/, "");
}

function hasCleanedLifecycle(summary: RunSummary, record: RunLifecycleRecord | undefined): boolean {
  return Boolean(
    record?.cleanedAt &&
      record.commit === summary.commit &&
      taskFamily(record.taskId) === taskFamily(summary.taskId),
  );
}

function isCleanPassingReportRun(log: WorkerRunLog): boolean {
  const evaluation = log.result.evaluation;

  return Boolean(
    isReportOnlyRun(log) &&
      evaluation?.pass &&
      evaluation.harness?.status === "pass" &&
      evaluation.changedFiles.length === 0 &&
      evaluation.scopeViolations.length === 0,
  );
}

async function supersededRefusalNote(input: {
  log: WorkerRunLog;
  runLogPath: string;
  diagnosis: RunDiagnosis;
}): Promise<string | undefined> {
  const reportOnly = isReportOnlyRun(input.log);
  if (input.diagnosis.outcome === "pass" || input.diagnosis.outcome === "commit_failed") {
    return undefined;
  }

  const evidenceDir = dirname(input.runLogPath);
  const summaries = await new RunIndex(join(evidenceDir, "index.jsonl")).list();
  const sourceFamily = taskFamily(input.log.task.id);

  if (reportOnly) {
    const candidateSummaries = summaries.filter((summary) => {
      return (
        summary.runId !== input.log.runId &&
        summary.finishedAt > input.log.finishedAt &&
        taskFamily(summary.taskId) === sourceFamily &&
        summary.pass === true
      );
    });

    for (const summary of candidateSummaries) {
      const candidateLog = JSON.parse(await readFile(summary.logPath, "utf8")) as WorkerRunLog;
      if (isCleanPassingReportRun(candidateLog)) {
        return `run ${input.log.runId} was superseded by clean report-only run ${summary.runId}; no task was created`;
      }
    }

    return undefined;
  }

  const lifecycleRecords = await new RunLifecycleStore(join(evidenceDir, "run-lifecycle.jsonl")).list();
  const lifecycleByRunId = new Map(lifecycleRecords.map((record) => [record.runId, record]));
  const supersedingRun = summaries.find((summary) => {
    return (
      summary.runId !== input.log.runId &&
      summary.finishedAt > input.log.finishedAt &&
      taskFamily(summary.taskId) === sourceFamily &&
      summary.pass === true &&
      summary.commit.trim().length > 0 &&
      hasCleanedLifecycle(summary, lifecycleByRunId.get(summary.runId))
    );
  });

  return supersedingRun
    ? `run ${input.log.runId} was superseded by accepted and cleaned run ${supersedingRun.runId}; no task was created`
    : undefined;
}

function firstFailedVerifyCommand(log: WorkerRunLog): string | undefined {
  return log.result.evaluation?.verifyResults.find((result) => result.exitCode !== 0)?.command;
}

function firstFailedSetupCommand(log: WorkerRunLog): string | undefined {
  const failedIndex = log.result.setupResults.findIndex((result) => result.exitCode !== 0);
  if (failedIndex === -1) return undefined;
  return log.task.setupCommands?.[failedIndex] ?? log.result.setupResults[failedIndex]?.command.join(" ");
}

function uniqueCommands(commands: string[]): string[] {
  return Array.from(new Set(commands));
}

function verifyCommandsForRun(log: WorkerRunLog, outcome: RunOutcome): string[] {
  const original = log.task.verifyCommands;
  if (outcome === "verify_failed") {
    const failed = firstFailedVerifyCommand(log);
    return failed ? uniqueCommands([failed, ...original]) : original;
  }
  if (outcome === "setup_failed") {
    const failedSetup = firstFailedSetupCommand(log);
    return failedSetup ? uniqueCommands([failedSetup, ...original]) : original;
  }
  return original;
}

function formatScopeViolation(violation: ScopeViolation): string {
  const matched = violation.matchedPattern ? ` matched ${violation.matchedPattern}` : "";
  return `- ${violation.file}: ${violation.reason}${matched}`;
}

function diagnosisLine(diagnosis: RunDiagnosis): string {
  return diagnosis.failureReason
    ? `Diagnosis: ${diagnosis.outcome} (${diagnosis.failureReason}).`
    : `Diagnosis: ${diagnosis.outcome}.`;
}

function specificInstructions(log: WorkerRunLog, diagnosis: RunDiagnosis): string {
  if (diagnosis.outcome === "verify_failed") {
    const failed = firstFailedVerifyCommand(log) ?? "the failed verify command";
    return [
      "Create a rework fix for the failed verification.",
      `Keep this failed verify command in verifyCommands: ${failed}`,
      "Do not treat the previous worker output as accepted work until Samantha verification passes in the new run.",
    ].join("\n");
  }

  if (diagnosis.outcome === "scope_failed") {
    const violations = log.result.evaluation?.scopeViolations.map(formatScopeViolation).join("\n") || "- unavailable";
    return [
      "Create a narrower task and reject the previous worker output as untrusted.",
      "Samantha found these scope violations:",
      violations,
      "Change only the declared target files and do not copy violating output into the follow-up unless independently inspected and narrowed.",
    ].join("\n");
  }

  if (diagnosis.outcome === "setup_failed") {
    const failedSetup = firstFailedSetupCommand(log) ?? diagnosis.failureReason ?? "unknown setup command";
    return [
      "Focus on setup, task, or environment correction before feature work.",
      `The failed setup evidence was: ${failedSetup}`,
      "This follow-up intentionally starts without setupCommands so the worker can inspect and correct the setup failure, then prove the fix through verification.",
    ].join("\n");
  }

  if (diagnosis.outcome === "worker_failed" || diagnosis.outcome === "missing_harness_result") {
    return [
      "Start from run evidence inspection and narrow the task before changing files.",
      "Do not trust worker output, worker claims, or malformed HARNESS_RESULT content from the failed run.",
      "Only reuse an idea from the failed run after independently validating it against the repository.",
    ].join("\n");
  }

  if (diagnosis.outcome === "blocked" || diagnosis.outcome === "rework") {
    return [
      "Resolve the worker-reported blocker or rework reason using the run evidence.",
      "Keep the follow-up narrow and do not grant the worker lifecycle, merge, push, cleanup, or orchestration authority.",
    ].join("\n");
  }

  return [
    "Inspect the failed run evidence and narrow the follow-up before changing files.",
    "Do not trust failed worker output as accepted work.",
  ].join("\n");
}

function taskInstructions(input: {
  log: WorkerRunLog;
  runLogPath: string;
  diagnosis: RunDiagnosis;
}): string {
  return [
    "Create a narrowed follow-up from Samantha run evidence.",
    `Run log: ${input.runLogPath}`,
    `Original run: ${input.log.runId}`,
    `Original task: ${input.log.task.id} - ${input.log.task.title}`,
    diagnosisLine(input.diagnosis),
    "",
    specificInstructions(input.log, input.diagnosis),
    "",
    "Do not retry the previous run, dispatch agents, merge, clean up worktrees, push, draft lessons, promote learning artifacts, create hidden memory, or change lifecycle state. Samantha owns those transitions.",
  ].join("\n");
}

function buildTaskSpec(input: {
  log: WorkerRunLog;
  runLogPath: string;
  diagnosis: RunDiagnosis;
  taskId: string;
  title: string;
}): TaskSpec {
  const reportMode = isReportOnlyRun(input.log);
  const task: TaskSpec = {
    id: input.taskId,
    title: input.title,
    targetAgent: input.log.task.targetAgent,
    targetFiles: [...input.log.task.targetFiles],
    forbiddenChanges: [...input.log.task.forbiddenChanges],
    setupCommands:
      reportMode || input.diagnosis.outcome === "setup_failed"
        ? []
        : [...(input.log.task.setupCommands ?? [])],
    verifyCommands: reportMode ? [] : verifyCommandsForRun(input.log, input.diagnosis.outcome),
    instructions: taskInstructions(input),
    ...(reportMode ? { resultMode: "report" as const } : { expectedCommitSubject: `fix: ${input.title}` }),
    status: "pending",
  };

  return task;
}

export async function createTaskFromRun(input: CreateTaskFromRunInput): Promise<CreateTaskFromRunResult> {
  assertFileStem("task id", input.taskId);

  const runLogPath = resolve(input.runLogPath);
  const log = JSON.parse(await readFile(runLogPath, "utf8")) as WorkerRunLog;
  const diagnosis = diagnoseWorkerRun(log, runLogPath);
  const refusal = refusalNote(log, diagnosis);

  if (refusal) {
    return {
      status: "refused",
      created: false,
      runId: log.runId,
      taskId: input.taskId,
      outcome: diagnosis.outcome,
      recommendedNextAction: diagnosis.recommendedNextAction,
      note: refusal,
    };
  }

  const supersededRefusal = await supersededRefusalNote({ log, runLogPath, diagnosis });
  if (supersededRefusal) {
    return {
      status: "refused",
      created: false,
      runId: log.runId,
      taskId: input.taskId,
      outcome: diagnosis.outcome,
      recommendedNextAction: diagnosis.recommendedNextAction,
      note: supersededRefusal,
    };
  }

  const repoRoot = resolve(input.repoRoot ?? ".");
  const tasksDir = join(repoRoot, "references", "tasks");
  const path = join(tasksDir, `${input.taskId}.json`);
  const task = buildTaskSpec({
    log,
    runLogPath,
    diagnosis,
    taskId: input.taskId,
    title: input.title,
  });

  await mkdir(tasksDir, { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(task, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`task already exists: ${input.taskId}`);
    }
    throw err;
  }

  return {
    status: "created",
    created: true,
    runId: log.runId,
    taskId: input.taskId,
    outcome: diagnosis.outcome,
    recommendedNextAction: diagnosis.recommendedNextAction,
    note: "created follow-up task from run evidence",
    path,
  };
}
