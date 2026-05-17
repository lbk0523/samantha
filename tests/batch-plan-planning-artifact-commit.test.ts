import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitPlanningArtifacts } from "../src/core/batch-plan-planning-artifact-commit";
import { git, gitHead, gitTopLevel, gitWorkingTreeFiles } from "../src/core/git";

let tmpRoots: string[] = [];

const PLANNING_PATHS = [
  "references/batch-plans/planned-batch.json",
  "references/tasks/planned-task.json",
];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-planning-artifact-commit-"));
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

async function makeRepoFixture(): Promise<{ root: string; head: string }> {
  const root = await makeTempRoot();
  await initRepo(root);
  await writeFile(join(root, ".fixture"), "base\n", "utf8");
  await git(["add", ".fixture"], root);
  await git(["commit", "-m", "chore: initial fixture"], root);
  return { root, head: await gitHead(root) };
}

async function committedFiles(root: string): Promise<string[]> {
  const out = await git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], root);
  return out.split("\n").filter(Boolean).sort();
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("planning artifact commit helper", () => {
  test("commits dirty BatchPlan and TaskSpec planning artifacts with deterministic Samantha-owned evidence", async () => {
    const { root } = await makeRepoFixture();
    const repoRoot = await gitTopLevel(root);
    for (const path of PLANNING_PATHS) {
      await writePlanningArtifact(root, path);
    }

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: PLANNING_PATHS,
    });

    const commitHash = await gitHead(root);
    expect(result).toEqual({
      mayCommit: true,
      pass: true,
      violations: [],
      repoRoot,
      planningArtifactPaths: PLANNING_PATHS,
      dirtyFiles: PLANNING_PATHS,
      commitSubject: "chore: commit batch planning artifacts for draft-alpha",
      commitHash,
      nextAction: "use commitHash as the Samantha-owned local planning artifact commit before BatchSpec generation",
    });
    expect(await committedFiles(root)).toEqual(PLANNING_PATHS);
    expect(await gitWorkingTreeFiles(root)).toEqual([]);
  });

  test("rejects dirty files outside the requested planning artifacts", async () => {
    const { root, head } = await makeRepoFixture();
    await writePlanningArtifact(root, PLANNING_PATHS[0]);
    await writeFile(join(root, "notes.txt"), "unrelated\n", "utf8");

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: [PLANNING_PATHS[0]],
    });

    expect(result.mayCommit).toBe(false);
    expect(result.pass).toBe(false);
    expect(result.dirtyFiles).toEqual(["notes.txt", PLANNING_PATHS[0]]);
    expect(result.violations).toContain("repoRoot has dirty files outside requested planning artifacts: notes.txt");
    expect(result).not.toHaveProperty("commitHash");
    expect(await gitHead(root)).toBe(head);
  });

  test("rejects non-planning paths such as execution BatchSpec artifacts", async () => {
    const { root } = await makeRepoFixture();

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: ["references/batch-specs/execution-batch.json"],
    });

    expect(result.mayCommit).toBe(false);
    expect(result.pass).toBe(false);
    expect(result.planningArtifactPaths).toEqual([]);
    expect(result.violations).toContain(
      "planningArtifactPaths entries must be references/batch-plans/*.json or references/tasks/*.json: references/batch-specs/execution-batch.json",
    );
    expect(result).not.toHaveProperty("commitHash");
  });

  test("rejects escaping planning artifact paths before trusting them", async () => {
    const { root } = await makeRepoFixture();

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: ["../references/tasks/escape.json"],
    });

    expect(result.mayCommit).toBe(false);
    expect(result.pass).toBe(false);
    expect(result.planningArtifactPaths).toEqual([]);
    expect(result.violations).toContain(
      "planningArtifactPaths entries must be repo-relative paths without .. segments: ../references/tasks/escape.json",
    );
    expect(result).not.toHaveProperty("commitHash");
  });

  test("rejects missing planning artifact paths before committing", async () => {
    const { root, head } = await makeRepoFixture();

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: [PLANNING_PATHS[1]],
    });

    expect(result.mayCommit).toBe(false);
    expect(result.pass).toBe(false);
    expect(result.dirtyFiles).toEqual([]);
    expect(result.violations).toContain(
      `planningArtifactPaths must exist as files before planning artifact commit: ${PLANNING_PATHS[1]}`,
    );
    expect(result).not.toHaveProperty("commitHash");
    expect(await gitHead(root)).toBe(head);
  });

  test("rejects duplicate normalized planning artifact paths", async () => {
    const { root, head } = await makeRepoFixture();
    await writePlanningArtifact(root, PLANNING_PATHS[1]);

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: [PLANNING_PATHS[1], "references/tasks/./planned-task.json"],
    });

    expect(result.mayCommit).toBe(false);
    expect(result.pass).toBe(false);
    expect(result.planningArtifactPaths).toEqual([PLANNING_PATHS[1], PLANNING_PATHS[1]]);
    expect(result.violations).toContain(
      `planningArtifactPaths must not contain duplicate paths: ${PLANNING_PATHS[1]}`,
    );
    expect(result).not.toHaveProperty("commitHash");
    expect(await gitHead(root)).toBe(head);
  });

  test("rejects an empty planning artifact list", async () => {
    const { root } = await makeRepoFixture();

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: [],
    });

    expect(result.mayCommit).toBe(false);
    expect(result.pass).toBe(false);
    expect(result.planningArtifactPaths).toEqual([]);
    expect(result.violations).toContain("planningArtifactPaths must contain at least one planning artifact path");
    expect(result).not.toHaveProperty("commitHash");
  });

  test("rejects attempts with no uncommitted requested planning artifacts", async () => {
    const { root } = await makeRepoFixture();
    await writePlanningArtifact(root, PLANNING_PATHS[0]);
    await git(["add", PLANNING_PATHS[0]], root);
    await git(["commit", "-m", "chore: commit existing planning artifact"], root);
    const head = await gitHead(root);

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: [PLANNING_PATHS[0]],
    });

    expect(result.mayCommit).toBe(false);
    expect(result.pass).toBe(false);
    expect(result.dirtyFiles).toEqual([]);
    expect(result.violations).toContain(
      "planningArtifactPaths must include at least one uncommitted requested planning artifact",
    );
    expect(result).not.toHaveProperty("commitHash");
    expect(await gitHead(root)).toBe(head);
  });

  test("commits only requested planning artifacts", async () => {
    const { root } = await makeRepoFixture();
    await writePlanningArtifact(root, PLANNING_PATHS[0], "batch-v1");
    await writePlanningArtifact(root, PLANNING_PATHS[1], "task-v1");
    await git(["add", ...PLANNING_PATHS], root);
    await git(["commit", "-m", "chore: commit baseline planning artifacts"], root);
    await writePlanningArtifact(root, PLANNING_PATHS[0], "batch-v2");

    const result = await commitPlanningArtifacts({
      repoRoot: root,
      draftId: "draft-alpha",
      planningArtifactPaths: [PLANNING_PATHS[0]],
    });

    expect(result.pass).toBe(true);
    expect(await committedFiles(root)).toEqual([PLANNING_PATHS[0]]);
    expect(await readFile(join(root, PLANNING_PATHS[1]), "utf8")).toBe(`${JSON.stringify({ marker: "task-v1" })}\n`);
    expect(await gitWorkingTreeFiles(root)).toEqual([]);
  });
});
