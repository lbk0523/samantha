import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { preflightBatchPlanPromotion, preflightStoredBatchPlanPromotion } from "../src/core/batch-plan-promotion";
import { writeBatchPlanDraft } from "../src/core/batch-plan-draft-store";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "promotion-preflight-task",
    title: "Add BatchPlanDraft promotion preflight",
    summary: "Create a deterministic preflight wrapper for BatchPlanDraft promotion readiness.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetFileHints: ["src/core/batch-plan-promotion.ts", "tests/batch-plan-promotion.test.ts"],
    forbiddenChangeHints: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
    verifyCommandHints: ["bun test tests/batch-plan-promotion.test.ts tests/batch-plan-draft-store.test.ts"],
    independentlyVerifiableRationale:
      "The preflight result is pure metadata and can be checked with focused unit tests.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "batch-plan-promotion-preflight",
    createdAt: "2026-05-16T00:00:00.000Z",
    sourceGoal: "Implement a deterministic BatchPlanDraft promotion preflight.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-draft.ts",
        "src/core/batch-plan-draft-store.ts",
        "tests/batch-plan-draft.test.ts",
      ],
      currentStateSummary: "BatchPlanDraft validation and storage exist; this slice adds preflight only.",
      candidateWriteSurfaces: ["src/core/batch-plan-promotion.ts", "tests/batch-plan-promotion.test.ts"],
      authorityBoundarySurfaces: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
      assumptions: ["Promotion preflight reports readiness but does not assemble or write TaskSpec or BatchSpec artifacts."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["promotion-preflight-task"],
        rationale: "Single deterministic preflight slice with no artifact creation authority.",
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
      reasons: ["No blocking placeholders remain for this promotion preflight slice."],
    },
    report: {
      summary: "BatchPlanDraft promotion readiness can be inspected before deterministic assembly.",
      nextAction: "Run deterministic assembly only after preflight allows promotion.",
    },
    ...overrides,
  };
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-batch-plan-promotion-"));
  tmpRoots.push(root);
  return root;
}

async function makeDraftsDir(): Promise<string> {
  return join(await makeTempRoot(), "references", "batch-plans");
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

describe("BatchPlanDraft promotion preflight", () => {
  test("preflights a stored ready routine draft with promotion metadata and path", async () => {
    const draftsDir = await makeDraftsDir();
    const readyDraft = draft({ draftId: "ready-promotion-draft" });
    const expectedPath = join(draftsDir, "ready-promotion-draft.json");
    await writeBatchPlanDraft({ draftsDir, draft: readyDraft });

    await expect(preflightStoredBatchPlanPromotion({ draftsDir, draftId: "ready-promotion-draft" })).resolves.toEqual({
      mayPromote: true,
      violations: [],
      draftId: "ready-promotion-draft",
      draftPath: expectedPath,
      classification: "routine_writer_batch",
      promotionReadinessStatus: "ready",
      proposedTaskCount: 1,
      blockedPlaceholderCount: 0,
      nextAction: "run deterministic assembly next",
    });
  });

  test("preflights a valid non-routine stored draft with a route next action", async () => {
    const draftsDir = await makeDraftsDir();
    const architectureDraft = draft({
      draftId: "architecture-route-draft",
      classification: "architecture",
      proposedTasks: [],
      parallelizationHints: [],
      promotionReadiness: {
        status: "blocked",
        reasons: ["Architecture planning must be resolved before routine writer dispatch."],
      },
    });
    await writeBatchPlanDraft({ draftsDir, draft: architectureDraft });

    const result = await preflightStoredBatchPlanPromotion({ draftsDir, draftId: "architecture-route-draft" });

    expect(result).toMatchObject({
      mayPromote: false,
      draftId: "architecture-route-draft",
      classification: "architecture",
      promotionReadinessStatus: "blocked",
      proposedTaskCount: 0,
      blockedPlaceholderCount: 0,
      nextAction: "route to architecture path before routine writer dispatch",
    });
    expect(result.violations).toEqual([
      "classification must be routine_writer_batch to promote",
      "promotionReadiness.status must be ready to promote",
    ]);
  });

  test("preflights a valid incomplete stored draft with a structured placeholder next action", async () => {
    const draftsDir = await makeDraftsDir();
    const incompleteDraft = draft({
      draftId: "placeholder-route-draft",
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
    await writeBatchPlanDraft({ draftsDir, draft: incompleteDraft });

    const result = await preflightStoredBatchPlanPromotion({ draftsDir, draftId: "placeholder-route-draft" });

    expect(result).toMatchObject({
      mayPromote: false,
      draftId: "placeholder-route-draft",
      classification: "routine_writer_batch",
      promotionReadinessStatus: "needs_placeholders_resolved",
      proposedTaskCount: 1,
      blockedPlaceholderCount: 2,
      nextAction: "resolve structured placeholders before promotion",
    });
    expect(result.violations).toEqual([
      "promotionReadiness.status must be ready to promote",
      "structuredPlaceholders must not contain blocking placeholders to promote",
    ]);
  });

  test("preflights authority-boundary target drafts as not promotable", () => {
    const authorityDraft = draft({
      proposedTasks: [
        proposedTask({
          targetFileHints: ["src/core/policy.ts"],
        }),
      ],
    });

    expect(preflightBatchPlanPromotion(authorityDraft)).toEqual({
      mayPromote: false,
      violations: [
        "proposedTasks[].targetFileHints must not include authority-boundary surfaces to promote: promotion-preflight-task has src/core/policy.ts",
      ],
      draftId: "batch-plan-promotion-preflight",
      classification: "routine_writer_batch",
      promotionReadinessStatus: "ready",
      proposedTaskCount: 1,
      blockedPlaceholderCount: 0,
      nextAction: "rework the BatchPlanDraft before promotion",
    });
  });

  test("preflights invalid direct drafts with validation violations in the result", () => {
    const invalidDraft = draft({
      sourceGoal: "",
    });

    expect(preflightBatchPlanPromotion(invalidDraft)).toEqual({
      mayPromote: false,
      violations: ["sourceGoal must be a non-empty string"],
      draftId: "batch-plan-promotion-preflight",
      classification: "routine_writer_batch",
      promotionReadinessStatus: "ready",
      proposedTaskCount: 1,
      blockedPlaceholderCount: 0,
      nextAction: "rework the BatchPlanDraft before promotion",
    });
  });

  test("surfaces stored draft validation errors from the store", async () => {
    const draftsDir = await makeDraftsDir();
    const invalidDraft = draft({
      draftId: "invalid-stored-promotion-draft",
      sourceGoal: "",
    });
    const invalidPath = join(draftsDir, "invalid-stored-promotion-draft.json");
    await mkdir(draftsDir, { recursive: true });
    await writeFile(invalidPath, `${JSON.stringify(invalidDraft, null, 2)}\n`);

    await expect(
      preflightStoredBatchPlanPromotion({ draftsDir, draftId: "invalid-stored-promotion-draft" }),
    ).rejects.toThrow(`invalid stored BatchPlanDraft at ${invalidPath}: sourceGoal must be a non-empty string`);
  });

  test("does not write TaskSpec or BatchSpec artifacts during preflight", async () => {
    const root = await makeTempRoot();
    const draftsDir = join(root, "references", "batch-plans");
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "no-artifact-writes-draft" }) });

    await preflightStoredBatchPlanPromotion({ draftsDir, draftId: "no-artifact-writes-draft" });

    await expect(pathExists(join(root, "references", "tasks"))).resolves.toBe(false);
    await expect(pathExists(join(root, "references", "batch-specs"))).resolves.toBe(false);
  });
});
