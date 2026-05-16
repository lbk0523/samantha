import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { RunIndex, summarizeWorkerRun, type RunOutcome, type RunSummary } from "./ledger";
import { RunLifecycleStore, type RunLifecycleRecord } from "./run-lifecycle-store";
import { taskFamily } from "./task-family";
import type { WorkerRunLog } from "./run-log";

export interface LessonDraftInput {
  runLogPath: string;
  repoRoot?: string;
  stateDir?: string;
}

export interface LessonDraftWrite {
  path: string;
  runId: string;
}

export type AcceptedRunLessonDraftStatus = "created" | "already_exists" | "skipped";

export interface AcceptedRunLessonDraftResult {
  status: AcceptedRunLessonDraftStatus;
  reason: string;
  path?: string;
  runId?: string;
}

interface LessonClassification {
  proposedLesson: string;
  affectedLayer: string;
  suggestedArtifactType: string;
  riskIfAdopted: string;
}

interface SupersededContext {
  summary: RunSummary;
  lifecycle: RunLifecycleRecord | undefined;
  kind: "accepted_cleaned" | "clean_report_only";
}

interface RecurrenceContext {
  taskFamily: string;
  outcome: RunOutcome;
  count: number;
  threshold: number;
}

interface LearningTriggerContext {
  eligible: boolean;
  reason: string;
}

const RECURRENCE_PROMOTION_THRESHOLD = 2;

async function readRunLog(path: string): Promise<WorkerRunLog> {
  return JSON.parse(await readFile(path, "utf8")) as WorkerRunLog;
}

function lifecycleStorePath(input: { runLogPath: string; stateDir?: string }): string {
  return join(resolve(input.stateDir ?? dirname(input.runLogPath)), "run-lifecycle.jsonl");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

function markdownCode(value: string): string {
  return `\`${value.replace(/`/g, "\\`")}\``;
}

function renderList(items: string[]): string {
  if (items.length === 0) return "- none";
  return items.map((item) => `- ${markdownCode(item)}`).join("\n");
}

function renderVerification(log: WorkerRunLog): string {
  const results = log.result.evaluation?.verifyResults;
  if (!results) return "- not recorded";
  if (results.length === 0) {
    return log.task.verifyCommands.length === 0 ? "- no verify commands declared" : "- not run";
  }

  const passed = results.filter((result) => result.exitCode === 0).length;
  const failed = results.length - passed;
  return [
    `- ${passed} passed, ${failed} failed`,
    ...results.map((result) => {
      const status = result.exitCode === 0 ? "pass" : "fail";
      return `- ${markdownCode(result.command)} -> ${status} (${result.exitCode})`;
    }),
  ].join("\n");
}

function lifecycleState(record: RunLifecycleRecord | undefined): string {
  if (!record) return "not recorded";
  if (record.mergedAt && record.cleanedAt) return "merged and cleaned";
  if (record.cleanedAt) return "cleaned";
  if (record.mergedAt) return "merged";
  return "recorded";
}

function renderLifecycle(record: RunLifecycleRecord | undefined): string {
  const lines = [`- Lifecycle state: ${lifecycleState(record)}`];
  if (record?.mergedAt) lines.push(`- Merged at: ${record.mergedAt}`);
  if (record?.cleanedAt) lines.push(`- Cleaned at: ${record.cleanedAt}`);
  if (record?.updatedAt) lines.push(`- Lifecycle updated at: ${record.updatedAt}`);
  return lines.join("\n");
}

function renderSupersededContext(context: SupersededContext | undefined): string {
  if (!context) return "- Superseded status: not detected";

  const lines = [
    `- Superseded status: ${
      context.kind === "accepted_cleaned"
        ? "superseded by accepted and cleaned run"
        : "superseded by clean report-only run"
    }`,
    `- Superseding run id: ${context.summary.runId}`,
    `- Superseding task id: ${context.summary.taskId}`,
    `- Superseding outcome: ${context.summary.outcome}`,
    `- Superseding lifecycle state: ${lifecycleState(context.lifecycle)}`,
  ];
  if (context.summary.commit) lines.push(`- Superseding commit: ${context.summary.commit}`);
  return lines.join("\n");
}

