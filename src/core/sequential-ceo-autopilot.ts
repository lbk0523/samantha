import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, posix, relative, resolve } from "node:path";
import type { TaskSpec } from "./contracts";
import { git, gitRaw } from "./git";

export const SEQUENTIAL_CONTINUATION_ACTION_TYPES = [
  "manual_decision",
  "report_only",
  "readiness_check",
  "run_task",
  "batch_plan",
] as const;
export type SequentialContinuationActionType = (typeof SEQUENTIAL_CONTINUATION_ACTION_TYPES)[number];

export const SEQUENTIAL_CONTINUATION_SLICE_STATUSES = [
  "completed",
  "active",
  "ready",
  "pending",
  "blocked",
  "dropped",
] as const;
export type SequentialContinuationSliceStatus = (typeof SEQUENTIAL_CONTINUATION_SLICE_STATUSES)[number];

export const SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS = [
  "run_log",
  "readiness_report",
  "continuation_report",
  "report_review",
] as const;
export type SequentialContinuationStatusEvidenceKind =
  (typeof SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS)[number];

export const SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS = [
  "passed",
  "clear",
  "completed",
  "blocked",
  "failed",
  "recommendation_only",
] as const;
export type SequentialContinuationStatusEvidenceResult =
  (typeof SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS)[number];

export const SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES = ["completed", "blocked", "failed"] as const;
export type SequentialContinuationStatusUpdateOutcome =
  (typeof SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES)[number];

export const SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS = [
  "decision_required",
  "authority_boundary_without_review",
  "scope_or_repo_evidence_missing",
  "dirty_or_stale_repo",
  "missing_harness_result",
  "scope_check_failed",
  "verification_rework_spent",
  "forbidden_capability_required",
  "ambiguous_evidence_update",
] as const;
export type SequentialContinuationStopConditionId = (typeof SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS)[number];

export interface SequentialContinuationCurrentSlice {
  id: string;
  status: SequentialContinuationSliceStatus;
  actionType: SequentialContinuationActionType;
  dependencyStatus: "met" | "blocked";
  prerequisites: string[];
  targetFiles?: string[];
  forbiddenChanges?: string[];
  verifyCommands?: string[];
}

export interface SequentialContinuationAutonomyEnvelope {
  canSelectNextReadySlice: true;
  canRunReadinessChecks: true;
  canRunReportOnlyActions: true;
  canRunExplicitTaskSpecs: true;
  canRunRoutineBatchActions: true;
  canUpdateContinuationStatus: true;
  canLocallyCommitThroughExistingGates: true;
  pushAllowed: false;
  maxFailedEvidenceReworkCycles: 1;
}

export interface SequentialContinuationStopConditionCheck {
  id: SequentialContinuationStopConditionId;
  active: boolean;
  evidence: string;
}

export interface SequentialContinuationEvidenceReference {
  path: string;
  summary: string;
  kind?: SequentialContinuationStatusEvidenceKind;
  result?: SequentialContinuationStatusEvidenceResult;
}

export interface SequentialContinuationNextStep {
  kind: "samantha_command" | "blocked_report";
  value: string;
}

export interface SequentialContinuationRunTaskCandidate {
  taskSpecPath: string;
  requiredRuntime: string;
  executionMode: string;
  worktreePolicy: string;
  lifecycleOwner: string;
  targetFiles: string[];
  forbiddenChanges: string[];
  verifyCommands: string[];
  evidence: {
    taskSpecCommit: string;
    taskSpecStatus: string;
    freshnessEvidencePath: string;
  };
  expectedSideEffects: {
    runTaskCalled: boolean;
    workersDispatched: boolean;
    worktreesCreated: boolean;
    lifecycleMutated: boolean;
    mergePerformed: boolean;
    cleanupPerformed: boolean;
    commitPerformed: boolean;
    pushPerformed: boolean;
  };
}

export interface SequentialContinuationArtifact {
  schemaVersion: 1;
  artifactId: string;
  initiativePath: string;
  createdAt: string;
  updatedAt: string;
  currentSlice: SequentialContinuationCurrentSlice;
  autonomyEnvelope: SequentialContinuationAutonomyEnvelope;
  stopConditionChecklist: SequentialContinuationStopConditionCheck[];
  evidenceReferences: SequentialContinuationEvidenceReference[];
  nextStep: SequentialContinuationNextStep;
  nextArtifactPath?: string | null;
  nextArtifactExpectedSliceId?: string | null;
  runTaskCandidate?: SequentialContinuationRunTaskCandidate | null;
}

