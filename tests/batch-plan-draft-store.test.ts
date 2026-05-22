import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import {
  listBatchPlanDrafts,
  readBatchPlanDraftById,
  readBatchPlanDraftRecordById,
  writeBatchPlanDraft,
} from "../src/core/batch-plan-draft-store";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "draft-store-task",
    title: "Add BatchPlanDraft store",
    summary: "Create the deterministic BatchPlanDraft artifact store and focused tests.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "lifecycle-sensitive",
    targetFileHints: ["src/core/batch-plan-draft-store.ts", "tests/batch-plan-draft-store.test.ts"],
    forbiddenChangeHints: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
    verifyCommandHints: ["bun test tests/batch-plan-draft-store.test.ts tests/batch-plan-draft.test.ts"],
    independentlyVerifiableRationale:
      "The artifact store can be checked with round-trip and deterministic failure tests.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "batch-plan-draft-store",
    createdAt: "2026-05-16T00:00:00.000Z",
    sourceGoal: "Implement a deterministic BatchPlanDraft artifact store.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-draft.ts",
        "src/core/batch-spec-store.ts",
        "tests/batch-plan-draft.test.ts",
      ],
      currentStateSummary: "BatchPlanDraft validation exists; this slice adds artifact storage only.",
      candidateWriteSurfaces: ["src/core/batch-plan-draft-store.ts", "tests/batch-plan-draft-store.test.ts"],
      authorityBoundarySurfaces: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
      assumptions: ["Promotion, dispatch, git, and lifecycle behavior remain outside this store."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["draft-store-task"],
        rationale: "Single artifact-store slice with deterministic validation and file I/O behavior.",
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
      reasons: ["No blocking placeholders remain for this narrow store slice."],
    },
    report: {
      summary: "BatchPlanDraft artifacts can be stored and listed after validation.",
      nextAction: "Use a later explicit promotion path to generate executable batch specs.",
    },
    ...overrides,
  };
}

