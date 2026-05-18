import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { BatchPlanDraft } from "../src/core/batch-plan-draft";
import { writeBatchPlanDraft } from "../src/core/batch-plan-draft-store";
import { dryRunBatchPlanAssembly } from "../src/core/batch-plan-assembly";
import {
  preflightTaskSpecWrites,
  type TaskSpecWritePreflightResult,
} from "../src/core/batch-plan-task-spec-preflight";
import { writeBatchPlanTaskSpecs, writeStoredBatchPlanTaskSpecs } from "../src/core/batch-plan-task-spec-store";

let tmpRoots: string[] = [];

function proposedTask(
  overrides: Partial<BatchPlanDraft["proposedTasks"][number]> = {},
): BatchPlanDraft["proposedTasks"][number] {
  return {
    id: "batch-plan-task-spec-store-task",
    title: "Add BatchPlan TaskSpec artifact writer",
    summary: "Create the deterministic TaskSpec artifact writer for BatchPlanDraft assembly output.",
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "routine",
    targetFileHints: ["src/core/batch-plan-task-spec-store.ts", "tests/batch-plan-task-spec-store.test.ts"],
    forbiddenChangeHints: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
    verifyCommandHints: ["bun test tests/batch-plan-task-spec-store.test.ts"],
    independentlyVerifiableRationale:
      "The artifact writer can be checked with focused file I/O and preflight rejection tests.",
    ...overrides,
  };
}

