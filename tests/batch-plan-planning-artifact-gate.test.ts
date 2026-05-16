import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preflightPlanningArtifactBaseCommit } from "../src/core/batch-plan-planning-artifact-gate";
import { git, gitHead, gitTopLevel } from "../src/core/git";

let tmpRoots: string[] = [];

const PLANNING_PATHS = [
  "references/batch-plans/planned-batch.json",
  "references/tasks/planned-task.json",
];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-planning-artifact-gate-"));
  tmpRoots.push(root);
  return root;
}

async function initRepo(root: string): Promise<void> {
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
}

async function writePlanningArtifact(root: string, path: string, marker = path): Promise<void> {
  await mkdir(join(root, "references", "batch-plans"), { recursive: true });
  await mkdir(join(root, "references", "tasks"), { recursive: true });
  await writeFile(join(root, path), `${JSON.stringify({ marker })}\n`, "utf8");
}

async function makeRepoFixture(paths: string[] = PLANNING_PATHS): Promise<{ root: string; head: string }> {
  const root = await makeTempRoot();
  await initRepo(root);
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  for (const path of paths) {
    await writePlanningArtifact(root, path);
  }
  await git(["add", "."], root);
  await git(["commit", "-m", "chore: commit planning artifacts"], root);
  return { root, head: await gitHead(root) };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("planning artifact baseCommit gate", () => {
  test("passes for a clean repo with committed BatchPlan and TaskSpec planning artifacts", async () => {
    const { root, head } = await makeRepoFixture();
    const repoRoot = await gitTopLevel(root);

    await expect(
      preflightPlanningArtifactBaseCommit({
        repoRoot: root,
        planningArtifactPaths: PLANNING_PATHS,
      }),
    ).resolves.toEqual({
      mayUseBaseCommit: true,
      violations: [],
      repoRoot,
      planningArtifactPaths: PLANNING_PATHS,
      dirtyFiles: [],
      baseCommit: head,
      nextAction: "use returned baseCommit for execution BatchSpec generation outside the target repo dirty tree",
    });
  });

  test("blocks dirty tracked changes and reports dirty files", async () => {
    const { root } = await makeRepoFixture();
    await writeFile(join(root, PLANNING_PATHS[1]), "{\"dirty\":true}\n", "utf8");

    const result = await preflightPlanningArtifactBaseCommit({
      repoRoot: root,
      planningArtifactPaths: PLANNING_PATHS,
    });

    expect(result.mayUseBaseCommit).toBe(false);
    expect(result.dirtyFiles).toEqual(["references/tasks/planned-task.json"]);
    expect(result.violations).toContain("repoRoot working tree and index must be clean before BatchSpec generation");
    expect(result).not.toHaveProperty("baseCommit");
  });

  test("blocks untracked planning artifacts until committed", async () => {
    const root = await makeTempRoot();
    await initRepo(root);
    await writeFile(join(root, ".fixture"), "base\n", "utf8");
    await git(["add", ".fixture"], root);
    await git(["commit", "-m", "chore: initial fixture"], root);
    await writePlanningArtifact(root, PLANNING_PATHS[0]);

    const result = await preflightPlanningArtifactBaseCommit({
      repoRoot: root,
      planningArtifactPaths: [PLANNING_PATHS[0]],
    });

    expect(result.mayUseBaseCommit).toBe(false);
    expect(result.dirtyFiles).toEqual([PLANNING_PATHS[0]]);
    expect(result.violations).toContain(
      `planningArtifactPaths must exist in HEAD before BatchSpec generation: ${PLANNING_PATHS[0]}`,
    );
    expect(result).not.toHaveProperty("baseCommit");
  });

  test("blocks missing artifact paths in HEAD", async () => {
    const { root } = await makeRepoFixture([PLANNING_PATHS[0]]);

    const result = await preflightPlanningArtifactBaseCommit({
      repoRoot: root,
      planningArtifactPaths: PLANNING_PATHS,
    });

    expect(result.mayUseBaseCommit).toBe(false);
    expect(result.dirtyFiles).toEqual([]);
    expect(result.violations).toContain(
      `planningArtifactPaths must exist in HEAD before BatchSpec generation: ${PLANNING_PATHS[1]}`,
    );
    expect(result).not.toHaveProperty("baseCommit");
  });

  test("rejects absolute and parent-relative paths before trusting them", async () => {
    const { root } = await makeRepoFixture();

    const result = await preflightPlanningArtifactBaseCommit({
      repoRoot: root,
      planningArtifactPaths: [join(root, PLANNING_PATHS[0]), "../references/tasks/escape.json"],
    });

    expect(result.mayUseBaseCommit).toBe(false);
    expect(result.planningArtifactPaths).toEqual([]);
    expect(result.violations).toContain(
      `planningArtifactPaths entries must be repo-relative paths without .. segments: ${join(
        root,
        PLANNING_PATHS[0],
      )}`,
    );
    expect(result.violations).toContain(
      "planningArtifactPaths entries must be repo-relative paths without .. segments: ../references/tasks/escape.json",
    );
    expect(result).not.toHaveProperty("baseCommit");
  });

  test("rejects duplicate normalized planning artifact paths", async () => {
    const { root } = await makeRepoFixture([PLANNING_PATHS[0]]);

    const result = await preflightPlanningArtifactBaseCommit({
      repoRoot: root,
      planningArtifactPaths: [PLANNING_PATHS[0], "references/batch-plans/./planned-batch.json"],
    });

    expect(result.mayUseBaseCommit).toBe(false);
    expect(result.planningArtifactPaths).toEqual([PLANNING_PATHS[0], PLANNING_PATHS[0]]);
    expect(result.violations).toContain(
      `planningArtifactPaths must not contain duplicate paths: ${PLANNING_PATHS[0]}`,
    );
    expect(result).not.toHaveProperty("baseCommit");
  });

  test("rejects non-planning surfaces such as execution BatchSpec artifacts", async () => {
    const { root } = await makeRepoFixture();

    const result = await preflightPlanningArtifactBaseCommit({
      repoRoot: root,
      planningArtifactPaths: ["references/batch-specs/execution-batch.json"],
    });

    expect(result.mayUseBaseCommit).toBe(false);
    expect(result.planningArtifactPaths).toEqual([]);
    expect(result.violations).toContain(
      "planningArtifactPaths entries must be references/batch-plans/*.json or references/tasks/*.json: references/batch-specs/execution-batch.json",
    );
    expect(result).not.toHaveProperty("baseCommit");
  });
});
