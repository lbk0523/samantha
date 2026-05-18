import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { authorBatchPlanDraft, type AuthorBatchPlanDraftInput } from "../src/core/batch-plan-authoring";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "authoring-core-task",
    title: "Add BatchPlan authoring core",
    summary: "Create the deterministic natural-language BatchPlanDraft authoring core.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "routine",
    targetFileHints: ["src/core/batch-plan-authoring.ts", "tests/batch-plan-authoring.test.ts"],
    forbiddenChangeHints: ["src/cli.ts", "src/core/batch-plan-draft.ts", "references/task-templates/**"],
    verifyCommandHints: ["bun test tests/batch-plan-authoring.test.ts tests/batch-plan-draft.test.ts"],
    independentlyVerifiableRationale:
      "The authoring core only builds and stores BatchPlanDraft evidence, so focused tests can verify all report paths.",
    ...overrides,
  };
}

function input(overrides: Partial<AuthorBatchPlanDraftInput> = {}): AuthorBatchPlanDraftInput {
  return {
    draftId: "authoring-core-draft",
    createdAt: "2026-05-17T00:00:00.000Z",
    sourceGoal: "Author a Phase 5.5 BatchPlanDraft from a CEO source goal.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-draft.ts",
        "src/core/batch-plan-draft-store.ts",
        "tests/batch-plan-draft-store.test.ts",
      ],
      currentStateSummary: "BatchPlanDraft validation and storage exist; authoring core is missing.",
      candidateWriteSurfaces: ["src/core/batch-plan-authoring.ts", "tests/batch-plan-authoring.test.ts"],
      authorityBoundarySurfaces: ["src/cli.ts", "src/core/policy.ts", "references/task-templates/**"],
      assumptions: ["Authoring writes untrusted planning evidence only and does not prepare or dispatch batches."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    executionBatchesDirHint: join(tmpdir(), "samantha-execution-batches"),
    parallelizationHints: [
      {
        taskIds: ["authoring-core-task"],
        rationale: "Single narrow core slice with deterministic storage verification.",
      },
    ],
    structuredPlaceholders: [],
    ...overrides,
  };
}

async function makeDraftsDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-batch-plan-authoring-"));
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

