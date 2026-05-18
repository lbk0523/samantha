export const DRIFT_REVIEW_OUTCOMES = ["no_drift", "possible_drift", "confirmed_drift", "blocked"] as const;
export type DriftReviewOutcome = (typeof DRIFT_REVIEW_OUTCOMES)[number];

export const DRIFT_REVIEW_CATEGORIES = [
  "scope",
  "authority",
  "lifecycle",
  "evidence",
  "verification",
  "product_boundary",
  "none",
] as const;
export type DriftReviewCategory = (typeof DRIFT_REVIEW_CATEGORIES)[number];

export interface DriftReviewEvidenceItem {
  citation: string;
  finding: string;
}

export interface DriftReviewNextAction {
  action: string;
}

export interface DriftReviewReport {
  schemaVersion: 1;
  outcome: DriftReviewOutcome;
  driftCategory: DriftReviewCategory;
  citedEvidence: DriftReviewEvidenceItem[];
  nextAction: DriftReviewNextAction;
}

export interface DriftReviewSummary {
  schemaVersion: 1;
  status: "accepted" | "rejected";
  reviewerAuthority: "advice-only";
  trustedStateChanges: false;
  outcome: DriftReviewOutcome | null;
  driftCategory: DriftReviewCategory | null;
  citedEvidenceCount: number;
  nextAction: DriftReviewNextAction | null;
  violations: string[];
}

const DRIFT_REVIEW_OUTCOME_SET = new Set<DriftReviewOutcome>(DRIFT_REVIEW_OUTCOMES);
const DRIFT_REVIEW_CATEGORY_SET = new Set<DriftReviewCategory>(DRIFT_REVIEW_CATEGORIES);

const FORBIDDEN_NEXT_ACTION_PATTERNS: RegExp[] = [
  /\baccept(?:s|ed|ing)?\s+(?:the\s+|this\s+|a\s+)?runs?\b/i,
  /\breject(?:s|ed|ing)?\s+(?:the\s+|this\s+|a\s+)?runs?\b/i,
  /\bsupersede(?:s|d|ing)?\s+(?:the\s+|this\s+|a\s+)?tasks?\b/i,
  /\bmerge(?:s|d|ing)?\b/i,
  /\bclean\s+up\b/i,
  /\bcleanup\b/i,
  /\bcommit(?:s|ted|ting)?\b/i,
  /\bpush(?:es|ed|ing)?\b/i,
  /\bmutate(?:s|d|ing)?\s+lifecycle\b/i,
  /\blifecycle\s+(?:transition|transitions|mutation|mutations|state\s+change|state\s+changes|update|updates)\b/i,
  /\bcreate(?:s|d|ing)?\s+(?:a\s+|the\s+|follow-up\s+)?tasks?\b/i,
  /\bupdate(?:s|d|ing)?\s+policy\b/i,
];

export function validateDriftReviewReport(input: unknown): string[] {
  if (!isRecord(input)) {
    return ["drift review report must be an object"];
  }

  const violations: string[] = [];

  if (input.schemaVersion !== 1) {
    violations.push("schemaVersion must be exactly 1");
  }
  if (!isDriftReviewOutcome(input.outcome)) {
    violations.push(
      `outcome must be ${joinOptions(DRIFT_REVIEW_OUTCOMES)}: ${String(input.outcome)}`,
    );
  }
  if (!isDriftReviewCategory(input.driftCategory)) {
    violations.push(
      `driftCategory must be ${joinOptions(DRIFT_REVIEW_CATEGORIES)}: ${String(input.driftCategory)}`,
    );
  }
  if (input.outcome === "no_drift" && input.driftCategory !== "none") {
    violations.push("driftCategory must be none when outcome is no_drift");
  }
  if (isDriftReviewOutcome(input.outcome) && input.outcome !== "no_drift" && input.driftCategory === "none") {
    violations.push("driftCategory must not be none unless outcome is no_drift");
  }

  violations.push(...validateCitedEvidence(input.citedEvidence));

  if (hasOwn(input, "nextActions")) {
    violations.push("nextActions must be absent; use exactly one nextAction");
  }
  violations.push(...validateNextAction(input.nextAction));

  return violations;
}

export function summarizeDriftReviewReport(input: unknown): DriftReviewSummary {
  const violations = validateDriftReviewReport(input);
  const report = isRecord(input) ? input : {};

  return {
    schemaVersion: 1,
    status: violations.length === 0 ? "accepted" : "rejected",
    reviewerAuthority: "advice-only",
    trustedStateChanges: false,
    outcome: isDriftReviewOutcome(report.outcome) && violations.length === 0 ? report.outcome : null,
    driftCategory: isDriftReviewCategory(report.driftCategory) && violations.length === 0 ? report.driftCategory : null,
    citedEvidenceCount: Array.isArray(report.citedEvidence) ? report.citedEvidence.length : 0,
    nextAction: readNextAction(report.nextAction),
    violations,
  };
}

function validateCitedEvidence(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ["citedEvidence must be a non-empty array"];
  }

  const violations: string[] = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`citedEvidence[${index}] must be an object`);
      return;
    }
    if (!isNonEmptyString(item.citation)) {
      violations.push(`citedEvidence[${index}].citation must be a non-empty string`);
    }
    if (!isNonEmptyString(item.finding)) {
      violations.push(`citedEvidence[${index}].finding must be a non-empty string`);
    }
  });

  return violations;
}

function validateNextAction(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["nextAction must be an object"];
  }

  const action = value.action;
  if (!isNonEmptyString(action)) {
    return ["nextAction.action must be a non-empty string"];
  }

  return FORBIDDEN_NEXT_ACTION_PATTERNS.some((pattern) => pattern.test(action))
    ? [`nextAction.action must remain advice-only and must not authorize lifecycle action: ${action}`]
    : [];
}

function readNextAction(value: unknown): DriftReviewNextAction | null {
  if (!isRecord(value)) {
    return null;
  }

  const action = value.action;
  if (!isNonEmptyString(action)) {
    return null;
  }

  return {
    action,
  };
}

function isDriftReviewOutcome(value: unknown): value is DriftReviewOutcome {
  return typeof value === "string" && DRIFT_REVIEW_OUTCOME_SET.has(value as DriftReviewOutcome);
}

function isDriftReviewCategory(value: unknown): value is DriftReviewCategory {
  return typeof value === "string" && DRIFT_REVIEW_CATEGORY_SET.has(value as DriftReviewCategory);
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

function joinOptions(values: readonly string[]): string {
  return values.join(", ").replace(/, ([^,]*)$/, ", or $1");
}