export interface SequentialContinuationNextArtifactReport {
  previousArtifactPath: string;
  repoRoot: string;
  nextArtifactPath: string | null;
  nextArtifactExpectedSliceId: string | null;
  normalizedNextArtifactPath: string | null;
  resolvedNextArtifactPath: string | null;
  status: "absent" | "accepted" | "blocked";
  successor: {
    artifactPath: string;
    currentSliceId: string | null;
    initiativePath: string | null;
    actionType: string | null;
  } | null;
  inspectedArtifactPaths: string[];
  inspectedSliceIds: string[];
  blockingReasons: string[];
  trustedStateChanges: false;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationRunTaskPreflightReport {
  artifactPath: string;
  repoRoot: string;
  taskSpecPath: string | null;
  normalizedTaskSpecPath: string | null;
  resolvedTaskSpecPath: string | null;
  status: "absent" | "accepted" | "blocked";
  task: {
    id: string;
    title: string;
  } | null;
  requiredRuntime: string | null;
  executionMode: string | null;
  worktreePolicy: string | null;
  lifecycleOwner: string | null;
  targetFiles: string[];
  forbiddenChanges: string[];
  verifyCommands: string[];
  blockingReasons: string[];
  trustedStateChanges: false;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    lifecycleMutated: false;
    mergePerformed: false;
    cleanupPerformed: false;
    commitPerformed: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationReport {
  artifactPath: string;
  status: "accepted" | "rejected";
  violations: string[];
  currentSlice: {
    id: string | null;
    status: string | null;
    actionType: string | null;
    dependencyStatus: string | null;
  };
  activeStopConditions: Array<{
    id: string;
    evidence: string;
  }>;
  blockingReasons: string[];
  allowedActionType: SequentialContinuationActionType | null;
  exactNextSamanthaCommand: string | null;
  blockedReportText: string | null;
  nextArtifactLinkage?: SequentialContinuationNextArtifactReport;
  runTaskPreflight?: SequentialContinuationRunTaskPreflightReport;
  trustedStateChanges: false;
  pushPerformed: false;
}

export interface SequentialContinuationStatusEvidenceReference {
  kind: SequentialContinuationStatusEvidenceKind;
  path: string;
  summary: string;
  result: SequentialContinuationStatusEvidenceResult;
}

export interface SequentialContinuationStatusEvidenceDocument {
  schemaVersion: 1;
  currentSliceId: string;
  outcome: SequentialContinuationStatusUpdateOutcome;
  updatedAt: string;
  evidenceReferences: SequentialContinuationStatusEvidenceReference[];
  nextStep: SequentialContinuationNextStep;
}

export interface SequentialContinuationStatusUpdateReport {
  artifactPath: string;
  evidencePath: string;
  status: "accepted" | "rejected";
  violations: string[];
  requestedOutcome: string | null;
  acceptedOutcome: "completed" | "blocked" | null;
  currentSlice: {
    id: string | null;
    previousStatus: string | null;
    updatedStatus: string | null;
    actionType: string | null;
    dependencyStatus: string | null;
  };
  evidenceReferences: SequentialContinuationStatusEvidenceReference[];
  exactNextSamanthaCommand: string | null;
  blockedReportText: string | null;
  artifactUpdated: boolean;
  trustedStateChanges: boolean;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
  };
}

export interface SequentialContinuationStatusUpdateResult {
  report: SequentialContinuationStatusUpdateReport;
  updatedArtifact: SequentialContinuationArtifact | null;
}

export interface SequentialContinuationSingleStepExecutorInput {
  artifactPath: string;
  artifact: SequentialContinuationArtifact;
  actionType: "readiness_check";
}

export interface SequentialContinuationSingleStepExecution {
  evidence: SequentialContinuationStatusEvidenceDocument;
  evidencePath?: string;
  inlineEvidenceSummary?: string;
}

export type SequentialContinuationSingleStepActionExecutor = (
  input: SequentialContinuationSingleStepExecutorInput,
) => Promise<SequentialContinuationSingleStepExecution> | SequentialContinuationSingleStepExecution;

export interface SequentialContinuationSingleStepReport {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  selectedActionType: string | null;
  actionExecuted: boolean;
  actionAttemptCount: number;
  generatedEvidencePath: string | null;
  inlineEvidenceSummary: string | null;
  statusUpdateReport: SequentialContinuationStatusUpdateReport | null;
  nextStep: SequentialContinuationNextStep | null;
  continued: false;
  multiStepLoopStarted: false;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationSingleStepResult {
  report: SequentialContinuationSingleStepReport;
  updatedArtifact: SequentialContinuationArtifact | null;
}

export interface SequentialContinuationLoopNextArtifactInput {
  previousArtifactPath: string;
  previousArtifact: SequentialContinuationArtifact;
  updatedArtifact: SequentialContinuationArtifact;
  previousStepReport: SequentialContinuationSingleStepReport;
  stepCount: number;
  failedEvidenceReworkCyclesUsed: number;
}

export interface SequentialContinuationLoopNextArtifact {
  artifactPath: string;
  artifact: SequentialContinuationArtifact;
}

export type SequentialContinuationLoopNextArtifactSelector = (
  input: SequentialContinuationLoopNextArtifactInput,
) => Promise<SequentialContinuationLoopNextArtifact | null> | SequentialContinuationLoopNextArtifact | null;

export interface SequentialContinuationLoopReport {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  stepCount: number;
  maxSteps: number;
  stopReason: string;
  failedEvidenceReworkCyclesUsed: number;
  failedEvidenceReworkCyclesRemaining: number;
  singleStepReports: SequentialContinuationSingleStepReport[];
  nextStep: SequentialContinuationNextStep | null;
  continued: boolean;
  multiStepLoopStarted: boolean;
  pushPerformed: false;
  sideEffects: {
    runTaskCalled: false;
    batchesExecuteCalled: false;
    workersDispatched: false;
    runsCreated: false;
    worktreesCreated: false;
    pushPerformed: false;
  };
}

export interface SequentialContinuationLoopResult {
  report: SequentialContinuationLoopReport;
  updatedArtifacts: Array<{
    artifactPath: string;
    artifact: SequentialContinuationArtifact;
  }>;
}

const ACTION_TYPE_SET = new Set<SequentialContinuationActionType>(SEQUENTIAL_CONTINUATION_ACTION_TYPES);
const SLICE_STATUS_SET = new Set<SequentialContinuationSliceStatus>(SEQUENTIAL_CONTINUATION_SLICE_STATUSES);
const STOP_CONDITION_ID_SET = new Set<SequentialContinuationStopConditionId>(
  SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS,
);
const STATUS_EVIDENCE_KIND_SET = new Set<SequentialContinuationStatusEvidenceKind>(
  SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS,
);
const STATUS_EVIDENCE_RESULT_SET = new Set<SequentialContinuationStatusEvidenceResult>(
  SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS,
);
const STATUS_UPDATE_OUTCOME_SET = new Set<SequentialContinuationStatusUpdateOutcome>(
  SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES,
);
const WRITE_CAPABLE_ACTION_TYPES = new Set<SequentialContinuationActionType>(["run_task", "batch_plan"]);
const SINGLE_STEP_EXECUTABLE_ACTION_TYPE = "readiness_check";
const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "artifactId",
  "initiativePath",
  "createdAt",
  "updatedAt",
  "currentSlice",
  "autonomyEnvelope",
  "stopConditionChecklist",
  "evidenceReferences",
  "nextStep",
  "nextArtifactPath",
  "nextArtifactExpectedSliceId",
  "runTaskCandidate",
]);
const CURRENT_SLICE_FIELDS = new Set([
  "id",
  "status",
  "actionType",
  "dependencyStatus",
  "prerequisites",
  "targetFiles",
  "forbiddenChanges",
  "verifyCommands",
]);
const AUTONOMY_ENVELOPE_FIELDS = new Set([
  "canSelectNextReadySlice",
  "canRunReadinessChecks",
  "canRunReportOnlyActions",
  "canRunExplicitTaskSpecs",
  "canRunRoutineBatchActions",
  "canUpdateContinuationStatus",
  "canLocallyCommitThroughExistingGates",
  "pushAllowed",
  "maxFailedEvidenceReworkCycles",
]);
const STOP_CONDITION_FIELDS = new Set(["id", "active", "evidence"]);
const EVIDENCE_REFERENCE_FIELDS = new Set(["path", "summary", "kind", "result"]);
const NEXT_STEP_FIELDS = new Set(["kind", "value"]);
const RUN_TASK_CANDIDATE_FIELDS = new Set([
  "taskSpecPath",
  "requiredRuntime",
  "executionMode",
  "worktreePolicy",
  "lifecycleOwner",
  "targetFiles",
  "forbiddenChanges",
  "verifyCommands",
  "evidence",
  "expectedSideEffects",
]);
const RUN_TASK_CANDIDATE_EVIDENCE_FIELDS = new Set([
  "taskSpecCommit",
  "taskSpecStatus",
  "freshnessEvidencePath",
]);
const RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES = [
  "runTaskCalled",
  "workersDispatched",
  "worktreesCreated",
  "lifecycleMutated",
  "mergePerformed",
  "cleanupPerformed",
  "commitPerformed",
  "pushPerformed",
] as const;
const RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELDS = new Set<string>(
  RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES,
);
const TASK_SPEC_FIELDS = new Set([
  "id",
  "title",
  "targetAgent",
  "targetFiles",
  "forbiddenChanges",
  "setupCommands",
  "verifyCommands",
  "instructions",
  "resultMode",
  "expectedCommitSubject",
  "status",
]);
const STATUS_EVIDENCE_FIELDS = new Set([
  "schemaVersion",
  "currentSliceId",
  "outcome",
  "updatedAt",
  "evidenceReferences",
  "nextStep",
]);
const STATUS_EVIDENCE_REFERENCE_FIELDS = new Set(["kind", "path", "summary", "result"]);
const DEPENDENCY_STATUSES = new Set(["met", "blocked"]);
const NEXT_STEP_KINDS = new Set(["samantha_command", "blocked_report"]);
const NEXT_ARTIFACT_COMMAND_PREFIX_PATTERN = /^(?:sam\s+c:|sam\s+p:|sam\s+command:|bun\s+|npm\s+|pnpm\s+|yarn\s+|git\s+)/i;
const NEXT_ARTIFACT_URL_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const NEXT_ARTIFACT_GLOB_PATTERN = /[*?[\]{}]/;
const NEXT_ARTIFACT_ENV_PATTERN = /(?:\$[A-Za-z_{]|%[A-Za-z_][A-Za-z0-9_]*%)/;
const TASK_SPEC_STATUSES = new Set(["pending", "in_progress", "completed", "failed", "blocked"]);
const TASK_RESULT_MODES = new Set(["write", "report"]);
const FORBIDDEN_FIELD_NAMES = new Set([
  "hiddenmemory",
  "hiddenstate",
  "ceoofficememory",
  "memory",
  "secret",
  "secrets",
  "token",
  "apikey",
  "credential",
  "credentials",
  "daemon",
  "watch",
  "watcher",
  "remote",
  "remoteadapter",
  "dashboard",
  "routine",
  "routines",
  "routinetrigger",
]);
const FORBIDDEN_LIFECYCLE_WORDING_PATTERNS: RegExp[] = [
  /\baccept(?:s|ed|ing)?\s+(?:the\s+|this\s+|a\s+)?runs?\b/i,
  /\bmerge(?:s|d|ing)?\b/i,
  /\bclean\s+up\b/i,
  /\bcleanup\b/i,
  /\bcommit(?:s|ted|ting)?\b/i,
  /\bpush(?:es|ed|ing)?\b/i,
  /\bmutate(?:s|d|ing)?\s+lifecycle\b/i,
  /\blifecycle\s+(?:transition|transitions|mutation|mutations|state\s+change|state\s+changes|update|updates)\b/i,
  /\bcreate(?:s|d|ing)?\s+(?:a\s+|the\s+|follow-up\s+)?tasks?\b/i,
  /\bdispatch(?:es|ed|ing)?\s+(?:a\s+|the\s+)?workers?\b/i,
  /\bautomatic\s+continuation\b/i,
];

export function validateSequentialContinuationArtifact(input: unknown): string[] {
  if (!isRecord(input)) {
    return ["sequential continuation artifact must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateForbiddenFieldNames(input));
  violations.push(...validateForbiddenLifecycleWording(input));
  violations.push(
    ...validateAllowedFields(input, TOP_LEVEL_FIELDS, (key) => `unknown top-level field: ${key}`),
  );

  if (input.schemaVersion !== 1) {
    violations.push("schemaVersion must be exactly 1");
  }
  for (const field of ["artifactId", "initiativePath", "createdAt", "updatedAt"] as const) {
    if (!isNonEmptyString(input[field])) {
      violations.push(`${field} must be a non-empty string`);
    }
  }

  violations.push(...validateCurrentSlice(input.currentSlice));
  violations.push(...validateAutonomyEnvelope(input.autonomyEnvelope));
  violations.push(...validateStopConditionChecklist(input.stopConditionChecklist));
  violations.push(...validateEvidenceReferences(input.evidenceReferences));
  violations.push(...validateNextStep(input.nextStep));
  violations.push(...validateNextArtifactFields(input));
  violations.push(...validateRunTaskCandidateFields(input));

  return violations;
}

export function buildSequentialContinuationReport(input: {
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  nextArtifactLinkage?: SequentialContinuationNextArtifactReport;
  runTaskPreflight?: SequentialContinuationRunTaskPreflightReport;
}): SequentialContinuationReport {
  const violations = input.violations ?? validateSequentialContinuationArtifact(input.artifact);
  const currentSlice = readReportCurrentSlice(input.artifact);
  const activeStopConditions = readReportActiveStopConditions(input.artifact);
  const nextStep = readReportNextStep(input.artifact);
  const status = violations.length === 0 ? "accepted" : "rejected";
  const allowedActionType =
    status === "accepted" && currentSlice.actionType && ACTION_TYPE_SET.has(currentSlice.actionType as SequentialContinuationActionType)
      ? (currentSlice.actionType as SequentialContinuationActionType)
      : null;

  return {
    artifactPath: input.artifactPath,
    status,
    violations,
    currentSlice,
    activeStopConditions,
    blockingReasons: buildReportBlockingReasons({
      violations,
      currentSlice,
      activeStopConditions,
      nextStep,
      nextArtifactLinkage: input.nextArtifactLinkage,
      runTaskPreflight: input.runTaskPreflight,
    }),
    allowedActionType,
    exactNextSamanthaCommand: nextStep.kind === "samantha_command" ? nextStep.value : null,
    blockedReportText: nextStep.kind === "blocked_report" ? nextStep.value : null,
    ...(input.nextArtifactLinkage ? { nextArtifactLinkage: input.nextArtifactLinkage } : {}),
    ...(input.runTaskPreflight ? { runTaskPreflight: input.runTaskPreflight } : {}),
    trustedStateChanges: false,
    pushPerformed: false,
  };
}

export async function buildSequentialContinuationNextArtifactReport(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
  visitedArtifactPaths?: string[];
  visitedSliceIds?: string[];
}): Promise<SequentialContinuationNextArtifactReport> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const previousArtifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  const inspectedArtifactPaths = uniqueStrings([
    ...(input.visitedArtifactPaths ?? []).map((path) => normalizePathForReport(path, repoRoot)),
    previousArtifactPath,
  ]);
  const currentSliceId = readReportCurrentSlice(input.artifact).id;
  const inspectedSliceIds = uniqueStrings([
    ...(input.visitedSliceIds ?? []),
    ...(currentSliceId ? [currentSliceId] : []),
  ]);

  const currentArtifactViolations = validateSequentialContinuationArtifact(input.artifact);
  if (currentArtifactViolations.length > 0) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath: null,
      nextArtifactExpectedSliceId: null,
      normalizedNextArtifactPath: null,
      resolvedNextArtifactPath: null,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [
        "current artifact must validate before successor linkage is inspected",
        ...currentArtifactViolations,
      ],
    });
  }

  const nextArtifactPath = readOptionalStringField(input.artifact, "nextArtifactPath");
  const nextArtifactExpectedSliceId = readOptionalStringField(input.artifact, "nextArtifactExpectedSliceId");

  if (nextArtifactPath === null) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath: null,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath: null,
      resolvedNextArtifactPath: null,
      status: "absent",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [],
    });
  }

  const pathViolations: string[] = [];
  const normalizedNextArtifactPath = normalizeNextArtifactPath(nextArtifactPath, pathViolations);
  if (!normalizedNextArtifactPath || pathViolations.length > 0) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath: null,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: pathViolations,
    });
  }

  const resolvedNextArtifactPath = resolve(repoRoot, normalizedNextArtifactPath);
  const resolvedRepoRelativePath = relative(repoRoot, resolvedNextArtifactPath).replaceAll("\\", "/");
  if (
    resolvedRepoRelativePath === "" ||
    resolvedRepoRelativePath.startsWith("../") ||
    resolvedRepoRelativePath === ".." ||
    isAbsolute(resolvedRepoRelativePath)
  ) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [`nextArtifactPath must stay inside repoRoot: ${nextArtifactPath}`],
    });
  }
  if (inspectedArtifactPaths.includes(normalizedNextArtifactPath)) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: [`nextArtifactPath creates artifact path cycle: ${normalizedNextArtifactPath}`],
    });
  }

  const successorRead = await readNextArtifactFile(resolvedNextArtifactPath);
  if (successorRead.violations.length > 0) {
    return buildNextArtifactReport({
      previousArtifactPath,
      repoRoot,
      nextArtifactPath,
      nextArtifactExpectedSliceId,
      normalizedNextArtifactPath,
      resolvedNextArtifactPath,
      status: "blocked",
      successor: null,
      inspectedArtifactPaths,
      inspectedSliceIds,
      blockingReasons: successorRead.violations,
    });
  }

  const successor = successorRead.artifact;
  const successorSlice = readReportCurrentSlice(successor);
  const successorArtifactPath = normalizePathForReport(resolvedNextArtifactPath, repoRoot);
  const nextInspectedArtifactPaths = uniqueStrings([...inspectedArtifactPaths, successorArtifactPath]);
  const nextInspectedSliceIds = uniqueStrings([
    ...inspectedSliceIds,
    ...(successorSlice.id ? [successorSlice.id] : []),
  ]);
  const blockingReasons: string[] = [];

  for (const violation of validateSequentialContinuationArtifact(successor)) {
    blockingReasons.push(`successor artifact invalid: ${violation}`);
  }
  if (isRecord(input.artifact) && isRecord(successor) && successor.initiativePath !== input.artifact.initiativePath) {
    blockingReasons.push(
      `successor initiativePath must match predecessor initiativePath: ${String(successor.initiativePath)}`,
    );
  }
  if (nextArtifactExpectedSliceId && successorSlice.id !== nextArtifactExpectedSliceId) {
    blockingReasons.push(
      `successor currentSlice.id must match nextArtifactExpectedSliceId ${nextArtifactExpectedSliceId}: ${String(successorSlice.id)}`,
    );
  }
  if (successorSlice.id && inspectedSliceIds.includes(successorSlice.id)) {
    blockingReasons.push(`successor currentSlice.id creates slice cycle: ${successorSlice.id}`);
  }
  for (const stopCondition of readReportActiveStopConditions(successor)) {
    blockingReasons.push(`successor stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`);
  }
  if (isRecord(successor) && isRecord(successor.autonomyEnvelope) && successor.autonomyEnvelope.pushAllowed === true) {
    blockingReasons.push("successor autonomyEnvelope.pushAllowed must be false");
  }
  blockingReasons.push(
    ...(await validateSuccessorEvidenceFreshness({
      repoRoot,
      predecessorArtifactPath: input.artifactPath,
      predecessorArtifact: input.artifact,
      successorArtifact: successor,
    })),
  );

  return buildNextArtifactReport({
    previousArtifactPath,
    repoRoot,
    nextArtifactPath,
    nextArtifactExpectedSliceId,
    normalizedNextArtifactPath,
    resolvedNextArtifactPath,
    status: blockingReasons.length === 0 ? "accepted" : "blocked",
    successor: {
      artifactPath: successorArtifactPath,
      currentSliceId: successorSlice.id,
      initiativePath: isRecord(successor) ? stringOrNull(successor.initiativePath) : null,
      actionType: successorSlice.actionType,
    },
    inspectedArtifactPaths: nextInspectedArtifactPaths,
    inspectedSliceIds: nextInspectedSliceIds,
    blockingReasons,
  });
}