function draft(overrides: Partial<BatchPlanDraft> = {}): BatchPlanDraft {
  return {
    schemaVersion: 1,
    draftId: "batch-plan-task-spec-store",
    createdAt: "2026-05-16T00:00:00.000Z",
    sourceGoal: "Implement deterministic TaskSpec artifact writes for BatchPlanDraft assembly output.",
    classification: "routine_writer_batch",
    repoInspection: {
      inspectedPaths: [
        "src/core/batch-plan-task-spec-preflight.ts",
        "src/core/batch-plan-assembly.ts",
        "src/core/batch-plan-draft-store.ts",
      ],
      currentStateSummary: "BatchPlan TaskSpec write preflight already emits inert TaskSpec write plans.",
      candidateWriteSurfaces: [
        "src/core/batch-plan-task-spec-store.ts",
        "tests/batch-plan-task-spec-store.test.ts",
      ],
      authorityBoundarySurfaces: ["src/cli.ts", "src/core/batch-spec.ts", "references/**", "runs/**"],
      assumptions: ["The writer only materializes preflighted TaskSpec JSON artifacts."],
    },
    proposedTasks: [proposedTask()],
    dependencyHints: [],
    parallelizationHints: [
      {
        taskIds: ["batch-plan-task-spec-store-task"],
        rationale: "Single artifact-store slice with no BatchSpec or lifecycle authority.",
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
      reasons: ["No blocking placeholders remain for this TaskSpec artifact writer slice."],
    },
    report: {
      summary: "Preflighted TaskSpec candidates can be written as artifacts.",
      nextAction: "Use a later explicit path for BatchSpec assembly and dispatch.",
    },
    ...overrides,
  };
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-task-spec-store-"));
  tmpRoots.push(root);
  return root;
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

function writeablePreflight(taskSpecDir?: string): TaskSpecWritePreflightResult {
  return preflightTaskSpecWrites(dryRunBatchPlanAssembly(draft(), { taskSpecDir }));
}

function writeablePreflightWithPath(path: string): TaskSpecWritePreflightResult {
  const preflight = writeablePreflight();
  return {
    ...preflight,
    taskSpecWritePlans: [
      {
        path,
        taskSpec: preflight.taskSpecWritePlans[0].taskSpec,
      },
    ],
  };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("BatchPlan TaskSpec artifact store", () => {
  test("writes a mayWrite preflight result as TaskSpec JSON with a structured record", async () => {
    const repoRoot = await makeTempRoot();
    const preflight = writeablePreflight();
    const plan = preflight.taskSpecWritePlans[0];
    const absolutePath = join(repoRoot, plan.path);

    await expect(writeBatchPlanTaskSpecs({ repoRoot, preflight })).resolves.toEqual([
      {
        path: plan.path,
        absolutePath,
        taskSpec: plan.taskSpec,
      },
    ]);
    await expect(readFile(absolutePath, "utf8")).resolves.toBe(`${JSON.stringify(plan.taskSpec, null, 2)}\n`);
  });

  test("reads a stored draft and writes references/tasks TaskSpec artifacts through preflight", async () => {
    const repoRoot = await makeTempRoot();
    const draftsDir = join(repoRoot, "references", "batch-plans");
    await writeBatchPlanDraft({ draftsDir, draft: draft({ draftId: "stored-task-spec-writer" }) });

    const records = await writeStoredBatchPlanTaskSpecs({
      repoRoot,
      draftsDir,
      draftId: "stored-task-spec-writer",
    });

    expect(records).toHaveLength(1);
    expect(records[0].path).toBe("references/tasks/batch-plan-task-spec-store-task.json");
    expect(records[0].absolutePath).toBe(join(repoRoot, records[0].path));
    await expect(readFile(records[0].absolutePath, "utf8")).resolves.toContain(
      '"id": "batch-plan-task-spec-store-task"',
    );
  });

  test("creates parent TaskSpec directories without creating BatchSpec directories", async () => {
    const repoRoot = await makeTempRoot();
    const preflight = writeablePreflight("references/tasks/nested");

    await writeBatchPlanTaskSpecs({ repoRoot, preflight });

    await expect(pathExists(join(repoRoot, "references", "tasks", "nested"))).resolves.toBe(true);
    await expect(pathExists(join(repoRoot, "references", "batch-specs"))).resolves.toBe(false);
  });

  test("rejects existing files instead of overwriting them", async () => {
    const repoRoot = await makeTempRoot();
    const preflight = writeablePreflight();
    const path = preflight.taskSpecWritePlans[0].path;
    const absolutePath = join(repoRoot, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, "existing\n");

    await expect(writeBatchPlanTaskSpecs({ repoRoot, preflight })).rejects.toThrow(`TaskSpec already exists: ${path}`);
    await expect(readFile(absolutePath, "utf8")).resolves.toBe("existing\n");
  });

  test("rejects non-mayWrite preflight results and writes no files", async () => {
    const repoRoot = await makeTempRoot();
    const preflight = preflightTaskSpecWrites(
      dryRunBatchPlanAssembly(
        draft({
          classification: "report_only",
          proposedTasks: [],
          parallelizationHints: [],
          promotionReadiness: {
            status: "blocked",
            reasons: ["Report-only planning cannot create TaskSpec artifacts."],
          },
        }),
      ),
    );

    await expect(writeBatchPlanTaskSpecs({ repoRoot, preflight })).rejects.toThrow(
      "TaskSpec write preflight failed: classification must be routine_writer_batch to promote; promotionReadiness.status must be ready to promote",
    );
    await expect(pathExists(join(repoRoot, "references", "tasks"))).resolves.toBe(false);
  });

  test("rejects manually bad absolute or parent-relative paths that escape repoRoot", async () => {
    const repoRoot = await makeTempRoot();
    const outsideRoot = await makeTempRoot();
    const absoluteEscapePath = join(outsideRoot, "absolute-escape.json");
    const parentEscapePath = `../${basename(outsideRoot)}/parent-escape.json`;

    await expect(
      writeBatchPlanTaskSpecs({
        repoRoot,
        preflight: writeablePreflightWithPath(absoluteEscapePath),
      }),
    ).rejects.toThrow(`TaskSpec write path escapes repoRoot: ${absoluteEscapePath}`);
    await expect(pathExists(absoluteEscapePath)).resolves.toBe(false);

    await expect(
      writeBatchPlanTaskSpecs({
        repoRoot,
        preflight: writeablePreflightWithPath(parentEscapePath),
      }),
    ).rejects.toThrow(`TaskSpec write path escapes repoRoot: ${parentEscapePath}`);
    await expect(pathExists(resolve(repoRoot, parentEscapePath))).resolves.toBe(false);
  });
});