function classifyLesson(outcome: RunOutcome, superseded: SupersededContext | undefined): LessonClassification {
  if (superseded) {
    return {
      proposedLesson: "Treat this candidate as stale unless the same failure recurs after the superseding run.",
      affectedLayer: "evidence",
      suggestedArtifactType: "run summary / no promotion",
      riskIfAdopted: "Promoting superseded evidence can add process for a problem that was already resolved.",
    };
  }

  switch (outcome) {
    case "pass":
      return {
        proposedLesson: "Preserve this task shape as a candidate repeatable pattern only if it recurs.",
        affectedLayer: "playbook",
        suggestedArtifactType: "playbook",
        riskIfAdopted: "Promoting one smooth run too early can turn a lucky path into unnecessary doctrine.",
      };
    case "setup_failed":
      return {
        proposedLesson: "Capture setup prerequisites in the task spec or playbook before dispatch.",
        affectedLayer: "task template",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Overfitting setup guidance can make simple tasks carry irrelevant prerequisites.",
      };
    case "scope_failed":
      return {
        proposedLesson: "Tighten task scope or policy coverage before dispatching similar work.",
        affectedLayer: "policy",
        suggestedArtifactType: "policy/test change",
        riskIfAdopted: "Over-tight policy can block valid future work unless the pattern is recurring.",
      };
    case "verify_failed":
      return {
        proposedLesson: "Add or adjust focused verification before dispatching similar tasks.",
        affectedLayer: "task template",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Overfitting to one verification failure can make future tasks slower without reducing real risk.",
      };
    case "missing_harness_result":
      return {
        proposedLesson: "Make HARNESS_RESULT requirements harder for workers to miss.",
        affectedLayer: "agent profile",
        suggestedArtifactType: "agent profile revision",
        riskIfAdopted: "Too much prompt ceremony can distract workers from the actual task contract.",
      };
    case "commit_failed":
      return {
        proposedLesson: "Keep worker output commit-ready before Samantha attempts the owned commit.",
        affectedLayer: "dispatch",
        suggestedArtifactType: "playbook",
        riskIfAdopted: "Adding broad commit handling can hide real repository hygiene problems.",
      };
    case "worker_failed":
      return {
        proposedLesson: "Narrow similar tasks so worker command failures leave actionable evidence.",
        affectedLayer: "task template",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Treating one worker failure as a template issue can obscure transient execution failures.",
      };
    case "rework":
    case "blocked":
      return {
        proposedLesson: "Clarify the task contract before dispatching similar work.",
        affectedLayer: "contract",
        suggestedArtifactType: "task template or playbook",
        riskIfAdopted: "Premature contract changes can add process without removing ambiguity.",
      };
    case "failed":
      return {
        proposedLesson: "Review the run evidence before changing durable Samantha behavior.",
        affectedLayer: "evidence",
        suggestedArtifactType: "run summary",
        riskIfAdopted: "A generic failure can produce vague guidance that future tasks cannot enforce.",
      };
  }
}