export async function buildSequentialContinuationRunTaskPreflightReport(input: {
  repoRoot?: string;
  artifactPath: string;
  artifact: unknown;
}): Promise<SequentialContinuationRunTaskPreflightReport> {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const artifactPath = normalizePathForReport(input.artifactPath, repoRoot);
  if (!isRecord(input.artifact) || !hasOwn(input.artifact, "runTaskCandidate") || input.artifact.runTaskCandidate === null) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "absent",
      blockingReasons: [],
    });
  }

  const currentArtifactViolations = validateSequentialContinuationArtifact(input.artifact);
  if (currentArtifactViolations.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      blockingReasons: [
        "current artifact must validate before runTaskCandidate is inspected",
        ...currentArtifactViolations,
      ],
    });
  }

  const artifact = input.artifact as unknown as SequentialContinuationArtifact;
  const candidate = artifact.runTaskCandidate as SequentialContinuationRunTaskCandidate;

  const activeStopConditions = artifact.stopConditionChecklist.flatMap((stopCondition) => {
    return stopCondition.active ? [`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`] : [];
  });
  if (activeStopConditions.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: activeStopConditions,
    });
  }

  const gateReasons: string[] = [];
  if (artifact.currentSlice.status !== "ready") {
    gateReasons.push(`currentSlice.status must be ready for run_task preflight: ${artifact.currentSlice.status}`);
  }
  if (artifact.currentSlice.actionType !== "run_task") {
    gateReasons.push(`currentSlice.actionType must be run_task for run_task preflight: ${artifact.currentSlice.actionType}`);
  }
  if (artifact.currentSlice.dependencyStatus !== "met") {
    gateReasons.push(`currentSlice.dependencyStatus must be met for run_task preflight: ${artifact.currentSlice.dependencyStatus}`);
  }
  if (gateReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: gateReasons,
    });
  }

  const candidateReasons = validateRunTaskCandidatePreflightRequirements(candidate);
  if (candidateReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: candidateReasons,
    });
  }

  const pathReasons: string[] = [];
  const normalizedTaskSpecPath = normalizeRunTaskTaskSpecPath(candidate.taskSpecPath, pathReasons);
  if (!normalizedTaskSpecPath || pathReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: pathReasons,
    });
  }

  const resolvedTaskSpecPath = resolve(repoRoot, normalizedTaskSpecPath);
  const resolvedRepoRelativePath = relative(repoRoot, resolvedTaskSpecPath).replaceAll("\\", "/");
  if (
    resolvedRepoRelativePath === "" ||
    resolvedRepoRelativePath.startsWith("../") ||
    resolvedRepoRelativePath === ".." ||
    isAbsolute(resolvedRepoRelativePath)
  ) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: [`runTaskCandidate.taskSpecPath must stay inside repoRoot: ${candidate.taskSpecPath}`],
    });
  }

  const taskSpecRead = await readRunTaskTaskSpecFile({
    repoRoot,
    normalizedTaskSpecPath,
    resolvedTaskSpecPath,
  });
  if (taskSpecRead.violations.length > 0 || !taskSpecRead.taskSpec) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: taskSpecRead.violations,
    });
  }

  const taskSpecValue = taskSpecRead.taskSpec;
  const taskSpecReasons = validateRunTaskTaskSpec(taskSpecValue);
  if (taskSpecReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      task: taskSpecTitleForReport(taskSpecValue),
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: taskSpecReasons,
    });
  }

  const taskSpec = taskSpecValue as TaskSpec;
  const gitReasons = await validateCommittedCleanTaskSpec({
    repoRoot,
    normalizedTaskSpecPath,
    taskSpecCommit: candidate.evidence.taskSpecCommit,
  });
  if (gitReasons.length > 0) {
    return buildRunTaskPreflightReport({
      artifactPath,
      repoRoot,
      status: "blocked",
      taskSpecPath: candidate.taskSpecPath,
      normalizedTaskSpecPath,
      resolvedTaskSpecPath,
      task: taskSpecTitleForReport(taskSpec),
      requiredRuntime: candidate.requiredRuntime,
      executionMode: candidate.executionMode,
      worktreePolicy: candidate.worktreePolicy,
      lifecycleOwner: candidate.lifecycleOwner,
      targetFiles: candidate.targetFiles,
      forbiddenChanges: candidate.forbiddenChanges,
      verifyCommands: candidate.verifyCommands,
      blockingReasons: gitReasons,
    });
  }

  const handoffReasons = validateRunTaskHandoff({
    candidate,
    taskSpec,
    currentSlice: artifact.currentSlice,
  });
  return buildRunTaskPreflightReport({
    artifactPath,
    repoRoot,
    status: handoffReasons.length === 0 ? "accepted" : "blocked",
    taskSpecPath: candidate.taskSpecPath,
    normalizedTaskSpecPath,
    resolvedTaskSpecPath,
    task: taskSpecTitleForReport(taskSpec),
    requiredRuntime: candidate.requiredRuntime,
    executionMode: candidate.executionMode,
    worktreePolicy: candidate.worktreePolicy,
    lifecycleOwner: candidate.lifecycleOwner,
    targetFiles: candidate.targetFiles,
    forbiddenChanges: candidate.forbiddenChanges,
    verifyCommands: candidate.verifyCommands,
    blockingReasons: handoffReasons,
  });
}

