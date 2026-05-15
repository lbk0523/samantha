import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TaskSpec } from "./contracts";
import { readWorkerRunLog } from "./merge-gate";
import type { WorkerRunLog } from "./run-log";

export type ReadinessStatus = "clear" | "missing" | "stale" | "blocked";

export interface ReadinessCheck {
  id: string;
  status: ReadinessStatus;
  reason: string;
  evidence: string[];
}

export interface InitiativeSlice {
  slice: string;
  status: string;
  objective: string;
  dependsOn: string;
  verification: string;
  nextPrompt: string;
}

export interface InitiativeReadiness {
  path: string;
  title: string;
  status: string | null;
  currentSlice: InitiativeSlice | null;
  slices: InitiativeSlice[];
  checks: ReadinessCheck[];
}

export interface PlanCompletionAudit {
  taskPath: string | null;
  runLogPath: string | null;
  taskId: string;
  runId: string | null;
  status: ReadinessStatus;
  checks: ReadinessCheck[];
}

export interface ReadinessReport {
  schemaVersion: 1;
  overallStatus: ReadinessStatus;
  recommendation: string;
  initiative: InitiativeReadiness | null;
  planCompletion: PlanCompletionAudit | null;
  checks: ReadinessCheck[];
}

export interface BuildReadinessReportInput {
  initiativePath?: string;
  taskPath?: string;
  runLogPath?: string;
}

const INITIATIVE_SLICE_STATUSES = new Set([
  "completed",
  "active",
  "ready",
  "pending",
  "blocked",
  "dropped",
]);

function combineStatus(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "blocked")) return "blocked";
  if (checks.some((check) => check.status === "stale")) return "stale";
  if (checks.some((check) => check.status === "missing")) return "missing";
  return "clear";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasHeading(markdown: string, heading: string): boolean {
  return new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, "m").test(markdown);
}

