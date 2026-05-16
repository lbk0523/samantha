export type BatchPlanDraftClassification =
  | "routine_writer_batch"
  | "report_only"
  | "recovery"
  | "doctrine"
  | "product_boundary"
  | "architecture"
  | "roadmap"
  | "blocked";

export interface StructuredPlaceholder {
  field: string;
  reason: string;
  resolutionOwner: "ceo" | "deterministic_assembly" | "bk";
  blocksPromotion: boolean;
}

export interface RepoInspectionEvidence {
  inspectedPaths: string[];
  currentStateSummary: string;
  candidateWriteSurfaces: string[];
  authorityBoundarySurfaces: string[];
  assumptions: string[];
}

export interface ProposedTask {
  id: string;
  title: string;
  summary: string;
  targetFileHints: string[];
  forbiddenChangeHints: string[];
  verifyCommandHints: string[];
  independentlyVerifiableRationale: string;
}

export interface DependencyHint {
  before: string;
  after: string;
  reason: string;
}

export interface ParallelizationHint {
  taskIds: string[];
  rationale: string;
}

export interface BatchPlanDraft {
  schemaVersion: 1;
  draftId: string;
  createdAt: string;
  sourceGoal: string;
  classification: BatchPlanDraftClassification;
  repoInspection: RepoInspectionEvidence;
  proposedTasks: ProposedTask[];
  dependencyHints: DependencyHint[];
  parallelizationHints: ParallelizationHint[];
  structuredPlaceholders: StructuredPlaceholder[];
  autonomyEnvelope: {
    localCommitAllowed: boolean;
    pushAllowed: false;
    maxReworkCycles: 1;
  };
  promotionReadiness: {
    status: "ready" | "needs_placeholders_resolved" | "blocked";
    reasons: string[];
  };
  report: {
    summary: string;
    nextAction: string;
  };
}

const DRAFT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/;
const REPO_RELATIVE_FORBIDDEN_PATTERN = /^[A-Za-z]:[\\/]/;
const GLOB_CHARS_PATTERN = /[*?[\]]/;
const UNRESOLVED_PLACEHOLDER_TEXT_PATTERN = /\b(?:TODO|TBD|unknown|guess|maybe|placeholder)\b|<[^>\n]+>/i;
const AUTHORITY_BOUNDARY_TARGET_FILES = new Set([
  "AGENTS.md",
  "NORTH_STAR.md",
  "ARCHITECTURE.md",
  "ROADMAP.md",
  "WORK-RULES.md",
  "src/core/policy.ts",
  "src/core/contracts.ts",
  "package.json",
  "bun.lock",
]);
const AUTHORITY_BOUNDARY_TARGET_PREFIXES = ["references/agent-profiles/", "references/task-templates/"];
const CLASSIFICATIONS = new Set<BatchPlanDraftClassification>([
  "routine_writer_batch",
  "report_only",
  "recovery",
  "doctrine",
  "product_boundary",
  "architecture",
  "roadmap",
  "blocked",
]);
const PLACEHOLDER_OWNERS = new Set<StructuredPlaceholder["resolutionOwner"]>([
  "ceo",
  "deterministic_assembly",
  "bk",
]);
const PROMOTION_READINESS_STATUSES = new Set<BatchPlanDraft["promotionReadiness"]["status"]>([
  "ready",
  "needs_placeholders_resolved",
  "blocked",
]);