export function validateSequentialContinuationStatusEvidence(input: unknown): string[] {
  if (!isRecord(input)) {
    return ["sequential continuation status evidence must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateForbiddenFieldNames(input));
  violations.push(...validateForbiddenLifecycleWording(input));
  violations.push(
    ...validateAllowedFields(input, STATUS_EVIDENCE_FIELDS, (key) => `unknown status evidence field: ${key}`),
  );

  if (input.schemaVersion !== 1) {
    violations.push("status evidence schemaVersion must be exactly 1");
  }
  if (!isNonEmptyString(input.currentSliceId)) {
    violations.push("status evidence currentSliceId must be a non-empty string");
  }
  if (!STATUS_UPDATE_OUTCOME_SET.has(input.outcome as SequentialContinuationStatusUpdateOutcome)) {
    violations.push(
      `status evidence outcome must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_UPDATE_OUTCOMES)}: ${String(input.outcome)}`,
    );
  }
  if (!isNonEmptyString(input.updatedAt)) {
    violations.push("status evidence updatedAt must be a non-empty string");
  }
  violations.push(...validateStatusEvidenceReferences(input.evidenceReferences));
  violations.push(...validateNextStep(input.nextStep));

  if (
    (input.outcome === "blocked" || input.outcome === "failed") &&
    (!isRecord(input.nextStep) || input.nextStep.kind !== "blocked_report")
  ) {
    violations.push("blocked or failed status updates require nextStep.kind to be blocked_report");
  }
  if (input.outcome === "completed" && (!isRecord(input.nextStep) || input.nextStep.kind !== "samantha_command")) {
    violations.push("completed status updates require nextStep.kind to be samantha_command");
  }

  return violations;
}

export function buildSequentialContinuationStatusUpdate(input: {
  artifactPath: string;
  evidencePath: string;
  artifact: unknown;
  evidence: unknown;
  violations?: string[];
}): SequentialContinuationStatusUpdateResult {
  const readViolations = input.violations ?? [];
  const artifactViolations = validateSequentialContinuationArtifact(input.artifact);
  const evidenceViolations = validateSequentialContinuationStatusEvidence(input.evidence);
  const currentSlice = readStatusUpdateCurrentSlice(input.artifact);
  const requestedOutcome = readStatusUpdateOutcome(input.evidence);
  const evidenceReferences = readStatusEvidenceReferences(input.evidence);
  const nextStep = readReportNextStep(input.evidence);
  const violations = [...readViolations, ...artifactViolations, ...evidenceViolations];

  if (
    isRecord(input.artifact) &&
    isRecord(input.artifact.currentSlice) &&
    isRecord(input.evidence) &&
    isNonEmptyString(input.evidence.currentSliceId) &&
    input.artifact.currentSlice.id !== input.evidence.currentSliceId
  ) {
    violations.push(
      `status evidence currentSliceId must match artifact currentSlice.id: ${String(input.artifact.currentSlice.id)}`,
    );
  }

  const actionType = currentSlice.actionType;
  if (
    requestedOutcome === "completed" &&
    actionType &&
    ACTION_TYPE_SET.has(actionType as SequentialContinuationActionType)
  ) {
    if (evidenceReferences.some((reference) => reference.result === "recommendation_only")) {
      violations.push("report-only recommendation-only evidence cannot complete a slice");
    }
    if (!hasTrustedCompletionEvidence(actionType as SequentialContinuationActionType, evidenceReferences)) {
      violations.push(`completed update requires trusted structured evidence for ${actionType}`);
    }
  }

  if (violations.length > 0 || !isSequentialContinuationArtifact(input.artifact) || !isStatusEvidenceDocument(input.evidence)) {
    return {
      report: buildStatusUpdateReport({
        artifactPath: input.artifactPath,
        evidencePath: input.evidencePath,
        status: "rejected",
        violations,
        currentSlice,
        requestedOutcome,
        acceptedOutcome: null,
        evidenceReferences,
        nextStep,
        artifactUpdated: false,
      }),
      updatedArtifact: null,
    };
  }

  const acceptedOutcome: "completed" | "blocked" = input.evidence.outcome === "completed" ? "completed" : "blocked";
  const updatedArtifact: SequentialContinuationArtifact = {
    ...input.artifact,
    updatedAt: input.evidence.updatedAt,
    currentSlice: {
      ...input.artifact.currentSlice,
      status: acceptedOutcome,
      dependencyStatus: acceptedOutcome === "completed" ? "met" : "blocked",
    },
    evidenceReferences: input.evidence.evidenceReferences.map((reference) => ({
      kind: reference.kind,
      path: reference.path,
      summary: reference.summary,
      result: reference.result,
    })),
    nextStep: {
      kind: input.evidence.nextStep.kind,
      value: input.evidence.nextStep.value,
    },
  };
  const updatedViolations = validateSequentialContinuationArtifact(updatedArtifact);
  if (updatedViolations.length > 0) {
    return {
      report: buildStatusUpdateReport({
        artifactPath: input.artifactPath,
        evidencePath: input.evidencePath,
        status: "rejected",
        violations: updatedViolations,
        currentSlice,
        requestedOutcome,
        acceptedOutcome: null,
        evidenceReferences,
        nextStep,
        artifactUpdated: false,
      }),
      updatedArtifact: null,
    };
  }

  return {
    report: buildStatusUpdateReport({
      artifactPath: input.artifactPath,
      evidencePath: input.evidencePath,
      status: "accepted",
      violations: [],
      currentSlice: {
        ...currentSlice,
        updatedStatus: updatedArtifact.currentSlice.status,
        dependencyStatus: updatedArtifact.currentSlice.dependencyStatus,
      },
      requestedOutcome,
      acceptedOutcome,
      evidenceReferences,
      nextStep,
      artifactUpdated: true,
    }),
    updatedArtifact,
  };
}

export async function buildSequentialContinuationSingleStep(input: {
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  executeAction: SequentialContinuationSingleStepActionExecutor;
}): Promise<SequentialContinuationSingleStepResult> {
  const artifactViolations = [
    ...(input.violations ?? []),
    ...validateSequentialContinuationArtifact(input.artifact),
  ];
  const artifactReport = buildSequentialContinuationReport({
    artifactPath: input.artifactPath,
    artifact: input.artifact,
    violations: artifactViolations,
  });
  const selectedActionType = artifactReport.currentSlice.actionType;
  const nextStep = nextStepFromContinuationReport(artifactReport);

  if (artifactReport.status === "rejected" || !isSequentialContinuationArtifact(input.artifact)) {
    return buildSingleStepResult({
      artifactPath: input.artifactPath,
      status: "rejected",
      violations: artifactReport.violations,
      selectedActionType,
      nextStep,
      actionExecuted: false,
      actionAttemptCount: 0,
      generatedEvidencePath: null,
      inlineEvidenceSummary: null,
      statusUpdateReport: null,
      updatedArtifact: null,
    });
  }

  const guardViolations = singleStepGuardViolations(input.artifact);
  if (guardViolations.length > 0) {
    return buildSingleStepResult({
      artifactPath: input.artifactPath,
      status: "blocked",
      violations: guardViolations,
      selectedActionType,
      nextStep,
      actionExecuted: false,
      actionAttemptCount: 0,
      generatedEvidencePath: null,
      inlineEvidenceSummary: null,
      statusUpdateReport: null,
      updatedArtifact: null,
    });
  }

  let execution: SequentialContinuationSingleStepExecution;
  try {
    execution = await input.executeAction({
      artifactPath: input.artifactPath,
      artifact: input.artifact,
      actionType: SINGLE_STEP_EXECUTABLE_ACTION_TYPE,
    });
  } catch (err) {
    return buildSingleStepResult({
      artifactPath: input.artifactPath,
      status: "blocked",
      violations: [`single-step action executor failed: ${err instanceof Error ? err.message : String(err)}`],
      selectedActionType,
      nextStep,
      actionExecuted: false,
      actionAttemptCount: 1,
      generatedEvidencePath: null,
      inlineEvidenceSummary: null,
      statusUpdateReport: null,
      updatedArtifact: null,
    });
  }

  const evidencePath =
    execution.evidencePath ??
    `inline:sequential-continuation:${input.artifact.artifactId}:${input.artifact.currentSlice.id}:${input.artifact.currentSlice.actionType}`;
  const statusUpdate = buildSequentialContinuationStatusUpdate({
    artifactPath: input.artifactPath,
    evidencePath,
    artifact: input.artifact,
    evidence: execution.evidence,
  });

  return buildSingleStepResult({
    artifactPath: input.artifactPath,
    status: statusUpdate.report.status === "accepted" ? "accepted" : "rejected",
    violations: statusUpdate.report.violations,
    selectedActionType,
    nextStep: nextStepFromStatusUpdateReport(statusUpdate.report),
    actionExecuted: true,
    actionAttemptCount: 1,
    generatedEvidencePath: execution.evidencePath ?? null,
    inlineEvidenceSummary: execution.inlineEvidenceSummary ?? null,
    statusUpdateReport: statusUpdate.report,
    updatedArtifact: statusUpdate.updatedArtifact,
  });
}

export async function buildSequentialContinuationLoop(input: {
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
  maxSteps: number;
  executeAction: SequentialContinuationSingleStepActionExecutor;
  selectNextArtifact?: SequentialContinuationLoopNextArtifactSelector;
}): Promise<SequentialContinuationLoopResult> {
  const maxFailedEvidenceReworkCycles = 1;
  if (!Number.isInteger(input.maxSteps) || input.maxSteps < 1) {
    return buildLoopResult({
      artifactPath: input.artifactPath,
      status: "rejected",
      violations: ["maxSteps must be a positive integer"],
      stepCount: 0,
      maxSteps: input.maxSteps,
      stopReason: "invalid_max_steps",
      failedEvidenceReworkCyclesUsed: 0,
      maxFailedEvidenceReworkCycles,
      singleStepReports: [],
      nextStep: null,
      updatedArtifacts: [],
    });
  }

  let currentArtifactPath = input.artifactPath;
  let currentArtifact: unknown = input.artifact;
  let currentViolations = input.violations ?? [];
  let failedEvidenceReworkCyclesUsed = 0;
  const singleStepReports: SequentialContinuationSingleStepReport[] = [];
  const updatedArtifacts: SequentialContinuationLoopResult["updatedArtifacts"] = [];

  for (let index = 0; index < input.maxSteps; index += 1) {
    const step = await buildSequentialContinuationSingleStep({
      artifactPath: currentArtifactPath,
      artifact: currentArtifact,
      violations: currentViolations,
      executeAction: input.executeAction,
    });
    singleStepReports.push(step.report);
    currentViolations = [];

    if (step.updatedArtifact) {
      updatedArtifacts.push({
        artifactPath: currentArtifactPath,
        artifact: step.updatedArtifact,
      });
    }

    if (step.report.status === "rejected") {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "rejected",
        violations: step.report.violations,
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: step.report.actionExecuted ? "status_evidence_rejected" : "artifact_invalid",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    if (step.report.status === "blocked") {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "blocked",
        violations: step.report.violations,
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: step.report.violations[0] ? `step_blocked: ${step.report.violations[0]}` : "step_blocked",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    const updatedArtifact = step.updatedArtifact;
    if (!updatedArtifact) {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "rejected",
        violations: ["accepted single-step continuation did not produce an updated artifact"],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "status_evidence_rejected",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    const requestedOutcome = step.report.statusUpdateReport?.requestedOutcome;
    const failedEvidence = requestedOutcome === "failed";
    if (requestedOutcome === "blocked") {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: "blocked",
        violations: ["status_evidence_blocked: accepted evidence blocked the current slice"],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "status_evidence_blocked: accepted evidence blocked the current slice",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    if (failedEvidence) {
      if (failedEvidenceReworkCyclesUsed >= maxFailedEvidenceReworkCycles) {
        return buildLoopResult({
          artifactPath: input.artifactPath,
          status: "blocked",
          violations: ["verification_rework_spent: failed evidence rework budget is already spent"],
          stepCount: singleStepReports.length,
          maxSteps: input.maxSteps,
          stopReason: "verification_rework_spent: failed evidence rework budget is already spent",
          failedEvidenceReworkCyclesUsed,
          maxFailedEvidenceReworkCycles,
          singleStepReports,
          nextStep: {
            kind: "blocked_report",
            value: "Blocked: verification_rework_spent; failed evidence rework budget is already spent.",
          },
          updatedArtifacts,
        });
      }
      failedEvidenceReworkCyclesUsed += 1;
    }

    if (singleStepReports.length >= input.maxSteps) {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: failedEvidence ? "blocked" : "accepted",
        violations: [],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "max_steps_reached",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    const nextArtifact = input.selectNextArtifact
      ? await input.selectNextArtifact({
          previousArtifactPath: currentArtifactPath,
          previousArtifact: isSequentialContinuationArtifact(currentArtifact) ? currentArtifact : updatedArtifact,
          updatedArtifact,
          previousStepReport: step.report,
          stepCount: singleStepReports.length,
          failedEvidenceReworkCyclesUsed,
        })
      : null;

    if (!nextArtifact) {
      return buildLoopResult({
        artifactPath: input.artifactPath,
        status: failedEvidence ? "blocked" : "accepted",
        violations: [],
        stepCount: singleStepReports.length,
        maxSteps: input.maxSteps,
        stopReason: "no_deterministic_next_artifact",
        failedEvidenceReworkCyclesUsed,
        maxFailedEvidenceReworkCycles,
        singleStepReports,
        nextStep: step.report.nextStep,
        updatedArtifacts,
      });
    }

    currentArtifactPath = nextArtifact.artifactPath;
    currentArtifact = nextArtifact.artifact;
  }

  return buildLoopResult({
    artifactPath: input.artifactPath,
    status: "accepted",
    violations: [],
    stepCount: singleStepReports.length,
    maxSteps: input.maxSteps,
    stopReason: "max_steps_reached",
    failedEvidenceReworkCyclesUsed,
    maxFailedEvidenceReworkCycles,
    singleStepReports,
    nextStep: singleStepReports[singleStepReports.length - 1]?.nextStep ?? null,
    updatedArtifacts,
  });
}

function validateCurrentSlice(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["currentSlice must be an object"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(value, CURRENT_SLICE_FIELDS, (key) => `unknown currentSlice field: ${key}`),
  );

  if (!isNonEmptyString(value.id)) {
    violations.push("currentSlice.id must be a non-empty string");
  }
  if (!SLICE_STATUS_SET.has(value.status as SequentialContinuationSliceStatus)) {
    violations.push(
      `currentSlice.status must be ${joinOptions(SEQUENTIAL_CONTINUATION_SLICE_STATUSES)}: ${String(value.status)}`,
    );
  }
  if (!ACTION_TYPE_SET.has(value.actionType as SequentialContinuationActionType)) {
    violations.push(
      `currentSlice.actionType must be ${joinOptions(SEQUENTIAL_CONTINUATION_ACTION_TYPES)}: ${String(value.actionType)}`,
    );
  }
  if (!DEPENDENCY_STATUSES.has(value.dependencyStatus as string)) {
    violations.push(`currentSlice.dependencyStatus must be met or blocked: ${String(value.dependencyStatus)}`);
  }
  if (!hasOnlyNonEmptyStrings(value.prerequisites, { allowEmpty: true })) {
    violations.push("currentSlice.prerequisites must be a string array");
  }

  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (hasOwn(value, field) && !hasOnlyNonEmptyStrings(value[field], { allowEmpty: false })) {
      violations.push(`currentSlice.${field} must be a non-empty string array when present`);
    }
  }

  if (
    ACTION_TYPE_SET.has(value.actionType as SequentialContinuationActionType) &&
    WRITE_CAPABLE_ACTION_TYPES.has(value.actionType as SequentialContinuationActionType)
  ) {
    for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
      if (!hasOnlyNonEmptyStrings(value[field], { allowEmpty: false })) {
        violations.push(`currentSlice.${field} must be a non-empty string array for ${value.actionType}`);
      }
    }
  }

  return violations;
}

function validateAutonomyEnvelope(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["autonomyEnvelope must be an object"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(value, AUTONOMY_ENVELOPE_FIELDS, (key) => `unknown autonomyEnvelope field: ${key}`),
  );

  for (const field of [
    "canSelectNextReadySlice",
    "canRunReadinessChecks",
    "canRunReportOnlyActions",
    "canRunExplicitTaskSpecs",
    "canRunRoutineBatchActions",
    "canUpdateContinuationStatus",
    "canLocallyCommitThroughExistingGates",
  ] as const) {
    if (value[field] !== true) {
      violations.push(`autonomyEnvelope.${field} must be true`);
    }
  }
  if (value.pushAllowed !== false) {
    violations.push("autonomyEnvelope.pushAllowed must be false");
  }
  if (value.maxFailedEvidenceReworkCycles !== 1) {
    violations.push("autonomyEnvelope.maxFailedEvidenceReworkCycles must be 1");
  }

  return violations;
}

function validateStopConditionChecklist(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ["stopConditionChecklist must be a non-empty array"];
  }

  const violations: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`stopConditionChecklist[${index}] must be an object`);
      return;
    }
    violations.push(
      ...validateAllowedFields(item, STOP_CONDITION_FIELDS, (key) => {
        return `unknown stopConditionChecklist[${index}] field: ${key}`;
      }),
    );
    const id = item.id;
    if (!isStopConditionId(id)) {
      violations.push(`stopConditionChecklist[${index}].id must be a known stop condition id: ${String(id)}`);
    } else if (seen.has(id)) {
      violations.push(`stopConditionChecklist[].id must be unique: ${id}`);
    } else {
      seen.add(id);
    }
    if (typeof item.active !== "boolean") {
      violations.push(`stopConditionChecklist[${index}].active must be a boolean`);
    }
    if (!isNonEmptyString(item.evidence)) {
      violations.push(`stopConditionChecklist[${index}].evidence must be a non-empty string`);
    }
  });

  for (const id of SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS) {
    if (!seen.has(id)) {
      violations.push(`stopConditionChecklist must include ${id}`);
    }
  }

  return violations;
}