describe("BatchPlanDraft authoring core", () => {
  test("persists a ready routine writer draft to references/batch-plans", async () => {
    const draftsDir = await makeDraftsDir();
    const result = await authorBatchPlanDraft(input({ draftsDir, draftId: "ready-authoring-draft" }));
    const expectedPath = join(draftsDir, "ready-authoring-draft.json");
    const expectedNextAction =
      "run batch-plans:prepare --draft-id=ready-authoring-draft --execution-batches-dir=" +
      join(tmpdir(), "samantha-execution-batches");

    expect(result).toEqual({
      pass: true,
      written: true,
      draftId: "ready-authoring-draft",
      draftPath: expectedPath,
      sourceGoal: "Author a Phase 5.5 BatchPlanDraft from a CEO source goal.",
      classification: "routine_writer_batch",
      repoInspectionSummary: "BatchPlanDraft validation and storage exist; authoring core is missing.",
      promotionReadiness: {
        status: "ready",
        reasons: ["Routine writer batch has proposed tasks and no blocking structured placeholders."],
      },
      proposedTaskCount: 1,
      blockedPlaceholderCount: 0,
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
      violations: [],
      nextAction: expectedNextAction,
    });

    const stored = JSON.parse(await readFile(expectedPath, "utf8")) as BatchPlanDraft;
    expect(stored.draftId).toBe("ready-authoring-draft");
    expect(stored.report.nextAction).toBe(expectedNextAction);
    expect(stored.autonomyEnvelope.pushAllowed).toBe(false);
  });

  test("stores a structured blocking placeholder without recommending prepare", async () => {
    const draftsDir = await makeDraftsDir();
    const result = await authorBatchPlanDraft(
      input({
        draftsDir,
        draftId: "placeholder-authoring-draft",
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
      }),
    );

    expect(result.pass).toBe(true);
    expect(result.written).toBe(true);
    expect(result.promotionReadiness.status).toBe("needs_placeholders_resolved");
    expect(result.blockedPlaceholderCount).toBe(2);
    expect(result.nextAction).toBe("resolve structured placeholders before batch-plans:prepare");
    expect(result.nextAction).not.toContain("run batch-plans:prepare");
  });

  test("rejects unstructured placeholders through existing BatchPlanDraft validation", async () => {
    const draftsDir = await makeDraftsDir();
    const expectedPath = join(draftsDir, "invalid-text-draft.json");

    const result = await authorBatchPlanDraft(
      input({
        draftsDir,
        draftId: "invalid-text-draft",
        proposedTasks: [
          proposedTask({
            verifyCommandHints: ["TODO choose focused verification"],
          }),
        ],
      }),
    );

    expect(result).toMatchObject({
      pass: false,
      written: false,
      draftId: "invalid-text-draft",
      sourceGoal: "Author a Phase 5.5 BatchPlanDraft from a CEO source goal.",
      repoInspectionSummary: "BatchPlanDraft validation and storage exist; authoring core is missing.",
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
    });
    expect(result.violations).toEqual([
      "invalid BatchPlanDraft invalid-text-draft: proposedTasks[].verifyCommandHints must not contain unresolved placeholder text: authoring-core-task has TODO choose focused verification",
    ]);
    await expect(pathExists(expectedPath)).resolves.toBe(false);
  });

  test("rejects duplicate draftIds without overwriting the existing draft", async () => {
    const draftsDir = await makeDraftsDir();
    await authorBatchPlanDraft(input({ draftsDir, draftId: "duplicate-authoring-draft" }));
    const expectedPath = join(draftsDir, "duplicate-authoring-draft.json");
    const before = await readFile(expectedPath, "utf8");

    const result = await authorBatchPlanDraft(
      input({
        draftsDir,
        draftId: "duplicate-authoring-draft",
        sourceGoal: "Second authoring attempt must not overwrite the first stored draft.",
      }),
    );

    expect(result).toMatchObject({
      pass: false,
      written: false,
      draftId: "duplicate-authoring-draft",
      sourceGoal: "Second authoring attempt must not overwrite the first stored draft.",
      repoInspectionSummary: "BatchPlanDraft validation and storage exist; authoring core is missing.",
      violations: ["batch plan draft already exists: duplicate-authoring-draft"],
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
    });
    await expect(readFile(expectedPath, "utf8")).resolves.toBe(before);
  });

  test("stores non-routine classifications with a route next action", async () => {
    const draftsDir = await makeDraftsDir();
    const result = await authorBatchPlanDraft(
      input({
        draftsDir,
        draftId: "architecture-authoring-draft",
        classification: "architecture",
        proposedTasks: [],
        parallelizationHints: [],
      }),
    );

    expect(result).toMatchObject({
      pass: true,
      written: true,
      draftId: "architecture-authoring-draft",
      sourceGoal: "Author a Phase 5.5 BatchPlanDraft from a CEO source goal.",
      classification: "architecture",
      repoInspectionSummary: "BatchPlanDraft validation and storage exist; authoring core is missing.",
      promotionReadiness: {
        status: "blocked",
        reasons: ["architecture requests must route before routine writer batch promotion."],
      },
      proposedTaskCount: 0,
      blockedPlaceholderCount: 0,
      prepareOutcome: "not_run",
      preflightOutcome: "not_run",
      pushPerformed: false,
      violations: [],
      nextAction: "route to architecture path before routine writer dispatch",
    });

    const stored = JSON.parse(await readFile(join(draftsDir, "architecture-authoring-draft.json"), "utf8")) as BatchPlanDraft;
    expect(stored.promotionReadiness.status).toBe("blocked");
    expect(stored.report.nextAction).toBe("route to architecture path before routine writer dispatch");
  });

  test("never reports a push as performed", async () => {
    const draftsDir = await makeDraftsDir();
    const success = await authorBatchPlanDraft(input({ draftsDir, draftId: "push-false-success" }));
    const failure = await authorBatchPlanDraft(
      input({
        draftsDir,
        draftId: "push-false-failure",
        proposedTasks: [
          proposedTask({
            summary: "maybe this task should be reworked",
          }),
        ],
      }),
    );

    expect(success.pushPerformed).toBe(false);
    expect(failure.pushPerformed).toBe(false);
    expect(failure.pass).toBe(false);
  });
});