export function validateBatchPlanDraft(draft: BatchPlanDraft): string[] {
  const violations: string[] = [];
  const candidate = draft as unknown;
  if (!isRecord(candidate)) {
    return ["BatchPlanDraft must be an object"];
  }

  if (candidate.schemaVersion !== 1) {
    violations.push("schemaVersion must be exactly 1");
  }
  if (!isNonEmptyString(candidate.draftId) || !DRAFT_ID_PATTERN.test(candidate.draftId)) {
    violations.push("draftId must match ^[a-z0-9][a-z0-9-]{2,79}$");
  }
  if (!isNonEmptyString(candidate.createdAt)) {
    violations.push("createdAt must be a non-empty string");
  }
  if (!isNonEmptyString(candidate.sourceGoal)) {
    violations.push("sourceGoal must be a non-empty string");
  }
  if (!CLASSIFICATIONS.has(candidate.classification as BatchPlanDraftClassification)) {
    violations.push(`classification must be a valid BatchPlanDraftClassification: ${String(candidate.classification)}`);
  }

  violations.push(...validateRepoInspection(candidate.repoInspection));
  violations.push(...validateStructuredPlaceholders(candidate.structuredPlaceholders));
  violations.push(...validateProposedTasks(candidate.proposedTasks, candidate));
  violations.push(...validateDependencyHints(candidate.dependencyHints, candidate.proposedTasks));
  violations.push(...validateParallelizationHints(candidate.parallelizationHints, candidate.proposedTasks));
  violations.push(...validateAutonomyEnvelope(candidate.autonomyEnvelope));
  violations.push(...validatePromotionReadiness(candidate.promotionReadiness));
  violations.push(...validateReport(candidate.report));
  violations.push(...validatePromotionReadinessConsistency(candidate));

  return violations;
}

export function canPromoteBatchPlanDraft(draft: BatchPlanDraft): { mayPromote: boolean; violations: string[] } {
  const violations = validateBatchPlanDraft(draft);
  const candidate = draft as unknown;
  if (!isRecord(candidate)) {
    return { mayPromote: false, violations };
  }

  appendUnique(
    violations,
    candidate.classification === "routine_writer_batch",
    "classification must be routine_writer_batch to promote",
  );

  const readiness = candidate.promotionReadiness;
  appendUnique(
    violations,
    isRecord(readiness) && readiness.status === "ready",
    "promotionReadiness.status must be ready to promote",
  );

  appendUnique(
    violations,
    !hasBlockingPlaceholder(candidate.structuredPlaceholders),
    "structuredPlaceholders must not contain blocking placeholders to promote",
  );

  if (candidate.classification === "routine_writer_batch") {
    violations.push(...validatePromotableTargetFileHints(candidate.proposedTasks));
  }

  return { mayPromote: violations.length === 0, violations };
}

function validateRepoInspection(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["repoInspection must be an object"];
  }

  const violations: string[] = [];
  for (const fieldName of [
    "inspectedPaths",
    "candidateWriteSurfaces",
    "authorityBoundarySurfaces",
    "assumptions",
  ] as const) {
    if (!hasOnlyNonEmptyStrings(value[fieldName], { allowEmpty: false })) {
      violations.push(`repoInspection.${fieldName} must be a non-empty string array`);
    }
  }
  if (!isNonEmptyString(value.currentStateSummary)) {
    violations.push("repoInspection.currentStateSummary must be a non-empty string");
  }
  violations.push(...validateNoUnresolvedPlaceholderText(value.assumptions, "repoInspection.assumptions"));

  return violations;
}

function validateStructuredPlaceholders(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["structuredPlaceholders must be an array"];
  }

  const violations: string[] = [];
  value.forEach((placeholder, index) => {
    if (!isRecord(placeholder)) {
      violations.push(`structuredPlaceholders[${index}] must be an object`);
      return;
    }
    if (!isNonEmptyString(placeholder.field)) {
      violations.push(`structuredPlaceholders[${index}].field must be a non-empty string`);
    }
    if (!isNonEmptyString(placeholder.reason)) {
      violations.push(`structuredPlaceholders[${index}].reason must be a non-empty string`);
    }
    if (!PLACEHOLDER_OWNERS.has(placeholder.resolutionOwner as StructuredPlaceholder["resolutionOwner"])) {
      violations.push(
        `structuredPlaceholders[${index}].resolutionOwner must be ceo, deterministic_assembly, or bk`,
      );
    }
    if (typeof placeholder.blocksPromotion !== "boolean") {
      violations.push(`structuredPlaceholders[${index}].blocksPromotion must be a boolean`);
    }
  });

  return violations;
}