function validateEvidenceReferences(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["evidenceReferences must be an array"];
  }

  const violations: string[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`evidenceReferences[${index}] must be an object`);
      return;
    }
    violations.push(
      ...validateAllowedFields(item, EVIDENCE_REFERENCE_FIELDS, (key) => `unknown evidenceReferences[${index}] field: ${key}`),
    );
    if (!isNonEmptyString(item.path)) {
      violations.push(`evidenceReferences[${index}].path must be a non-empty string`);
    }
    if (!isNonEmptyString(item.summary)) {
      violations.push(`evidenceReferences[${index}].summary must be a non-empty string`);
    }
    if (hasOwn(item, "kind") && !STATUS_EVIDENCE_KIND_SET.has(item.kind as SequentialContinuationStatusEvidenceKind)) {
      violations.push(
        `evidenceReferences[${index}].kind must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS)}: ${String(item.kind)}`,
      );
    }
    if (
      hasOwn(item, "result") &&
      !STATUS_EVIDENCE_RESULT_SET.has(item.result as SequentialContinuationStatusEvidenceResult)
    ) {
      violations.push(
        `evidenceReferences[${index}].result must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS)}: ${String(item.result)}`,
      );
    }
  });

  return violations;
}

function validateStatusEvidenceReferences(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ["status evidence evidenceReferences must be a non-empty array"];
  }

  const violations: string[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`status evidence evidenceReferences[${index}] must be an object`);
      return;
    }
    violations.push(
      ...validateAllowedFields(
        item,
        STATUS_EVIDENCE_REFERENCE_FIELDS,
        (key) => `unknown status evidence evidenceReferences[${index}] field: ${key}`,
      ),
    );
    if (!STATUS_EVIDENCE_KIND_SET.has(item.kind as SequentialContinuationStatusEvidenceKind)) {
      violations.push(
        `status evidence evidenceReferences[${index}].kind must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_KINDS)}: ${String(item.kind)}`,
      );
    }
    if (!isNonEmptyString(item.path)) {
      violations.push(`status evidence evidenceReferences[${index}].path must be a non-empty string`);
    }
    if (!isNonEmptyString(item.summary)) {
      violations.push(`status evidence evidenceReferences[${index}].summary must be a non-empty string`);
    }
    if (!STATUS_EVIDENCE_RESULT_SET.has(item.result as SequentialContinuationStatusEvidenceResult)) {
      violations.push(
        `status evidence evidenceReferences[${index}].result must be ${joinOptions(SEQUENTIAL_CONTINUATION_STATUS_EVIDENCE_RESULTS)}: ${String(item.result)}`,
      );
    }
  });

  return violations;
}

function validateNextStep(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["nextStep must be an object"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(value, NEXT_STEP_FIELDS, (key) => `unknown nextStep field: ${key}`),
  );
  if (!NEXT_STEP_KINDS.has(value.kind as string)) {
    violations.push(`nextStep.kind must be samantha_command or blocked_report: ${String(value.kind)}`);
  }
  if (!isNonEmptyString(value.value)) {
    violations.push("nextStep.value must be a non-empty string");
  }

  return violations;
}

function validateNextArtifactFields(value: Record<string, unknown>): string[] {
  const violations: string[] = [];
  if (hasOwn(value, "nextArtifactPath") && value.nextArtifactPath !== null) {
    normalizeNextArtifactPath(value.nextArtifactPath, violations);
  }
  if (
    hasOwn(value, "nextArtifactExpectedSliceId") &&
    value.nextArtifactExpectedSliceId !== null &&
    !isNonEmptyString(value.nextArtifactExpectedSliceId)
  ) {
    violations.push("nextArtifactExpectedSliceId must be a non-empty string or null when present");
  }
  return violations;
}

function validateRunTaskCandidateFields(value: Record<string, unknown>): string[] {
  if (!hasOwn(value, "runTaskCandidate") || value.runTaskCandidate === null) {
    return [];
  }
  if (!isRecord(value.runTaskCandidate)) {
    return ["runTaskCandidate must be an object or null when present"];
  }

  const candidate = value.runTaskCandidate;
  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(candidate, RUN_TASK_CANDIDATE_FIELDS, (key) => `unknown runTaskCandidate field: ${key}`),
  );

  for (const field of ["taskSpecPath", "requiredRuntime", "executionMode", "worktreePolicy", "lifecycleOwner"] as const) {
    if (!isNonEmptyString(candidate[field])) {
      violations.push(`runTaskCandidate.${field} must be a non-empty string`);
    }
  }
  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (!hasOnlyNonEmptyStrings(candidate[field], { allowEmpty: false })) {
      violations.push(`runTaskCandidate.${field} must be a non-empty string array`);
    }
  }

  if (!isRecord(candidate.evidence)) {
    violations.push("runTaskCandidate.evidence must be an object");
  } else {
    violations.push(
      ...validateAllowedFields(
        candidate.evidence,
        RUN_TASK_CANDIDATE_EVIDENCE_FIELDS,
        (key) => `unknown runTaskCandidate.evidence field: ${key}`,
      ),
    );
    for (const field of ["taskSpecCommit", "taskSpecStatus", "freshnessEvidencePath"] as const) {
      if (!isNonEmptyString(candidate.evidence[field])) {
        violations.push(`runTaskCandidate.evidence.${field} must be a non-empty string`);
      }
    }
  }

  if (!isRecord(candidate.expectedSideEffects)) {
    violations.push("runTaskCandidate.expectedSideEffects must be an object");
  } else {
    violations.push(
      ...validateAllowedFields(
        candidate.expectedSideEffects,
        RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELDS,
        (key) => `unknown runTaskCandidate.expectedSideEffects field: ${key}`,
      ),
    );
    for (const field of RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
      if (typeof candidate.expectedSideEffects[field] !== "boolean") {
        violations.push(`runTaskCandidate.expectedSideEffects.${field} must be a boolean`);
      }
    }
  }

  return violations;
}