async function makeDraftsDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-batch-plan-drafts-"));
  tmpRoots.push(root);
  return join(root, "references", "batch-plans");
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("BatchPlanDraft store", () => {
  test("writes and reads a valid ready draft round trip", async () => {
    const draftsDir = await makeDraftsDir();
    const readyDraft = draft({ draftId: "ready-draft" });
    const expectedPath = join(draftsDir, "ready-draft.json");

    await expect(writeBatchPlanDraft({ draftsDir, draft: readyDraft })).resolves.toEqual({
      path: expectedPath,
      draft: readyDraft,
    });

    await expect(readFile(expectedPath, "utf8")).resolves.toBe(`${JSON.stringify(readyDraft, null, 2)}\n`);
    await expect(readBatchPlanDraftById({ draftsDir, draftId: "ready-draft" })).resolves.toEqual(readyDraft);
    await expect(readBatchPlanDraftRecordById({ draftsDir, draftId: "ready-draft" })).resolves.toEqual({
      path: expectedPath,
      draft: readyDraft,
    });
  });

  test("stores and lists incomplete drafts with blocking structured placeholders", async () => {
    const draftsDir = await makeDraftsDir();
    const incompleteDraft = draft({
      draftId: "incomplete-draft",
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

    await expect(readBatchPlanDraftById({ draftsDir, draftId: "incomplete-draft" })).resolves.toEqual(
      incompleteDraft,
    );
    await expect(listBatchPlanDrafts({ draftsDir })).resolves.toEqual([
      {
        draftId: "incomplete-draft",
        path: join(draftsDir, "incomplete-draft.json"),
        classification: "routine_writer_batch",
        promotionReadiness: {
          status: "needs_placeholders_resolved",
        },
        proposedTaskCount: 1,
        blockedPlaceholderCount: 2,
      },
    ]);
  });

  test("rejects unstructured placeholder text on write through validator reuse", async () => {
    const draftsDir = await makeDraftsDir();
    const placeholderDraft = draft({
      draftId: "unstructured-placeholder",
      proposedTasks: [
        proposedTask({
          verifyCommandHints: ["TODO choose focused verification"],
        }),
      ],
    });

    await expect(writeBatchPlanDraft({ draftsDir, draft: placeholderDraft })).rejects.toThrow(
      "invalid BatchPlanDraft unstructured-placeholder: proposedTasks[].verifyCommandHints must not contain unresolved placeholder text: draft-store-task has TODO choose focused verification",
    );
  });

  test("rejects duplicate draftIds in two JSON files while ignoring non-json files", async () => {
    const draftsDir = await makeDraftsDir();
    await mkdir(draftsDir, { recursive: true });
    await writeFile(join(draftsDir, "one.json"), `${JSON.stringify(draft({ draftId: "duplicate-draft" }), null, 2)}\n`);
    await writeFile(join(draftsDir, "two.json"), `${JSON.stringify(draft({ draftId: "duplicate-draft" }), null, 2)}\n`);
    await writeFile(join(draftsDir, "ignored.txt"), "not json\n");

    await expect(listBatchPlanDrafts({ draftsDir })).rejects.toThrow(
      `duplicate draftId in BatchPlanDraft store: duplicate-draft: ${join(draftsDir, "one.json")}, ${join(
        draftsDir,
        "two.json",
      )}`,
    );
  });

  test("ignores non-json files and sorts summaries by draftId then path", async () => {
    const draftsDir = await makeDraftsDir();
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "z-draft" }) });
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "a-draft" }) });
    await writeFile(join(draftsDir, "notes.txt"), "ignored\n");

    await expect(listBatchPlanDrafts({ draftsDir })).resolves.toEqual([
      {
        draftId: "a-draft",
        path: join(draftsDir, "a-draft.json"),
        classification: "routine_writer_batch",
        promotionReadiness: {
          status: "ready",
        },
        proposedTaskCount: 1,
        blockedPlaceholderCount: 0,
      },
      {
        draftId: "z-draft",
        path: join(draftsDir, "z-draft.json"),
        classification: "routine_writer_batch",
        promotionReadiness: {
          status: "ready",
        },
        proposedTaskCount: 1,
        blockedPlaceholderCount: 0,
      },
    ]);
  });

  test("rejects overwrite with an exclusive write", async () => {
    const draftsDir = await makeDraftsDir();
    const existingDraft = draft({ draftId: "overwrite-draft" });

    await writeBatchPlanDraft({ draftsDir, draft: existingDraft });

    await expect(writeBatchPlanDraft({ draftsDir, draft: existingDraft })).rejects.toThrow(
      "batch plan draft already exists: overwrite-draft",
    );
  });

  test("throws a clear error for missing draft reads", async () => {
    const draftsDir = await makeDraftsDir();

    await expect(readBatchPlanDraftById({ draftsDir, draftId: "missing-draft" })).rejects.toThrow(
      "batch plan draft not found: missing-draft",
    );
  });

  test("does not use a path-like draftId to read outside the drafts store", async () => {
    const draftsDir = await makeDraftsDir();
    const outsidePath = join(draftsDir, "../outside.json");
    await mkdir(dirname(outsidePath), { recursive: true });
    await writeFile(outsidePath, "not valid BatchPlanDraft JSON\n");

    await expect(readBatchPlanDraftById({ draftsDir, draftId: "../outside" })).rejects.toThrow(
      "batch plan draft not found: ../outside",
    );
  });

  test("rejects invalid stored drafts on read and list", async () => {
    const draftsDir = await makeDraftsDir();
    const invalidDraft = draft({
      draftId: "invalid-stored-draft",
      sourceGoal: "",
    });
    const invalidPath = join(draftsDir, "invalid-stored-draft.json");
    await mkdir(draftsDir, { recursive: true });
    await writeFile(invalidPath, `${JSON.stringify(invalidDraft, null, 2)}\n`);

    const expectedError = `invalid stored BatchPlanDraft at ${invalidPath}: sourceGoal must be a non-empty string`;
    await expect(readBatchPlanDraftById({ draftsDir, draftId: "invalid-stored-draft" })).rejects.toThrow(
      expectedError,
    );
    await expect(listBatchPlanDrafts({ draftsDir })).rejects.toThrow(expectedError);
  });
});
