import { describe, expect, test } from "bun:test";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { canPromoteBatchPlanDraft, validateBatchPlanDraft } from "../src/core/batch-plan-draft";

function proposedTask(overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {}): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "draft-validator-contract",
    title: "Add BatchPlanDraft validator",
    summary: "Create the pure BatchPlanDraft contract and focused validator tests.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "routine",
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

  test("rejects missing or unknown worker assignment metadata on proposed tasks", () => {
    const missingMetadata = proposedTask() as unknown as Record<string, unknown>;
    delete missingMetadata.taskFamily;
    delete missingMetadata.workMode;
    delete missingMetadata.riskClass;

    const missingViolations = validateBatchPlanDraft(
      draft({
        proposedTasks: [missingMetadata as unknown as BatchPlanDraft["proposedTasks"][number]],
      }),
    );
    const unknownViolations = validateBatchPlanDraft(
      draft({
        proposedTasks: [
          proposedTask({
            taskFamily: "persona" as BatchPlanDraft["proposedTasks"][number]["taskFamily"],
            workMode: "roleplay" as BatchPlanDraft["proposedTasks"][number]["workMode"],
            riskClass: "admin" as BatchPlanDraft["proposedTasks"][number]["riskClass"],
          }),
        ],
      }),
    );

    expect(missingViolations).toContain(
      "proposedTasks[].taskFamily must be one of cli-command, core-module, docs-only, report-review, recovery: draft-validator-contract has (empty)",
    );
    expect(missingViolations).toContain(
      "proposedTasks[].workMode must be one of minimal-change, tdd-first, diagnosis-first: draft-validator-contract has (empty)",
    );
    expect(missingViolations).toContain(
      "proposedTasks[].riskClass must be one of routine, authority-sensitive, doctrine-sensitive, lifecycle-sensitive: draft-validator-contract has (empty)",
    );
    expect(unknownViolations).toContain(
      "proposedTasks[].taskFamily must be one of cli-command, core-module, docs-only, report-review, recovery: draft-validator-contract has persona",
    );
    expect(unknownViolations).toContain(
      "proposedTasks[].workMode must be one of minimal-change, tdd-first, diagnosis-first: draft-validator-contract has roleplay",
    );
    expect(unknownViolations).toContain(
      "proposedTasks[].riskClass must be one of routine, authority-sensitive, doctrine-sensitive, lifecycle-sensitive: draft-validator-contract has admin",
    );
  });

  test("blocks promotion when target hints point at policy authority surfaces", () => {
    const policyDraft = draft({
      proposedTasks: [
        proposedTask({
          targetFileHints: ["src/core/policy.ts"],
        }),
      ],
    });

    expect(validateBatchPlanDraft(policyDraft)).toEqual([]);
    expect(canPromoteBatchPlanDraft(policyDraft)).toEqual({
      mayPromote: false,
      violations: [
        "proposedTasks[].targetFileHints must not include authority-boundary surfaces to promote: draft-validator-contract has src/core/policy.ts",
      ],
    });
  });

  test("blocks promotion when target hints point under glob authority surfaces", () => {
    const agentProfileDraft = draft({
      proposedTasks: [
        proposedTask({
          targetFileHints: ["references/agent-profiles/writer.md"],
        }),
      ],
    });

    expect(validateBatchPlanDraft(agentProfileDraft)).toEqual([]);
    expect(canPromoteBatchPlanDraft(agentProfileDraft).violations).toContain(
      "proposedTasks[].targetFileHints must not include authority-boundary surfaces to promote: draft-validator-contract has references/agent-profiles/writer.md",
    );
  });

  test("rejects unstructured TODO text in verify command hints", () => {
    expect(
      validateBatchPlanDraft(
        draft({
          proposedTasks: [
            proposedTask({
              verifyCommandHints: ["TODO choose focused verification"],
            }),
          ],
        }),
      ),
    ).toContain(
      "proposedTasks[].verifyCommandHints must not contain unresolved placeholder text: draft-validator-contract has TODO choose focused verification",
    );
  });

  test("rejects unresolved angle-bracket placeholders in report fields", () => {
    expect(
      validateBatchPlanDraft(
        draft({
          report: {
            summary: "BatchPlanDraft validator can be promoted after deterministic assembly checks.",
            nextAction: "Promote after <owner confirms scope>.",
          },
        }),
      ),
    ).toContain("report.nextAction must not contain unresolved placeholder text: Promote after <owner confirms scope>.");
  });

  test("allows incomplete target and verify hints for blocked placeholder storage", () => {
    const incompleteDraft = draft({
      proposedTasks: [
        proposedTask({
          targetFileHints: [],
          verifyCommandHints: [],
        }),
      ],
      structuredPlaceholders: [
        {
          field: "proposedTasks[0].targetFileHints",
          reason: "CEO must resolve the intended write scope before promotion.",
          resolutionOwner: "ceo",
          blocksPromotion: true,
        },
        {
          field: "proposedTasks[0].verifyCommandHints",
          reason: "Deterministic assembly must resolve the exact verification commands.",
          resolutionOwner: "deterministic_assembly",
          blocksPromotion: true,
        },
      ],
      promotionReadiness: {
        status: "needs_placeholders_resolved",
        reasons: ["Target and verify hints are blocked by structured placeholders."],
      },
    });

    expect(validateBatchPlanDraft(incompleteDraft)).toEqual([]);
    expect(canPromoteBatchPlanDraft(incompleteDraft)).toEqual({
      mayPromote: false,
      violations: [
        "promotionReadiness.status must be ready to promote",
        "structuredPlaceholders must not contain blocking placeholders to promote",
      ],
    });
  });

  test("still rejects ready routine drafts with missing target and verify hints", () => {
    const missingHintsTask = proposedTask() as unknown as Record<string, unknown>;
    delete missingHintsTask.targetFileHints;
    delete missingHintsTask.verifyCommandHints;

    const violations = validateBatchPlanDraft(
      draft({
        proposedTasks: [missingHintsTask as unknown as BatchPlanDraft["proposedTasks"][number]],
      }),
    );

    expect(violations).toContain(
      "proposedTasks[].targetFileHints must be a non-empty string array: draft-validator-contract",
    );
    expect(violations).toContain(
      "proposedTasks[].verifyCommandHints must be a non-empty string array: draft-validator-contract",
    );
  });
});
