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

const ACTION_TYPE_SET = new Set<SequentialContinuationActionType>(SEQUENTIAL_CONTINUATION_ACTION_TYPES);
const SLICE_STATUS_SET = new Set<SequentialContinuationSliceStatus>(SEQUENTIAL_CONTINUATION_SLICE_STATUSES);
const STOP_CONDITION_ID_SET = new Set<SequentialContinuationStopConditionId>(
  SEQUENTIAL_CONTINUATION_STOP_CONDITION_IDS,
);
const WRITE_CAPABLE_ACTION_TYPES = new Set<SequentialContinuationActionType>(["run_task", "batch_plan"]);
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
const EVIDENCE_REFERENCE_FIELDS = new Set(["path", "summary"]);
const NEXT_STEP_FIELDS = new Set(["kind", "value"]);
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
