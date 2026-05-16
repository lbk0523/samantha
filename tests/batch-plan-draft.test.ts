import { describe, expect, test } from "bun:test";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { canPromoteBatchPlanDraft, validateBatchPlanDraft } from "../src/core/batch-plan-draft";

function proposedTask(overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {}): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "draft-validator-contract",
    title: "Add BatchPlanDraft validator",
    summary: "Create the pure BatchPlanDraft contract and focused validator tests.",
    targetFileHints: ["src/core/batch-plan-draft.ts", "tests/batch-plan-draft.test.ts"],
    forbiddenChangeHints: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**", "worktrees/**"],
    verifyCommandHints: ["bun test tests/batch-plan-draft.test.ts", "bun run typecheck", "bun test"],
    independentlyVerifiableRationale:
      "The contract and validator can be checked with focused tests before broader typecheck and test gates.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "batch-plan-draft-validator",
    createdAt: "2026-05-16T00:00:00.000Z",
    sourceGoal: "Implement BatchPlanDraft JSON contract and deterministic validator.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "references/batch-specs/phase-5-5-ceo-batch-planning.md",
        "src/core/batch-spec.ts",
        "tests/batch-spec.test.ts",
      ],
      currentStateSummary: "Focused contract work in an allocated Samantha worker worktree.",
      candidateWriteSurfaces: ["src/core/batch-plan-draft.ts", "tests/batch-plan-draft.test.ts"],
      authorityBoundarySurfaces: ["src/core/batch-spec.ts", "src/cli.ts", "references/**", "runs/**"],
      assumptions: ["Promotion, dispatch, git, and lifecycle behavior stay outside this validator."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["draft-validator-contract"],
        rationale: "Single small contract slice with focused deterministic validation.",
      },
    ],
    structuredPlaceholders: [],
    autonomyEnvelope: {
      localCommitAllowed: true,
      pushAllowed: false,
      maxReworkCycles: 1,
    },
    promotionReadiness: {
      status: "ready",
      reasons: ["No blocking placeholders remain and the routine writer slice is narrow."],
    },
    report: {
      summary: "BatchPlanDraft validator can be promoted after deterministic assembly checks.",
      nextAction: "Promote only through the later deterministic assembly path.",
    },
    ...overrides,
  };
}

describe("BatchPlanDraft validation", () => {
  test("accepts a valid routine writer draft and allows promotion", () => {
    const validDraft = draft();

    expect(validateBatchPlanDraft(validDraft)).toEqual([]);
    expect(canPromoteBatchPlanDraft(validDraft)).toEqual({ mayPromote: true, violations: [] });
  });

  test("validates a non-routine draft shape but does not allow promotion", () => {
    const reportOnlyDraft = draft({
      classification: "report_only",
      proposedTasks: [],
      parallelizationHints: [],
      promotionReadiness: {
        status: "blocked",
        reasons: ["Report-only planning cannot promote to routine writer dispatch."],
      },
    });

    expect(validateBatchPlanDraft(reportOnlyDraft)).toEqual([]);
    expect(canPromoteBatchPlanDraft(reportOnlyDraft)).toEqual({
      mayPromote: false,
      violations: [
        "classification must be routine_writer_batch to promote",
        "promotionReadiness.status must be ready to promote",
      ],
    });
  });

  test("rejects drafts without the first-class structuredPlaceholders array", () => {
    const missingPlaceholders = draft() as unknown as Record<string, unknown>;
    delete missingPlaceholders.structuredPlaceholders;

    expect(validateBatchPlanDraft(missingPlaceholders as unknown as BatchPlanDraft)).toContain(
      "structuredPlaceholders must be an array",
    );
  });

  test("rejects ready drafts with blocking structured placeholders", () => {
    const blockedByPlaceholder = draft({
      structuredPlaceholders: [
        {
          field: "proposedTasks[0].verifyCommandHints",
          reason: "BK must choose the final focused verification command.",
          resolutionOwner: "bk",
          blocksPromotion: true,
        },
      ],
    });

    expect(validateBatchPlanDraft(blockedByPlaceholder)).toContain(
      "promotionReadiness.status cannot be ready while structuredPlaceholders contains blocking placeholders",
    );
    expect(canPromoteBatchPlanDraft(blockedByPlaceholder).violations).toContain(
      "structuredPlaceholders must not contain blocking placeholders to promote",
    );
  });

  test("rejects push authority in the autonomy envelope", () => {
    expect(
      validateBatchPlanDraft(
        draft({
          autonomyEnvelope: {
            localCommitAllowed: true,
            pushAllowed: true as false,
            maxReworkCycles: 1,
          },
        }),
      ),
    ).toContain("autonomyEnvelope.pushAllowed must be false");
  });

  test("rejects autonomy envelopes that change maxReworkCycles", () => {
    expect(
      validateBatchPlanDraft(
        draft({
          autonomyEnvelope: {
            localCommitAllowed: true,
            pushAllowed: false,
            maxReworkCycles: 2 as 1,
          },
        }),
      ),
    ).toContain("autonomyEnvelope.maxReworkCycles must be 1");
  });

  test("rejects routine writer drafts without proposed tasks", () => {
    expect(
      validateBatchPlanDraft(
        draft({
          proposedTasks: [],
          parallelizationHints: [],
        }),
      ),
    ).toContain("routine_writer_batch drafts must include at least one proposed task");
  });

  test("rejects malformed repo inspection evidence", () => {
    const violations = validateBatchPlanDraft(
      draft({
        repoInspection: {
          inspectedPaths: [],
          currentStateSummary: " ",
          candidateWriteSurfaces: ["src/core/batch-plan-draft.ts"],
          authorityBoundarySurfaces: ["src/core/batch-spec.ts"],
          assumptions: ["No promotion behavior is implemented here."],
        },
      }),
    );

    expect(violations).toContain("repoInspection.inspectedPaths must be a non-empty string array");
    expect(violations).toContain("repoInspection.currentStateSummary must be a non-empty string");
  });

  test("rejects broad or empty proposed task fields", () => {
    const violations = validateBatchPlanDraft(
      draft({
        proposedTasks: [
          proposedTask({
            title: "",
            targetFileHints: ["src/**"],
            verifyCommandHints: [],
            independentlyVerifiableRationale: "",
          }),
        ],
      }),
    );

    expect(violations).toContain("proposedTasks[].title must be a non-empty string: draft-validator-contract");
    expect(violations).toContain(
      "proposedTasks[].targetFileHints must be concrete repo-relative file hints: draft-validator-contract has src/**",
    );
    expect(violations).toContain(
      "proposedTasks[].verifyCommandHints must be a non-empty string array: draft-validator-contract",
    );
    expect(violations).toContain(
      "proposedTasks[].independentlyVerifiableRationale must be a non-empty string: draft-validator-contract",
    );
  });
});