function validateProposedTasks(value: unknown, draft: Record<string, unknown>): string[] {
  if (!Array.isArray(value)) {
    return ["proposedTasks must be an array"];
  }

  const violations: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  value.forEach((task, index) => {
    if (!isRecord(task)) {
      violations.push(`proposedTasks[${index}] must be an object`);
      return;
    }

    const taskId = isNonEmptyString(task.id) ? task.id : `index ${index}`;
    if (!isNonEmptyString(task.id)) {
      violations.push(`proposedTasks[${index}].id must be a non-empty string`);
    } else if (seen.has(task.id)) {
      duplicates.add(task.id);
    } else {
      seen.add(task.id);
    }
    if (!isNonEmptyString(task.title)) {
      violations.push(`proposedTasks[].title must be a non-empty string: ${taskId}`);
    }
    if (!isNonEmptyString(task.summary)) {
      violations.push(`proposedTasks[].summary must be a non-empty string: ${taskId}`);
    }
    violations.push(...validateNoUnresolvedPlaceholderText(task.summary, "proposedTasks[].summary", taskId));

    const canDeferTargetFileHints = canDeferIncompleteProposedTaskField(draft, index, "targetFileHints");
    if (!hasOnlyNonEmptyStrings(task.targetFileHints, { allowEmpty: false })) {
      if (!canDeferTargetFileHints || !isMissingOrEmptyArray(task.targetFileHints)) {
        violations.push(`proposedTasks[].targetFileHints must be a non-empty string array: ${taskId}`);
      }
    } else {
      for (const targetFileHint of task.targetFileHints) {
        if (!isConcreteRepoFileHint(targetFileHint)) {
          violations.push(
            `proposedTasks[].targetFileHints must be concrete repo-relative file hints: ${taskId} has ${targetFileHint}`,
          );
        }
      }
    }
    violations.push(...validateNoUnresolvedPlaceholderText(task.targetFileHints, "proposedTasks[].targetFileHints", taskId));

    if (!hasOnlyNonEmptyStrings(task.forbiddenChangeHints, { allowEmpty: false })) {
      violations.push(`proposedTasks[].forbiddenChangeHints must be a non-empty string array: ${taskId}`);
    }
    violations.push(
      ...validateNoUnresolvedPlaceholderText(task.forbiddenChangeHints, "proposedTasks[].forbiddenChangeHints", taskId),
    );

    const canDeferVerifyCommandHints = canDeferIncompleteProposedTaskField(draft, index, "verifyCommandHints");
    if (!hasOnlyNonEmptyStrings(task.verifyCommandHints, { allowEmpty: false })) {
      if (!canDeferVerifyCommandHints || !isMissingOrEmptyArray(task.verifyCommandHints)) {
        violations.push(`proposedTasks[].verifyCommandHints must be a non-empty string array: ${taskId}`);
      }
    }
    violations.push(...validateNoUnresolvedPlaceholderText(task.verifyCommandHints, "proposedTasks[].verifyCommandHints", taskId));

    if (!isNonEmptyString(task.independentlyVerifiableRationale)) {
      violations.push(`proposedTasks[].independentlyVerifiableRationale must be a non-empty string: ${taskId}`);
    }
    violations.push(
      ...validateNoUnresolvedPlaceholderText(
        task.independentlyVerifiableRationale,
        "proposedTasks[].independentlyVerifiableRationale",
        taskId,
      ),
    );
  });

  for (const taskId of duplicates) {
    violations.push(`proposedTasks[].id must be unique: ${taskId}`);
  }

  return violations;
}

function validatePromotableTargetFileHints(proposedTasks: unknown): string[] {
  if (!Array.isArray(proposedTasks)) {
    return [];
  }

  const violations: string[] = [];
  proposedTasks.forEach((task, index) => {
    if (!isRecord(task) || !Array.isArray(task.targetFileHints)) {
      return;
    }

    const taskId = isNonEmptyString(task.id) ? task.id : `index ${index}`;
    for (const targetFileHint of task.targetFileHints) {
      if (typeof targetFileHint !== "string") {
        continue;
      }
      if (isAuthorityBoundaryTargetHint(targetFileHint)) {
        violations.push(
          `proposedTasks[].targetFileHints must not include authority-boundary surfaces to promote: ${taskId} has ${targetFileHint}`,
        );
      }
    }
  });

  return violations;
}