function normalizeNextArtifactPath(value: unknown, violations: string[]): string | null {
  if (!isNonEmptyString(value)) {
    violations.push("nextArtifactPath must be a non-empty repo-relative .json path or null");
    return null;
  }

  const beforeCount = violations.length;
  const trimmed = value.trim();
  const candidate = trimmed.replaceAll("\\", "/");
  const rawSegments = candidate.split("/");
  if (trimmed !== value || candidate !== trimmed || candidate.includes(":") || /\s/.test(candidate)) {
    violations.push(`nextArtifactPath must be a normalized repo-relative local .json path: ${value}`);
  }
  if (NEXT_ARTIFACT_COMMAND_PREFIX_PATTERN.test(trimmed)) {
    violations.push(`nextArtifactPath must not be a command string: ${value}`);
  }
  if (NEXT_ARTIFACT_URL_PATTERN.test(candidate) || /^file:/i.test(candidate)) {
    violations.push(`nextArtifactPath must not be a URL: ${value}`);
  }
  if (candidate.startsWith("~") || NEXT_ARTIFACT_ENV_PATTERN.test(candidate)) {
    violations.push(`nextArtifactPath must not use environment expansion: ${value}`);
  }
  if (NEXT_ARTIFACT_GLOB_PATTERN.test(candidate)) {
    violations.push(`nextArtifactPath must not be glob-like: ${value}`);
  }
  if (isAbsolute(value) || candidate.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || rawSegments.includes("..")) {
    violations.push(`nextArtifactPath must be repo-relative and stay inside repoRoot: ${value}`);
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === ".." || normalized !== candidate) {
    violations.push(`nextArtifactPath must be normalized and stay inside repoRoot: ${value}`);
  }
  if (!normalized.endsWith(".json")) {
    violations.push(`nextArtifactPath must end with .json: ${value}`);
  }

  return violations.length === beforeCount ? normalized : null;
}

function buildNextArtifactReport(input: {
  previousArtifactPath: string;
  repoRoot: string;
  nextArtifactPath: string | null;
  nextArtifactExpectedSliceId: string | null;
  normalizedNextArtifactPath: string | null;
  resolvedNextArtifactPath: string | null;
  status: SequentialContinuationNextArtifactReport["status"];
  successor: SequentialContinuationNextArtifactReport["successor"];
  inspectedArtifactPaths: string[];
  inspectedSliceIds: string[];
  blockingReasons: string[];
}): SequentialContinuationNextArtifactReport {
  return {
    previousArtifactPath: input.previousArtifactPath,
    repoRoot: input.repoRoot,
    nextArtifactPath: input.nextArtifactPath,
    nextArtifactExpectedSliceId: input.nextArtifactExpectedSliceId,
    normalizedNextArtifactPath: input.normalizedNextArtifactPath,
    resolvedNextArtifactPath: input.resolvedNextArtifactPath,
    status: input.status,
    successor: input.successor,
    inspectedArtifactPaths: input.inspectedArtifactPaths,
    inspectedSliceIds: input.inspectedSliceIds,
    blockingReasons: input.blockingReasons,
    trustedStateChanges: false,
    pushPerformed: false,
    sideEffects: singleStepSideEffects(),
  };
}

async function readNextArtifactFile(path: string): Promise<{ artifact: unknown; violations: string[] }> {
  try {
    const pathStat = await stat(path);
    if (!pathStat.isFile()) {
      return {
        artifact: undefined,
        violations: [`nextArtifactPath must point to a JSON file: ${path}`],
      };
    }
    return {
      artifact: JSON.parse(await readFile(path, "utf8")) as unknown,
      violations: [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        artifact: undefined,
        violations: [`nextArtifactPath file not found: ${path}`],
      };
    }
    if (err instanceof SyntaxError) {
      return {
        artifact: undefined,
        violations: [`nextArtifactPath JSON could not be parsed: ${err.message}`],
      };
    }
    return {
      artifact: undefined,
      violations: [`nextArtifactPath could not be read: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

function buildRunTaskPreflightReport(input: {
  artifactPath: string;
  repoRoot: string;
  status: SequentialContinuationRunTaskPreflightReport["status"];
  taskSpecPath?: string | null;
  normalizedTaskSpecPath?: string | null;
  resolvedTaskSpecPath?: string | null;
  task?: SequentialContinuationRunTaskPreflightReport["task"];
  requiredRuntime?: string | null;
  executionMode?: string | null;
  worktreePolicy?: string | null;
  lifecycleOwner?: string | null;
  targetFiles?: string[];
  forbiddenChanges?: string[];
  verifyCommands?: string[];
  blockingReasons: string[];
}): SequentialContinuationRunTaskPreflightReport {
  return {
    artifactPath: input.artifactPath,
    repoRoot: input.repoRoot,
    taskSpecPath: input.taskSpecPath ?? null,
    normalizedTaskSpecPath: input.normalizedTaskSpecPath ?? null,
    resolvedTaskSpecPath: input.resolvedTaskSpecPath ?? null,
    status: input.status,
    task: input.task ?? null,
    requiredRuntime: input.requiredRuntime ?? null,
    executionMode: input.executionMode ?? null,
    worktreePolicy: input.worktreePolicy ?? null,
    lifecycleOwner: input.lifecycleOwner ?? null,
    targetFiles: input.targetFiles ?? [],
    forbiddenChanges: input.forbiddenChanges ?? [],
    verifyCommands: input.verifyCommands ?? [],
    blockingReasons: input.blockingReasons,
    trustedStateChanges: false,
    pushPerformed: false,
    sideEffects: runTaskPreflightSideEffects(),
  };
}

function validateRunTaskCandidatePreflightRequirements(
  candidate: SequentialContinuationRunTaskCandidate,
): string[] {
  const reasons: string[] = [];
  if (candidate.requiredRuntime !== "codex-sdk") {
    reasons.push(`runTaskCandidate.requiredRuntime must be codex-sdk: ${candidate.requiredRuntime}`);
  }
  if (candidate.executionMode !== "preflight_only") {
    reasons.push(`runTaskCandidate.executionMode must be preflight_only: ${candidate.executionMode}`);
  }
  if (candidate.worktreePolicy !== "samantha_allocated_isolated") {
    reasons.push(`runTaskCandidate.worktreePolicy must be samantha_allocated_isolated: ${candidate.worktreePolicy}`);
  }
  if (candidate.lifecycleOwner !== "samantha") {
    reasons.push(`runTaskCandidate.lifecycleOwner must be samantha: ${candidate.lifecycleOwner}`);
  }
  if (candidate.evidence.taskSpecStatus !== "committed_clean") {
    reasons.push(`runTaskCandidate.evidence.taskSpecStatus must be committed_clean: ${candidate.evidence.taskSpecStatus}`);
  }
  for (const field of RUN_TASK_CANDIDATE_EXPECTED_SIDE_EFFECT_FIELD_NAMES) {
    if (candidate.expectedSideEffects[field] !== false) {
      reasons.push(`runTaskCandidate.expectedSideEffects.${field} must be false`);
    }
  }
  return reasons;
}

function normalizeRunTaskTaskSpecPath(value: unknown, violations: string[]): string | null {
  if (!isNonEmptyString(value)) {
    violations.push("runTaskCandidate.taskSpecPath must be a non-empty repo-relative references/tasks/*.json path");
    return null;
  }

  const beforeCount = violations.length;
  const trimmed = value.trim();
  const candidate = trimmed.replaceAll("\\", "/");
  const rawSegments = candidate.split("/");
  if (trimmed !== value || candidate !== trimmed || candidate.includes(":") || /\s/.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must be a normalized repo-relative local references/tasks/*.json path: ${value}`);
  }
  if (NEXT_ARTIFACT_COMMAND_PREFIX_PATTERN.test(trimmed)) {
    violations.push(`runTaskCandidate.taskSpecPath must not be a command string: ${value}`);
  }
  if (NEXT_ARTIFACT_URL_PATTERN.test(candidate) || /^file:/i.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must not be a URL: ${value}`);
  }
  if (candidate.startsWith("~") || NEXT_ARTIFACT_ENV_PATTERN.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must not use environment expansion: ${value}`);
  }
  if (NEXT_ARTIFACT_GLOB_PATTERN.test(candidate)) {
    violations.push(`runTaskCandidate.taskSpecPath must not be glob-like: ${value}`);
  }
  if (isAbsolute(value) || candidate.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || rawSegments.includes("..")) {
    violations.push(`runTaskCandidate.taskSpecPath must be repo-relative and stay inside repoRoot: ${value}`);
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === ".." || normalized !== candidate) {
    violations.push(`runTaskCandidate.taskSpecPath must be normalized and stay inside repoRoot: ${value}`);
  }
  if (!normalized.startsWith("references/tasks/")) {
    violations.push(`runTaskCandidate.taskSpecPath must be under references/tasks/: ${value}`);
  }
  if (!normalized.endsWith(".json")) {
    violations.push(`runTaskCandidate.taskSpecPath must end with .json: ${value}`);
  }

  return violations.length === beforeCount ? normalized : null;
}

