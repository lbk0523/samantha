import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { writeBatchPlanDraft } from "../src/core/batch-plan-draft-store";
import { reviewStoredBatchPlanDraft } from "../src/core/batch-plan-review";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "batch-plan-review-command",
    title: "Add BatchPlan review command",
    summary: "Add a report-only BatchPlanDraft review command before deterministic preparation.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetFileHints: ["src/core/batch-plan-review.ts", "tests/batch-plan-review.test.ts"],
    forbiddenChangeHints: ["src/core/batch-plan-operator.ts", "runs/**", "worktrees/**"],
    verifyCommandHints: ["bun test tests/batch-plan-review.test.ts"],
    independentlyVerifiableRationale:
      "Focused tests verify review eligibility without preparing, dispatching, or writing execution artifacts.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "batch-plan-review",
    createdAt: "2026-05-17T00:00:00.000Z",
    sourceGoal: "Review stored BatchPlanDrafts before preparation.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-promotion.ts",
        "src/core/batch-plan-draft-store.ts",
        "src/cli.ts",
      ],
      currentStateSummary: "Promotion preflight and draft store exist; review needs a thin report-only wrapper.",
      candidateWriteSurfaces: ["src/core/batch-plan-review.ts", "tests/batch-plan-review.test.ts"],
      authorityBoundarySurfaces: ["src/core/batch-plan-operator.ts", "src/core/batch-execution.ts"],
      assumptions: ["Review is not trusted dispatch evidence and does not replace BatchPlan prepare gates."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["batch-plan-review-command"],
        rationale: "Single report-only review slice with no execution artifact authority.",
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
      reasons: ["The draft is ready for routine writer batch preparation."],
    },
    report: {
      summary: "BatchPlanDraft review can report whether prepare is a reasonable next command.",
      nextAction: "Run batch-plans:prepare only after deterministic review and storage checks.",
    },
    ...overrides,
  };
}

async function makeDraftsDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-batch-plan-review-"));
  tmpRoots.push(root);
  return join(root, "references", "batch-plans");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("BatchPlanDraft review", () => {
  test("reports a ready routine writer draft as prepare-eligible but not trusted for dispatch", async () => {
    const draftsDir = await makeDraftsDir();
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "ready-review-draft" }) });

    const result = await reviewStoredBatchPlanDraft({ draftsDir, draftId: "ready-review-draft" });

    expect(result).toMatchObject({
      reviewed: true,
      draftId: "ready-review-draft",
      draftPath: join(draftsDir, "ready-review-draft.json"),
      classification: "routine_writer_batch",
      promotionReadiness: { status: "ready" },
      prepareEligible: true,
      trustedForDispatch: false,
      pushPerformed: false,
      violations: [],
    });
    expect(result.findings).toContain("review is prepare-eligible but not trusted for dispatch");
    expect(result.nextAction).toContain("batch-plans:prepare");
    expect(result.nextAction).toContain("prepare remains the deterministic gate");
  });

  test("routes a non-routine draft instead of marking it prepare-eligible", async () => {
    const draftsDir = await makeDraftsDir();
    await writeBatchPlanDraft({
      draftsDir,
      draft: draft({
        draftId: "architecture-review-draft",
        classification: "architecture",
        proposedTasks: [],
        parallelizationHints: [],
        promotionReadiness: {
          status: "blocked",
          reasons: ["Architecture work must stay in CEO planning mode."],
        },
      }),
    });

    const result = await reviewStoredBatchPlanDraft({ draftsDir, draftId: "architecture-review-draft" });

    expect(result.prepareEligible).toBe(false);
    expect(result.classification).toBe("architecture");
    expect(result.nextAction).toBe("route to architecture path before routine writer dispatch");
    expect(result.violations).toContain("classification must be routine_writer_batch to promote");
  });

  test("requires rework for a blocking structured placeholder", async () => {
    const draftsDir = await makeDraftsDir();
    await writeBatchPlanDraft({
      draftsDir,
      draft: draft({
        draftId: "placeholder-review-draft",
        proposedTasks: [
          proposedTask({
            targetFileHints: [],
          }),
        ],
        structuredPlaceholders: [
          {
            field: "proposedTasks[0].targetFileHints",
            reason: "CEO must resolve the target file hints before preparation.",
            resolutionOwner: "ceo",
            blocksPromotion: true,
          },
        ],
        promotionReadiness: {
          status: "needs_placeholders_resolved",
          reasons: ["Target file hints are blocked by structured placeholders."],
        },
      }),
    });

    const result = await reviewStoredBatchPlanDraft({ draftsDir, draftId: "placeholder-review-draft" });

    expect(result.prepareEligible).toBe(false);
    expect(result.nextAction).toBe("rework the BatchPlanDraft before batch-plans:prepare");
    expect(result.findings).toContain("blockedPlaceholderCount: 1");
    expect(result.violations).toContain("structuredPlaceholders must not contain blocking placeholders to promote");
  });

  test("blocks authority-boundary target hints before prepare", async () => {
    const draftsDir = await makeDraftsDir();
    await writeBatchPlanDraft({
      draftsDir,
      draft: draft({
        draftId: "authority-review-draft",
        proposedTasks: [
          proposedTask({
            targetFileHints: ["src/core/policy.ts"],
          }),
        ],
      }),
    });

    const result = await reviewStoredBatchPlanDraft({ draftsDir, draftId: "authority-review-draft" });

    expect(result.prepareEligible).toBe(false);
    expect(result.nextAction).toBe("rework the BatchPlanDraft before batch-plans:prepare");
    expect(result.violations).toEqual([
      "proposedTasks[].targetFileHints must not include authority-boundary surfaces to promote: batch-plan-review-command has src/core/policy.ts",
    ]);
  });

  test("does not write TaskSpec, execution BatchSpec, run, or worktree artifacts", async () => {
    const draftsDir = await makeDraftsDir();
    const root = join(draftsDir, "..", "..");
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "read-only-review-draft" }) });

    await reviewStoredBatchPlanDraft({ draftsDir, draftId: "read-only-review-draft" });

    await expect(pathExists(join(root, "references", "tasks"))).resolves.toBe(false);
    await expect(pathExists(join(root, "references", "batch-specs"))).resolves.toBe(false);
    await expect(pathExists(join(root, "runs"))).resolves.toBe(false);
    await expect(pathExists(join(root, "worktrees"))).resolves.toBe(false);
  });
});