function validateNoUnresolvedPlaceholderText(value: unknown, fieldName: string, context?: string): string[] {
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value.filter(isString) : [];
  const violations: string[] = [];

  for (const text of values) {
    const normalized = text.trim();
    if (UNRESOLVED_PLACEHOLDER_TEXT_PATTERN.test(normalized)) {
      violations.push(
        `${fieldName} must not contain unresolved placeholder text: ${context === undefined ? normalized : `${context} has ${normalized}`}`,
      );
    }
  }

  return violations;
}

function canDeferIncompleteProposedTaskField(
  draft: Record<string, unknown>,
  taskIndex: number,
  fieldName: "targetFileHints" | "verifyCommandHints",
): boolean {
  const readiness = draft.promotionReadiness;
  if (
    !isRecord(readiness) ||
    (readiness.status !== "needs_placeholders_resolved" && readiness.status !== "blocked")
  ) {
    return false;
  }

  return hasBlockingPlaceholderForField(draft.structuredPlaceholders, [
    `proposedTasks[${taskIndex}].${fieldName}`,
    `proposedTasks[].${fieldName}`,
  ]);
}

function hasBlockingPlaceholderForField(value: unknown, fieldNames: string[]): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (placeholder) =>
        isRecord(placeholder) &&
        placeholder.blocksPromotion === true &&
        typeof placeholder.field === "string" &&
        fieldNames.includes(placeholder.field.trim()),
    )
  );
}

function isMissingOrEmptyArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

function isAuthorityBoundaryTargetHint(value: string): boolean {
  const normalized = normalizeRepoFileHint(value);
  return (
    AUTHORITY_BOUNDARY_TARGET_FILES.has(normalized) ||
    AUTHORITY_BOUNDARY_TARGET_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))
  );
}

function normalizeRepoFileHint(value: string): string {
  let normalized = value.trim().replaceAll("\\", "/");
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function validateDependencyHints(value: unknown, proposedTasks: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["dependencyHints must be an array"];
  }

  const taskIds = taskIdSet(proposedTasks);
  const violations: string[] = [];
  value.forEach((hint, index) => {
    if (!isRecord(hint)) {
      violations.push(`dependencyHints[${index}] must be an object`);
      return;
    }
    if (!isNonEmptyString(hint.before)) {
      violations.push(`dependencyHints[${index}].before must be a non-empty string`);
    }
    if (!isNonEmptyString(hint.after)) {
      violations.push(`dependencyHints[${index}].after must be a non-empty string`);
    }
    if (!isNonEmptyString(hint.reason)) {
      violations.push(`dependencyHints[${index}].reason must be a non-empty string`);
    }
    violations.push(...validateNoUnresolvedPlaceholderText(hint.reason, `dependencyHints[${index}].reason`));
    if (isNonEmptyString(hint.before) && isNonEmptyString(hint.after) && hint.before === hint.after) {
      violations.push(`dependencyHints[${index}] must not point a task at itself: ${hint.before}`);
    }
    if (isNonEmptyString(hint.before) && taskIds.size > 0 && !taskIds.has(hint.before)) {
      violations.push(`dependencyHints[${index}].before must reference a proposed task id: ${hint.before}`);
    }
    if (isNonEmptyString(hint.after) && taskIds.size > 0 && !taskIds.has(hint.after)) {
      violations.push(`dependencyHints[${index}].after must reference a proposed task id: ${hint.after}`);
    }
  });

  return violations;
}