async function readRunTaskTaskSpecFile(input: {
  repoRoot: string;
  normalizedTaskSpecPath: string;
  resolvedTaskSpecPath: string;
}): Promise<{ taskSpec: unknown; violations: string[] }> {
  try {
    const pathStat = await stat(input.resolvedTaskSpecPath);
    if (!pathStat.isFile()) {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath must point to a JSON file: ${input.resolvedTaskSpecPath}`],
      };
    }
    const [repoRealPath, taskSpecRealPath] = await Promise.all([
      realpath(input.repoRoot),
      realpath(input.resolvedTaskSpecPath),
    ]);
    const realRepoRelativePath = relative(repoRealPath, taskSpecRealPath).replaceAll("\\", "/");
    if (
      realRepoRelativePath === "" ||
      realRepoRelativePath.startsWith("../") ||
      realRepoRelativePath === ".." ||
      isAbsolute(realRepoRelativePath)
    ) {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath must stay inside repoRoot after resolving symlinks: ${input.normalizedTaskSpecPath}`],
      };
    }
    return {
      taskSpec: JSON.parse(await readFile(input.resolvedTaskSpecPath, "utf8")) as unknown,
      violations: [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath file not found: ${input.resolvedTaskSpecPath}`],
      };
    }
    if (err instanceof SyntaxError) {
      return {
        taskSpec: undefined,
        violations: [`runTaskCandidate.taskSpecPath JSON could not be parsed: ${err.message}`],
      };
    }
    return {
      taskSpec: undefined,
      violations: [`runTaskCandidate.taskSpecPath could not be read: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

function validateRunTaskTaskSpec(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["TaskSpec must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateAllowedFields(value, TASK_SPEC_FIELDS, (key) => `unknown TaskSpec field: ${key}`));
  for (const field of ["id", "title", "targetAgent", "instructions"] as const) {
    if (!isNonEmptyString(value[field])) {
      violations.push(`TaskSpec.${field} must be a non-empty string`);
    }
  }
  for (const field of ["targetFiles", "forbiddenChanges", "verifyCommands"] as const) {
    if (!hasOnlyNonEmptyStrings(value[field], { allowEmpty: false })) {
      violations.push(`TaskSpec.${field} must be a non-empty string array`);
    }
  }
  if (hasOwn(value, "setupCommands") && !hasOnlyNonEmptyStrings(value.setupCommands, { allowEmpty: true })) {
    violations.push("TaskSpec.setupCommands must be a string array when present");
  }
  if (hasOwn(value, "resultMode") && !TASK_RESULT_MODES.has(value.resultMode as string)) {
    violations.push(`TaskSpec.resultMode must be write or report when present: ${String(value.resultMode)}`);
  }
  if (hasOwn(value, "expectedCommitSubject") && !isNonEmptyString(value.expectedCommitSubject)) {
    violations.push("TaskSpec.expectedCommitSubject must be a non-empty string when present");
  }
  if (!TASK_SPEC_STATUSES.has(value.status as string)) {
    violations.push(`TaskSpec.status must be pending, in_progress, completed, failed, or blocked: ${String(value.status)}`);
  }

  return violations;
}

async function validateCommittedCleanTaskSpec(input: {
  repoRoot: string;
  normalizedTaskSpecPath: string;
  taskSpecCommit: string;
}): Promise<string[]> {
  const reasons: string[] = [];
  try {
    await git(["cat-file", "-e", `${input.taskSpecCommit}^{commit}`], input.repoRoot);
  } catch {
    return [`runTaskCandidate.evidence.taskSpecCommit must name a local commit: ${input.taskSpecCommit}`];
  }

  const trackedAtCommit = await git(["ls-tree", "--name-only", input.taskSpecCommit, "--", input.normalizedTaskSpecPath], input.repoRoot);
  if (!trackedAtCommit.split("\n").includes(input.normalizedTaskSpecPath)) {
    reasons.push(`runTaskCandidate.evidence.taskSpecCommit does not contain taskSpecPath: ${input.taskSpecCommit} ${input.normalizedTaskSpecPath}`);
  }

  const workingTreeStatus = await gitRaw(
    ["status", "--porcelain=v1", "--untracked-files=all", "-z", "--", input.normalizedTaskSpecPath],
    input.repoRoot,
  );
  if (workingTreeStatus) {
    reasons.push(`runTaskCandidate.taskSpecPath must be tracked and committed_clean: ${input.normalizedTaskSpecPath}`);
    return reasons;
  }

  if (reasons.length > 0) {
    return reasons;
  }

  try {
    await gitRaw(["diff", "--quiet", input.taskSpecCommit, "--", input.normalizedTaskSpecPath], input.repoRoot);
  } catch {
    reasons.push(`runTaskCandidate.evidence.taskSpecCommit is stale for taskSpecPath: ${input.taskSpecCommit} ${input.normalizedTaskSpecPath}`);
  }
  return reasons;
}

function validateRunTaskHandoff(input: {
  candidate: SequentialContinuationRunTaskCandidate;
  taskSpec: TaskSpec;
  currentSlice: SequentialContinuationCurrentSlice;
}): string[] {
  const reasons: string[] = [];
  if (!sameStringArray(input.candidate.targetFiles, input.taskSpec.targetFiles)) {
    reasons.push("runTaskCandidate.targetFiles must match TaskSpec targetFiles");
  }
  if (!sameStringArray(input.candidate.forbiddenChanges, input.taskSpec.forbiddenChanges)) {
    reasons.push("runTaskCandidate.forbiddenChanges must match TaskSpec forbiddenChanges");
  }
  if (!sameStringArray(input.candidate.verifyCommands, input.taskSpec.verifyCommands)) {
    reasons.push("runTaskCandidate.verifyCommands must match TaskSpec verifyCommands");
  }
  if (!sameStringArray(input.candidate.targetFiles, input.currentSlice.targetFiles ?? [])) {
    reasons.push("runTaskCandidate.targetFiles must match currentSlice targetFiles");
  }
  if (!sameStringArray(input.candidate.forbiddenChanges, input.currentSlice.forbiddenChanges ?? [])) {
    reasons.push("runTaskCandidate.forbiddenChanges must match currentSlice forbiddenChanges");
  }
  if (!sameStringArray(input.candidate.verifyCommands, input.currentSlice.verifyCommands ?? [])) {
    reasons.push("runTaskCandidate.verifyCommands must match currentSlice verifyCommands");
  }
  return reasons;
}

function taskSpecTitleForReport(taskSpec: unknown): SequentialContinuationRunTaskPreflightReport["task"] {
  if (!isRecord(taskSpec) || !isNonEmptyString(taskSpec.id) || !isNonEmptyString(taskSpec.title)) {
    return null;
  }
  return {
    id: taskSpec.id,
    title: taskSpec.title,
  };
}

async function validateSuccessorEvidenceFreshness(input: {
  repoRoot: string;
  predecessorArtifactPath: string;
  predecessorArtifact: unknown;
  successorArtifact: unknown;
}): Promise<string[]> {
  if (!isRecord(input.successorArtifact) || !Array.isArray(input.successorArtifact.evidenceReferences)) {
    return [];
  }

  const violations: string[] = [];
  const successorEvidencePaths = input.successorArtifact.evidenceReferences.flatMap((reference) => {
    return isRecord(reference) && isNonEmptyString(reference.path) ? [reference.path] : [];
  });
  const predecessorEvidencePaths =
    isRecord(input.predecessorArtifact) && Array.isArray(input.predecessorArtifact.evidenceReferences)
      ? input.predecessorArtifact.evidenceReferences.flatMap((reference) => {
          return isRecord(reference) && isNonEmptyString(reference.path) ? [reference.path] : [];
        })
      : [];
  const requiredCitations = new Set(
    [input.predecessorArtifactPath, ...predecessorEvidencePaths].map((path) =>
      normalizePathForReport(path, input.repoRoot),
    ),
  );
  const successorCitations = new Set(
    successorEvidencePaths.map((path) => normalizePathForReport(path, input.repoRoot)),
  );

  for (const evidencePath of successorEvidencePaths) {
    if (!(await localEvidenceReferenceExists(input.repoRoot, evidencePath))) {
      violations.push(`successor evidence reference file is missing: ${evidencePath}`);
    }
  }
  if (![...successorCitations].some((path) => requiredCitations.has(path))) {
    violations.push("successor evidenceReferences must cite predecessor artifact or evidence reference");
  }

  return violations;
}

async function localEvidenceReferenceExists(repoRoot: string, path: string): Promise<boolean> {
  const resolvedPath = isAbsolute(path) ? resolve(path) : resolve(repoRoot, path);
  const repoRelativePath = relative(repoRoot, resolvedPath).replaceAll("\\", "/");
  if (repoRelativePath === "" || repoRelativePath.startsWith("../") || repoRelativePath === ".." || isAbsolute(repoRelativePath)) {
    return false;
  }
  try {
    return (await stat(resolvedPath)).isFile();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

function readOptionalStringField(value: unknown, field: string): string | null {
  if (!isRecord(value) || !hasOwn(value, field) || value[field] === null) {
    return null;
  }
  return typeof value[field] === "string" ? value[field] : null;
}

function normalizePathForReport(path: string, repoRoot: string): string {
  const resolvedPath = isAbsolute(path) ? resolve(path) : resolve(repoRoot, path);
  const repoRelativePath = relative(repoRoot, resolvedPath).replaceAll("\\", "/");
  if (repoRelativePath !== "" && !repoRelativePath.startsWith("../") && repoRelativePath !== ".." && !isAbsolute(repoRelativePath)) {
    return repoRelativePath;
  }
  return path.replaceAll("\\", "/");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function validateForbiddenFieldNames(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => validateForbiddenFieldNames(item, `${path}[${index}]`));
  }
  if (!isRecord(value)) {
    return [];
  }

  const violations: string[] = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (isForbiddenFieldName(key)) {
      violations.push(`${fieldPath} field is not allowed in a sequential continuation artifact`);
    }
    violations.push(...validateForbiddenFieldNames(nestedValue, fieldPath));
  }

  return violations;
}

function validateForbiddenLifecycleWording(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    if (FORBIDDEN_LIFECYCLE_WORDING_PATTERNS.some((pattern) => pattern.test(value))) {
      return [`${path || "artifact"} must not authorize lifecycle action: ${value}`];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => validateForbiddenLifecycleWording(item, `${path}[${index}]`));
  }
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    return validateForbiddenLifecycleWording(nestedValue, path ? `${path}.${key}` : key);
  });
}

function isForbiddenFieldName(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    FORBIDDEN_FIELD_NAMES.has(normalized) ||
    normalized.includes("hiddenmemory") ||
    normalized.includes("secret") ||
    normalized.includes("credential") ||
    normalized.includes("apikey") ||
    normalized.includes("token") ||
    normalized.includes("daemon") ||
    normalized.includes("watch") ||
    normalized.includes("dashboard") ||
    normalized.includes("remoteadapter") ||
    normalized.includes("routinetrigger")
  );
}