function markdownSection(markdown: string, heading: string): string | null {
  const start = markdown.search(new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, "m"));
  if (start === -1) return null;

  const afterHeading = markdown.indexOf("\n", start);
  const sectionStart = afterHeading === -1 ? markdown.length : afterHeading + 1;
  const rest = markdown.slice(sectionStart);
  const nextHeading = rest.search(/^##\s/m);
  return (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
}

function parseInitiativeTitle(markdown: string): string {
  const match = markdown.match(/^# Initiative:\s*(.+?)\s*$/m) ?? markdown.match(/^#\s+(.+?)\s*$/m);
  return match?.[1] ?? "(untitled initiative)";
}

function parseInitiativeStatus(markdown: string): string | null {
  return markdown.match(/^Status:\s*(.+?)\s*$/m)?.[1] ?? null;
}

function parseSliceQueue(markdown: string): InitiativeSlice[] {
  const section = markdownSection(markdown, "Slice Queue");
  if (!section) return [];

  return section
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 6)
    .filter((cells) => cells[0] !== "Slice" && !cells.every((cell) => /^-+$/.test(cell)))
    .map((cells) => ({
      slice: cells[0],
      status: cells[1],
      objective: cells[2],
      dependsOn: cells[3],
      verification: cells[4],
      nextPrompt: cells[5],
    }));
}

function currentExpectedSlice(slices: InitiativeSlice[]): InitiativeSlice | null {
  return (
    slices.find((slice) => slice.status === "active") ??
    slices.find((slice) => slice.status === "ready") ??
    null
  );
}

function checkInitiativeSections(markdown: string): ReadinessCheck {
  const missing = [
    "Goal",
    "Accepted Decisions",
    "Non-Goals",
    "Invariants",
    "Slice Queue",
    "Current Next Slice",
    "End-of-Session Update Rule",
    "Completion Rule",
  ].filter((heading) => !hasHeading(markdown, heading));
  const hasSource = /^Source:\s*.+$/m.test(markdown) || hasHeading(markdown, "Source");
  if (!hasSource) missing.unshift("Source");

  return {
    id: "initiative.sections",
    status: missing.length === 0 ? "clear" : "missing",
    reason:
      missing.length === 0
        ? "initiative brief has the required continuity sections"
        : `initiative brief is missing required continuity sections: ${missing.join(", ")}`,
    evidence: missing,
  };
}

function checkInitiativeSlices(slices: InitiativeSlice[]): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const invalidStatuses = slices.filter((slice) => !INITIATIVE_SLICE_STATUSES.has(slice.status));
  const activeSlices = slices.filter((slice) => slice.status === "active");
  const readySlices = slices.filter((slice) => slice.status === "ready");
  const blockedSlices = slices.filter((slice) => slice.status === "blocked");

  checks.push({
    id: "initiative.slice-statuses",
    status: invalidStatuses.length === 0 ? "clear" : "blocked",
    reason:
      invalidStatuses.length === 0
        ? "all slice statuses use the Initiative Continuity Brief vocabulary"
        : `unknown slice statuses: ${invalidStatuses.map((slice) => `${slice.slice}:${slice.status}`).join(", ")}`,
    evidence: invalidStatuses.map((slice) => `${slice.slice}:${slice.status}`),
  });

  if (slices.length === 0) {
    checks.push({
      id: "initiative.slice-queue",
      status: "missing",
      reason: "initiative brief has no slice queue entries",
      evidence: [],
    });
    return checks;
  }

  let queueStatus: ReadinessStatus = "clear";
  let queueReason = "slice queue has a single active or ready next slice";
  if (activeSlices.length > 1) {
    queueStatus = "blocked";
    queueReason = "slice queue has more than one active slice";
  } else if (activeSlices.length === 0 && readySlices.length > 1) {
    queueStatus = "stale";
    queueReason = "slice queue has more than one ready slice and no active slice";
  } else if (activeSlices.length === 0 && readySlices.length === 0) {
    const terminal = slices.every((slice) => slice.status === "completed" || slice.status === "dropped");
    queueStatus = terminal ? "clear" : "missing";
    queueReason = terminal
      ? "all slices are terminal"
      : "slice queue has no active or ready slice";
  }

  checks.push({
    id: "initiative.slice-queue",
    status: queueStatus,
    reason: queueReason,
    evidence: [...activeSlices, ...readySlices].map((slice) => `${slice.slice}:${slice.status}`),
  });

  checks.push({
    id: "initiative.blockers",
    status: blockedSlices.length === 0 ? "clear" : "blocked",
    reason:
      blockedSlices.length === 0
        ? "no slices are marked blocked"
        : `blocked slices require recovery before the initiative can complete: ${blockedSlices
            .map((slice) => slice.slice)
            .join(", ")}`,
    evidence: blockedSlices.map((slice) => `${slice.slice}: ${slice.objective}`),
  });

  return checks;
}

function checkCurrentNextSlice(markdown: string, expected: InitiativeSlice | null): ReadinessCheck {
  const section = markdownSection(markdown, "Current Next Slice");
  if (!section) {
    return {
      id: "initiative.current-next-slice",
      status: "missing",
      reason: "initiative brief has no Current Next Slice section",
      evidence: [],
    };
  }
  if (!expected) {
    return {
      id: "initiative.current-next-slice",
      status: "clear",
      reason: "initiative has no active or ready slice to reference",
      evidence: [],
    };
  }
  const mentionsExpected = section.includes(expected.slice);
  return {
    id: "initiative.current-next-slice",
    status: mentionsExpected ? "clear" : "stale",
    reason: mentionsExpected
      ? `Current Next Slice references ${expected.slice}`
      : `Current Next Slice does not reference expected slice ${expected.slice}`,
    evidence: [section.slice(0, 500)],
  };
}

