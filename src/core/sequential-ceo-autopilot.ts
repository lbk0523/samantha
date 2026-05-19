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

  return violations;
}

export function buildSequentialContinuationReport(input: {
  artifactPath: string;
  artifact: unknown;
  violations?: string[];
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
    }),
    allowedActionType,
    exactNextSamanthaCommand: nextStep.kind === "samantha_command" ? nextStep.value : null,
    blockedReportText: nextStep.kind === "blocked_report" ? nextStep.value : null,
    trustedStateChanges: false,
    pushPerformed: false,
  };
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

function joinOptions(values: readonly string[]): string {
  return values.join(", ").replace(/, ([^,]*)$/, ", or $1");
}