function validateParallelizationHints(value: unknown, proposedTasks: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["parallelizationHints must be an array"];
  }

  const taskIds = taskIdSet(proposedTasks);
  const violations: string[] = [];
  value.forEach((hint, index) => {
    if (!isRecord(hint)) {
      violations.push(`parallelizationHints[${index}] must be an object`);
      return;
    }
    if (!hasOnlyNonEmptyStrings(hint.taskIds, { allowEmpty: false })) {
      violations.push(`parallelizationHints[${index}].taskIds must be a non-empty string array`);
    } else if (taskIds.size > 0) {
      for (const taskId of hint.taskIds) {
        if (!taskIds.has(taskId)) {
          violations.push(`parallelizationHints[${index}].taskIds must reference proposed task ids: ${taskId}`);
        }
      }
    }
    if (!isNonEmptyString(hint.rationale)) {
      violations.push(`parallelizationHints[${index}].rationale must be a non-empty string`);
    }
    violations.push(...validateNoUnresolvedPlaceholderText(hint.rationale, `parallelizationHints[${index}].rationale`));
  });

  return violations;
}

function validateAutonomyEnvelope(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["autonomyEnvelope must be an object"];
  }

  const violations: string[] = [];
  if (typeof value.localCommitAllowed !== "boolean") {
    violations.push("autonomyEnvelope.localCommitAllowed must be a boolean");
  }
  if (value.pushAllowed !== false) {
    violations.push("autonomyEnvelope.pushAllowed must be false");
  }
  if (value.maxReworkCycles !== 1) {
    violations.push("autonomyEnvelope.maxReworkCycles must be 1");
  }

  return violations;
}

function validatePromotionReadiness(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["promotionReadiness must be an object"];
  }

  const violations: string[] = [];
  if (!PROMOTION_READINESS_STATUSES.has(value.status as BatchPlanDraft["promotionReadiness"]["status"])) {
    violations.push(`promotionReadiness.status must be ready, needs_placeholders_resolved, or blocked: ${String(value.status)}`);
  }
  if (!hasOnlyNonEmptyStrings(value.reasons, { allowEmpty: false })) {
    violations.push("promotionReadiness.reasons must be a non-empty string array");
  }

  return violations;
}

function validateReport(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["report must be an object"];
  }

  const violations: string[] = [];
  if (!isNonEmptyString(value.summary)) {
    violations.push("report.summary must be a non-empty string");
  }
  violations.push(...validateNoUnresolvedPlaceholderText(value.summary, "report.summary"));
  if (!isNonEmptyString(value.nextAction)) {
    violations.push("report.nextAction must be a non-empty string");
  }
  violations.push(...validateNoUnresolvedPlaceholderText(value.nextAction, "report.nextAction"));

  return violations;
}

function validatePromotionReadinessConsistency(draft: Record<string, unknown>): string[] {
  const violations: string[] = [];
  const readiness = draft.promotionReadiness;

  if (!isRecord(readiness)) {
    return violations;
  }
  if (draft.classification === "routine_writer_batch" && Array.isArray(draft.proposedTasks) && draft.proposedTasks.length === 0) {
    violations.push("routine_writer_batch drafts must include at least one proposed task");
  }
  if (draft.classification !== "routine_writer_batch" && readiness.status === "ready") {
    violations.push("promotionReadiness.status cannot be ready unless classification is routine_writer_batch");
  }
  if (readiness.status === "ready" && hasBlockingPlaceholder(draft.structuredPlaceholders)) {
    violations.push("promotionReadiness.status cannot be ready while structuredPlaceholders contains blocking placeholders");
  }

  return violations;
}

function taskIdSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(
    value
      .filter(isRecord)
      .map((task) => task.id)
      .filter(isNonEmptyString),
  );
}

function hasBlockingPlaceholder(value: unknown): boolean {
  return Array.isArray(value) && value.some((placeholder) => isRecord(placeholder) && placeholder.blocksPromotion === true);
}

function isConcreteRepoFileHint(value: string): boolean {
  const normalized = normalizeRepoFileHint(value);
  const segments = normalized.split("/");
  return (
    normalized.length > 0 &&
    normalized !== "." &&
    !normalized.startsWith("/") &&
    !normalized.endsWith("/") &&
    !REPO_RELATIVE_FORBIDDEN_PATTERN.test(value) &&
    !segments.includes("..") &&
    !GLOB_CHARS_PATTERN.test(normalized)
  );
}

function appendUnique(violations: string[], passes: boolean, violation: string): void {
  if (!passes && !violations.includes(violation)) {
    violations.push(violation);
  }
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