export function summarizeInitiativeBrief(input: {
  path: string;
  markdown: string;
}): InitiativeReadiness {
  const slices = parseSliceQueue(input.markdown);
  const currentSlice = currentExpectedSlice(slices);
  const initiativeStatus = parseInitiativeStatus(input.markdown);
  const checks: ReadinessCheck[] = [
    {
      id: "initiative.status",
      status: initiativeStatus ? "clear" : "missing",
      reason: initiativeStatus
        ? "initiative has a top-level status"
        : "initiative is missing a top-level Status line",
      evidence: initiativeStatus ? [initiativeStatus] : [],
    },
    checkInitiativeSections(input.markdown),
    ...checkInitiativeSlices(slices),
    checkCurrentNextSlice(input.markdown, currentSlice),
  ];

  return {
    path: resolve(input.path),
    title: parseInitiativeTitle(input.markdown),
    status: initiativeStatus,
    currentSlice,
    slices,
    checks,
  };
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function checkTaskIdentity(task: TaskSpec, log: WorkerRunLog): ReadinessCheck {
  const matches = task.id === log.task.id;
  return {
    id: "plan.task-identity",
    status: matches ? "clear" : "stale",
    reason: matches
      ? `run log matches task ${task.id}`
      : `run log task ${log.task.id} does not match task ${task.id}`,
    evidence: [`task:${task.id}`, `run:${log.task.id}`],
  };
}

function checkHarness(log: WorkerRunLog): ReadinessCheck {
  const harness = log.result.evaluation?.harness;
  if (!harness) {
    return {
      id: "plan.harness-result",
      status: "missing",
      reason: "run log has no parsed HARNESS_RESULT",
      evidence: [],
    };
  }
  return {
    id: "plan.harness-result",
    status: harness.status === "pass" ? "clear" : "blocked",
    reason:
      harness.status === "pass"
        ? "worker reported HARNESS_RESULT pass"
        : `worker reported HARNESS_RESULT ${harness.status}`,
    evidence: [harness.note],
  };
}

function checkScope(log: WorkerRunLog): ReadinessCheck {
  const evaluation = log.result.evaluation;
  if (!evaluation) {
    return {
      id: "plan.scope",
      status: "missing",
      reason: "run log has no Samantha evaluation",
      evidence: [],
    };
  }
  return {
    id: "plan.scope",
    status: evaluation.scopeViolations.length === 0 ? "clear" : "blocked",
    reason:
      evaluation.scopeViolations.length === 0
        ? "changed files stayed within declared task scope"
        : "changed files crossed declared task scope",
    evidence: evaluation.scopeViolations.map((violation) =>
      `${violation.file}:${violation.reason}${violation.matchedPattern ? `:${violation.matchedPattern}` : ""}`,
    ),
  };
}

function checkVerification(task: TaskSpec, log: WorkerRunLog): ReadinessCheck {
  const verifyResults = log.result.evaluation?.verifyResults ?? [];
  const byCommand = new Map(verifyResults.map((result) => [result.command, result]));
  const missing = task.verifyCommands.filter((command) => !byCommand.has(command));
  const failed = task.verifyCommands.filter((command) => byCommand.get(command)?.exitCode !== 0);

  if (missing.length > 0) {
    return {
      id: "plan.verification",
      status: "missing",
      reason: "run log is missing one or more declared verify commands",
      evidence: missing,
    };
  }
  if (failed.length > 0) {
    return {
      id: "plan.verification",
      status: "blocked",
      reason: "one or more declared verify commands failed",
      evidence: failed,
    };
  }
  return {
    id: "plan.verification",
    status: "clear",
    reason:
      task.verifyCommands.length === 0
        ? "task declares no verify commands"
        : "all declared verify commands passed",
    evidence: task.verifyCommands,
  };
}

function checkCommit(task: TaskSpec, log: WorkerRunLog): ReadinessCheck {
  const commit = log.result.commit?.commitHash ?? "";
  if (task.resultMode === "report") {
    return {
      id: "plan.commit",
      status: commit ? "blocked" : "clear",
      reason: commit
        ? "report-only task unexpectedly created a commit"
        : "report-only task did not create a commit",
      evidence: commit ? [commit] : [],
    };
  }
  return {
    id: "plan.commit",
    status: commit ? "clear" : "missing",
    reason: commit
      ? "writer run has a Samantha-owned candidate commit"
      : "writer run has no candidate commit",
    evidence: commit ? [commit] : [],
  };
}

function checkRunPass(log: WorkerRunLog): ReadinessCheck {
  return {
    id: "plan.run-pass",
    status: log.result.pass ? "clear" : "blocked",
    reason: log.result.pass
      ? "run passed Samantha evaluation"
      : "run did not pass Samantha evaluation",
    evidence: [log.runId],
  };
}

async function buildPlanCompletionAudit(input: {
  taskPath?: string;
  runLogPath?: string;
}): Promise<PlanCompletionAudit | null> {
  if (!input.taskPath && !input.runLogPath) return null;

  const runLog = input.runLogPath ? await readWorkerRunLog(resolve(input.runLogPath)) : null;
  const task = input.taskPath ? await readJson<TaskSpec>(resolve(input.taskPath)) : runLog?.task;
  if (!task) return null;

  const checks: ReadinessCheck[] = [
    {
      id: "plan.source",
      status: "clear",
      reason: input.taskPath ? "task spec loaded as plan source" : "run log embedded task used as plan source",
      evidence: [input.taskPath ? resolve(input.taskPath) : `run:${runLog?.runId ?? ""}`],
    },
  ];

  if (!runLog) {
    checks.push({
      id: "plan.run-evidence",
      status: "missing",
      reason: "no run log was provided for plan completion audit",
      evidence: [],
    });
    return {
      taskPath: input.taskPath ? resolve(input.taskPath) : null,
      runLogPath: null,
      taskId: task.id,
      runId: null,
      status: combineStatus(checks),
      checks,
    };
  }

  checks.push(
    {
      id: "plan.run-evidence",
      status: "clear",
      reason: "run log loaded as completion evidence",
      evidence: [resolve(input.runLogPath ?? "")],
    },
    checkTaskIdentity(task, runLog),
    checkHarness(runLog),
    checkScope(runLog),
    checkVerification(task, runLog),
    checkCommit(task, runLog),
    checkRunPass(runLog),
  );

  return {
    taskPath: input.taskPath ? resolve(input.taskPath) : null,
    runLogPath: input.runLogPath ? resolve(input.runLogPath) : null,
    taskId: task.id,
    runId: runLog.runId,
    status: combineStatus(checks),
    checks,
  };
}

function recommendationForReport(input: {
  overallStatus: ReadinessStatus;
  initiative: InitiativeReadiness | null;
  planCompletion: PlanCompletionAudit | null;
  checks: ReadinessCheck[];
}): string {
  const firstProblem = input.checks.find((check) => check.status !== "clear");
  if (firstProblem) {
    return `${firstProblem.status}: ${firstProblem.reason}`;
  }
  if (input.initiative?.currentSlice) {
    return `start ${input.initiative.currentSlice.slice}: ${input.initiative.currentSlice.objective}`;
  }
  if (input.planCompletion) {
    return "plan completion evidence is clear; proceed to the next Samantha-owned gate";
  }
  return `readiness ${input.overallStatus}`;
}

export async function buildReadinessReport(
  input: BuildReadinessReportInput,
): Promise<ReadinessReport> {
  const initiative = input.initiativePath
    ? summarizeInitiativeBrief({
        path: input.initiativePath,
        markdown: await readFile(resolve(input.initiativePath), "utf8"),
      })
    : null;
  const planCompletion = await buildPlanCompletionAudit(input);
  const checks = [...(initiative?.checks ?? []), ...(planCompletion?.checks ?? [])];
  const overallStatus = combineStatus(checks);

  return {
    schemaVersion: 1,
    overallStatus,
    recommendation: recommendationForReport({
      overallStatus,
      initiative,
      planCompletion,
      checks,
    }),
    initiative,
    planCompletion,
    checks,
  };
}