function isReportOnlyRun(log: WorkerRunLog): boolean {
  return log.task.resultMode === "report" || log.agent.writerClass === "non-writer";
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

async function supersededContext(input: {
  log: WorkerRunLog;
  runLogPath: string;
  outcome: RunOutcome;
}): Promise<SupersededContext | undefined> {
  const reportOnly = isReportOnlyRun(input.log);
  if (!reportOnly && input.outcome !== "blocked" && input.outcome !== "rework") return undefined;
  if (reportOnly && input.outcome === "pass") return undefined;

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
      const candidateLog = await readRunLog(summary.logPath);
      if (isCleanPassingReportRun(candidateLog)) {
        return { summary, lifecycle: undefined, kind: "clean_report_only" };
      }
    }

    return undefined;
  }

  const lifecycleRecords = await new RunLifecycleStore(lifecycleStorePath({ runLogPath: input.runLogPath })).list();
  const lifecycleByRunId = new Map(lifecycleRecords.map((record) => [record.runId, record]));
  const summary = summaries.find((candidate) => {
    return (
      candidate.runId !== input.log.runId &&
      candidate.finishedAt > input.log.finishedAt &&
      taskFamily(candidate.taskId) === sourceFamily &&
      candidate.pass === true &&
      candidate.commit.trim().length > 0 &&
      hasCleanedLifecycle(candidate, lifecycleByRunId.get(candidate.runId))
    );
  });

  return summary
    ? { summary, lifecycle: lifecycleByRunId.get(summary.runId), kind: "accepted_cleaned" }
    : undefined;
}

async function recurrenceContext(input: {
  log: WorkerRunLog;
  runLogPath: string;
  outcome: RunOutcome;
}): Promise<RecurrenceContext> {
  const evidenceDir = dirname(input.runLogPath);
  const sourceFamily = taskFamily(input.log.task.id);
  const summaries = await new RunIndex(join(evidenceDir, "index.jsonl")).list();
  const matchingPriorRuns = summaries.filter((summary) => {
    return (
      summary.runId !== input.log.runId &&
      summary.finishedAt <= input.log.finishedAt &&
      taskFamily(summary.taskId) === sourceFamily &&
      summary.outcome === input.outcome
    );
  });

  return {
    taskFamily: sourceFamily,
    outcome: input.outcome,
    count: matchingPriorRuns.length + 1,
    threshold: RECURRENCE_PROMOTION_THRESHOLD,
  };
}

async function learningTriggerContext(input: {
  log: WorkerRunLog;
  runLogPath: string;
}): Promise<LearningTriggerContext> {
  const evidenceDir = dirname(input.runLogPath);
  const sourceFamily = taskFamily(input.log.task.id);
  const summaries = await new RunIndex(join(evidenceDir, "index.jsonl")).list();
  const priorSameFamily = summaries.filter((summary) => {
    return (
      summary.runId !== input.log.runId &&
      summary.finishedAt <= input.log.finishedAt &&
      taskFamily(summary.taskId) === sourceFamily
    );
  });
  const priorOutcomes = new Set(priorSameFamily.map((summary) => summary.outcome));
  const priorFailures = priorSameFamily.filter((summary) => summary.outcome !== "pass");

  if (priorOutcomes.has("verify_failed")) {
    return { eligible: true, reason: "verify_failed recovery success" };
  }
  if (priorOutcomes.has("scope_failed")) {
    return { eligible: true, reason: "scope violation corrected by accepted run" };
  }
  if (priorOutcomes.has("blocked") || priorOutcomes.has("rework")) {
    return { eligible: true, reason: "blocked or rework run corrected by accepted run" };
  }
  if (priorFailures.length >= RECURRENCE_PROMOTION_THRESHOLD) {
    return { eligible: true, reason: "repeated same-family failures corrected by accepted run" };
  }

  return {
    eligible: false,
    reason: "accepted writer run has no high-signal learning trigger evidence",
  };
}

function candidatePathForRun(input: { repoRoot: string; runId: string }): string {
  return join(input.repoRoot, "references", "lessons", "inbox", `${input.runId}.md`);
}