function isStopConditionId(value: unknown): value is SequentialContinuationStopConditionId {
  return typeof value === "string" && STOP_CONDITION_ID_SET.has(value as SequentialContinuationStopConditionId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isSequentialContinuationArtifact(value: unknown): value is SequentialContinuationArtifact {
  return validateSequentialContinuationArtifact(value).length === 0;
}

function isStatusEvidenceDocument(value: unknown): value is SequentialContinuationStatusEvidenceDocument {
  return validateSequentialContinuationStatusEvidence(value).length === 0;
}

function readReportCurrentSlice(value: unknown): SequentialContinuationReport["currentSlice"] {
  const fallback = {
    id: null,
    status: null,
    actionType: null,
    dependencyStatus: null,
  };
  if (!isRecord(value) || !isRecord(value.currentSlice)) {
    return fallback;
  }

  return {
    id: stringOrNull(value.currentSlice.id),
    status: stringOrNull(value.currentSlice.status),
    actionType: stringOrNull(value.currentSlice.actionType),
    dependencyStatus: stringOrNull(value.currentSlice.dependencyStatus),
  };
}

function readStatusUpdateCurrentSlice(value: unknown): SequentialContinuationStatusUpdateReport["currentSlice"] {
  const fallback = {
    id: null,
    previousStatus: null,
    updatedStatus: null,
    actionType: null,
    dependencyStatus: null,
  };
  if (!isRecord(value) || !isRecord(value.currentSlice)) {
    return fallback;
  }

  return {
    id: stringOrNull(value.currentSlice.id),
    previousStatus: stringOrNull(value.currentSlice.status),
    updatedStatus: stringOrNull(value.currentSlice.status),
    actionType: stringOrNull(value.currentSlice.actionType),
    dependencyStatus: stringOrNull(value.currentSlice.dependencyStatus),
  };
}

function readReportActiveStopConditions(value: unknown): SequentialContinuationReport["activeStopConditions"] {
  if (!isRecord(value) || !Array.isArray(value.stopConditionChecklist)) {
    return [];
  }

  return value.stopConditionChecklist.flatMap((item) => {
    if (!isRecord(item) || item.active !== true || !isNonEmptyString(item.id) || !isNonEmptyString(item.evidence)) {
      return [];
    }
    return [{ id: item.id, evidence: item.evidence }];
  });
}

function readReportNextStep(value: unknown): { kind: string | null; value: string | null } {
  if (!isRecord(value) || !isRecord(value.nextStep)) {
    return {
      kind: null,
      value: null,
    };
  }

  return {
    kind: stringOrNull(value.nextStep.kind),
    value: stringOrNull(value.nextStep.value),
  };
}

function readStatusUpdateOutcome(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  return stringOrNull(value.outcome);
}

function readStatusEvidenceReferences(value: unknown): SequentialContinuationStatusEvidenceReference[] {
  if (!isRecord(value) || !Array.isArray(value.evidenceReferences)) {
    return [];
  }

  return value.evidenceReferences.flatMap((item) => {
    if (
      !isRecord(item) ||
      !STATUS_EVIDENCE_KIND_SET.has(item.kind as SequentialContinuationStatusEvidenceKind) ||
      !isNonEmptyString(item.path) ||
      !isNonEmptyString(item.summary) ||
      !STATUS_EVIDENCE_RESULT_SET.has(item.result as SequentialContinuationStatusEvidenceResult)
    ) {
      return [];
    }
    return [
      {
        kind: item.kind as SequentialContinuationStatusEvidenceKind,
        path: item.path,
        summary: item.summary,
        result: item.result as SequentialContinuationStatusEvidenceResult,
      },
    ];
  });
}

function hasTrustedCompletionEvidence(
  actionType: SequentialContinuationActionType,
  references: SequentialContinuationStatusEvidenceReference[],
): boolean {
  if (actionType === "run_task" || actionType === "batch_plan") {
    return references.some((reference) => reference.kind === "run_log" && reference.result === "passed");
  }
  if (actionType === "readiness_check") {
    return references.some(
      (reference) =>
        reference.kind === "readiness_report" &&
        (reference.result === "passed" || reference.result === "clear" || reference.result === "completed"),
    );
  }
  if (actionType === "report_only") {
    return references.some(
      (reference) =>
        (reference.kind === "continuation_report" || reference.kind === "report_review") &&
        (reference.result === "passed" || reference.result === "clear" || reference.result === "completed"),
    );
  }
  if (actionType === "manual_decision") {
    return references.some((reference) => reference.result !== "recommendation_only");
  }
  return false;
}

function buildStatusUpdateReport(input: {
  artifactPath: string;
  evidencePath: string;
  status: "accepted" | "rejected";
  violations: string[];
  requestedOutcome: string | null;
  acceptedOutcome: "completed" | "blocked" | null;
  currentSlice: SequentialContinuationStatusUpdateReport["currentSlice"];
  evidenceReferences: SequentialContinuationStatusEvidenceReference[];
  nextStep: { kind: string | null; value: string | null };
  artifactUpdated: boolean;
}): SequentialContinuationStatusUpdateReport {
  return {
    artifactPath: input.artifactPath,
    evidencePath: input.evidencePath,
    status: input.status,
    violations: input.violations,
    requestedOutcome: input.requestedOutcome,
    acceptedOutcome: input.acceptedOutcome,
    currentSlice: input.currentSlice,
    evidenceReferences: input.evidenceReferences,
    exactNextSamanthaCommand: input.nextStep.kind === "samantha_command" ? input.nextStep.value : null,
    blockedReportText: input.nextStep.kind === "blocked_report" ? input.nextStep.value : null,
    artifactUpdated: input.artifactUpdated,
    trustedStateChanges: input.artifactUpdated,
    pushPerformed: false,
    sideEffects: {
      runTaskCalled: false,
      batchesExecuteCalled: false,
      workersDispatched: false,
      runsCreated: false,
      worktreesCreated: false,
    },
  };
}

function buildSingleStepResult(input: {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  selectedActionType: string | null;
  actionExecuted: boolean;
  actionAttemptCount: number;
  generatedEvidencePath: string | null;
  inlineEvidenceSummary: string | null;
  statusUpdateReport: SequentialContinuationStatusUpdateReport | null;
  nextStep: SequentialContinuationNextStep | null;
  updatedArtifact: SequentialContinuationArtifact | null;
}): SequentialContinuationSingleStepResult {
  return {
    report: {
      artifactPath: input.artifactPath,
      status: input.status,
      violations: input.violations,
      selectedActionType: input.selectedActionType,
      actionExecuted: input.actionExecuted,
      actionAttemptCount: input.actionAttemptCount,
      generatedEvidencePath: input.generatedEvidencePath,
      inlineEvidenceSummary: input.inlineEvidenceSummary,
      statusUpdateReport: input.statusUpdateReport,
      nextStep: input.nextStep,
      continued: false,
      multiStepLoopStarted: false,
      pushPerformed: false,
      sideEffects: singleStepSideEffects(),
    },
    updatedArtifact: input.updatedArtifact,
  };
}

function buildLoopResult(input: {
  artifactPath: string;
  status: "accepted" | "blocked" | "rejected";
  violations: string[];
  stepCount: number;
  maxSteps: number;
  stopReason: string;
  failedEvidenceReworkCyclesUsed: number;
  maxFailedEvidenceReworkCycles: number;
  singleStepReports: SequentialContinuationSingleStepReport[];
  nextStep: SequentialContinuationNextStep | null;
  updatedArtifacts: SequentialContinuationLoopResult["updatedArtifacts"];
}): SequentialContinuationLoopResult {
  return {
    report: {
      artifactPath: input.artifactPath,
      status: input.status,
      violations: input.violations,
      stepCount: input.stepCount,
      maxSteps: input.maxSteps,
      stopReason: input.stopReason,
      failedEvidenceReworkCyclesUsed: input.failedEvidenceReworkCyclesUsed,
      failedEvidenceReworkCyclesRemaining:
        input.maxFailedEvidenceReworkCycles - input.failedEvidenceReworkCyclesUsed,
      singleStepReports: input.singleStepReports,
      nextStep: input.nextStep,
      continued: input.singleStepReports.length > 1,
      multiStepLoopStarted: input.maxSteps > 1,
      pushPerformed: false,
      sideEffects: singleStepSideEffects(),
    },
    updatedArtifacts: input.updatedArtifacts,
  };
}

function singleStepSideEffects(): SequentialContinuationSingleStepReport["sideEffects"] {
  return {
    runTaskCalled: false,
    batchesExecuteCalled: false,
    workersDispatched: false,
    runsCreated: false,
    worktreesCreated: false,
    pushPerformed: false,
  };
}

function runTaskPreflightSideEffects(): SequentialContinuationRunTaskPreflightReport["sideEffects"] {
  return {
    runTaskCalled: false,
    batchesExecuteCalled: false,
    workersDispatched: false,
    runsCreated: false,
    worktreesCreated: false,
    lifecycleMutated: false,
    mergePerformed: false,
    cleanupPerformed: false,
    commitPerformed: false,
    pushPerformed: false,
  };
}

function singleStepGuardViolations(artifact: SequentialContinuationArtifact): string[] {
  const violations: string[] = [];

  if (artifact.currentSlice.status !== "ready") {
    violations.push("currentSlice.status must be ready for single-step continuation");
  }
  if (artifact.currentSlice.dependencyStatus !== "met") {
    violations.push("currentSlice.dependencyStatus must be met for single-step continuation");
  }
  if (artifact.autonomyEnvelope.pushAllowed !== false) {
    violations.push("autonomyEnvelope.pushAllowed must be false for single-step continuation");
  }

  for (const stopCondition of artifact.stopConditionChecklist) {
    if (stopCondition.active) {
      violations.push(`stop condition active: ${stopCondition.id}: ${stopCondition.evidence}`);
    }
  }

  const actionType = artifact.currentSlice.actionType;
  if (actionType === "manual_decision") {
    violations.push("manual_decision requires BK input and cannot be executed by single-step continuation");
  } else if (WRITE_CAPABLE_ACTION_TYPES.has(actionType)) {
    violations.push(`${actionType} is blocked until reviewed explicit taskSpecPath/batchSpecPath support exists`);
  } else if (actionType !== SINGLE_STEP_EXECUTABLE_ACTION_TYPE) {
    violations.push(`single-step continuation currently supports only readiness_check: ${actionType}`);
  }

  return violations;
}

function nextStepFromContinuationReport(report: SequentialContinuationReport): SequentialContinuationNextStep | null {
  if (report.exactNextSamanthaCommand) {
    return {
      kind: "samantha_command",
      value: report.exactNextSamanthaCommand,
    };
  }
  if (report.blockedReportText) {
    return {
      kind: "blocked_report",
      value: report.blockedReportText,
    };
  }
  return null;
}

function nextStepFromStatusUpdateReport(report: SequentialContinuationStatusUpdateReport): SequentialContinuationNextStep | null {
  if (report.exactNextSamanthaCommand) {
    return {
      kind: "samantha_command",
      value: report.exactNextSamanthaCommand,
    };
  }
  if (report.blockedReportText) {
    return {
      kind: "blocked_report",
      value: report.blockedReportText,
    };
  }
  return null;
}

function buildReportBlockingReasons(input: {
  violations: string[];
  currentSlice: SequentialContinuationReport["currentSlice"];
  activeStopConditions: SequentialContinuationReport["activeStopConditions"];
  nextStep: { kind: string | null; value: string | null };
  nextArtifactLinkage?: SequentialContinuationNextArtifactReport;
  runTaskPreflight?: SequentialContinuationRunTaskPreflightReport;
}): string[] {
  const reasons: string[] = [];
  for (const stopCondition of input.activeStopConditions) {
    pushUnique(reasons, `${stopCondition.id}: ${stopCondition.evidence}`);
  }
  if (input.currentSlice.dependencyStatus === "blocked") {
    pushUnique(reasons, "currentSlice.dependencyStatus is blocked");
  }
  if (input.nextStep.kind === "blocked_report" && input.nextStep.value) {
    pushUnique(reasons, input.nextStep.value);
  }
  for (const violation of input.violations) {
    pushUnique(reasons, violation);
  }
  if (input.nextArtifactLinkage?.status === "blocked") {
    for (const reason of input.nextArtifactLinkage.blockingReasons) {
      pushUnique(reasons, `nextArtifactPath: ${reason}`);
    }
  }
  if (input.runTaskPreflight?.status === "blocked") {
    for (const reason of input.runTaskPreflight.blockingReasons) {
      pushUnique(reasons, `runTaskPreflight: ${reason}`);
    }
  }
  return reasons;
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateAllowedFields(
  value: Record<string, unknown>,
  allowedFields: Set<string>,
  formatViolation: (key: string) => string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowedFields.has(key))
    .map(formatViolation);
}

function hasOnlyNonEmptyStrings(value: unknown, options: { allowEmpty: boolean }): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (!options.allowEmpty && value.length === 0) {
    return false;
  }

  return value.every(isNonEmptyString);
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function joinOptions(values: readonly string[]): string {
  return values.join(", ").replace(/, ([^,]*)$/, ", or $1");
}