function buildLessonMarkdown(input: {
  log: WorkerRunLog;
  runLogPath: string;
  lifecycle: RunLifecycleRecord | undefined;
  superseded: SupersededContext | undefined;
  recurrence: RecurrenceContext;
}): string {
  const summary = summarizeWorkerRun({
    task: input.log.task,
    agent: input.log.agent,
    repoRoot: input.log.input.repoRoot,
    worktreesDir: input.log.input.worktreesDir,
    startedAt: input.log.startedAt,
    finishedAt: input.log.finishedAt,
    execution: input.log.result,
    runId: input.log.runId,
    logPath: input.runLogPath,
  });
  const classification = classifyLesson(summary.outcome, input.superseded);
  const changedFiles = [...(input.log.result.evaluation?.changedFiles ?? input.log.result.commit?.files ?? [])].sort();

  return `# Lesson Candidate: ${input.log.runId}

## Source
- Source run id: ${input.log.runId}
- Task id: ${input.log.task.id}
- Task title: ${input.log.task.title}
- Run log: ${input.runLogPath}

## Evidence
- Observed outcome: ${summary.outcome}
${summary.failureReason ? `- Failure reason: ${summary.failureReason}\n` : ""}
### Changed Files
${renderList(changedFiles)}

### Verification Summary
${renderVerification(input.log)}

### Lifecycle
${renderLifecycle(input.lifecycle)}

### Superseded Context
${renderSupersededContext(input.superseded)}

### Recurrence
- Task family: ${input.recurrence.taskFamily}
- Recurrence outcome: ${input.recurrence.outcome}
- Recurrence count: ${input.recurrence.count}
- Promotion threshold: ${input.recurrence.threshold}

## Proposed Lesson
- Proposed lesson: ${classification.proposedLesson}
- Affected layer: ${classification.affectedLayer}
- Suggested artifact type: ${classification.suggestedArtifactType}
- Risk if adopted: ${classification.riskIfAdopted}
- Review note: Review manually before promotion. This candidate must not modify promoted artifacts by itself.
`;
}

export async function draftLessonFromRunLog(input: LessonDraftInput): Promise<LessonDraftWrite> {
  const runLogPath = resolve(input.runLogPath);
  const repoRoot = resolve(input.repoRoot ?? ".");
  const log = await readRunLog(runLogPath);
  const lifecycle = await new RunLifecycleStore(
    lifecycleStorePath({ runLogPath, stateDir: input.stateDir }),
  ).find(log.runId);
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
  const superseded = await supersededContext({ log, runLogPath, outcome: summary.outcome });
  const recurrence = await recurrenceContext({ log, runLogPath, outcome: summary.outcome });
  const inboxDir = join(repoRoot, "references", "lessons", "inbox");
  const path = candidatePathForRun({ repoRoot, runId: log.runId });

  await mkdir(inboxDir, { recursive: true });
  await writeFile(path, buildLessonMarkdown({ log, runLogPath, lifecycle, superseded, recurrence }), "utf8");

  return { path, runId: log.runId };
}

export async function draftLessonFromAcceptedRun(
  input: LessonDraftInput,
): Promise<AcceptedRunLessonDraftResult> {
  const runLogPath = resolve(input.runLogPath);
  const repoRoot = resolve(input.repoRoot ?? ".");
  const log = await readRunLog(runLogPath);
  const path = candidatePathForRun({ repoRoot, runId: log.runId });

  if (isReportOnlyRun(log)) {
    return { status: "skipped", reason: "report-only run is not an automatic lesson draft target" };
  }
  if (!log.result.pass) {
    return { status: "skipped", reason: "run did not pass Samantha evaluation" };
  }
  if (!log.result.commit?.commitHash) {
    return { status: "skipped", reason: "writer run has no candidate commit" };
  }

  const lifecycle = await new RunLifecycleStore(
    lifecycleStorePath({ runLogPath, stateDir: input.stateDir }),
  ).find(log.runId);
  if (!lifecycle?.cleanedAt) {
    return { status: "skipped", reason: "run is not accepted and cleaned" };
  }
  if (await fileExists(path)) {
    return {
      status: "already_exists",
      reason: "lesson candidate already exists",
      path,
      runId: log.runId,
    };
  }
  const trigger = await learningTriggerContext({ log, runLogPath });
  if (!trigger.eligible) {
    return { status: "skipped", reason: trigger.reason };
  }

  const draft = await draftLessonFromRunLog(input);
  return {
    status: "created",
    reason: trigger.reason,
    path: draft.path,
    runId: draft.runId,
  };
}
