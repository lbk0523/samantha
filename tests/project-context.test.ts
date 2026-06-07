import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  buildProjectContext,
  defaultProjectStateRoot,
  projectIdForTargetRepo,
  sanitizeProjectIdPart,
  workspaceRootForPath,
} from "../src/core/project-context";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("project context", () => {
  test("derives collision-resistant project ids from canonical target paths", () => {
    const first = resolve("/tmp/workspace-a/repos/app");
    const second = resolve("/tmp/workspace-b/repos/app");

    expect(projectIdForTargetRepo(first)).toMatch(/^app-[a-f0-9]{12}$/);
    expect(projectIdForTargetRepo(second)).toMatch(/^app-[a-f0-9]{12}$/);
    expect(projectIdForTargetRepo(first)).not.toBe(projectIdForTargetRepo(second));
  });

  test("sanitizes explicit project id parts", () => {
    expect(sanitizeProjectIdPart("Uiwang Home Monitor")).toBe("uiwang-home-monitor");
    expect(sanitizeProjectIdPart(" !!! ")).toBe("project");
  });

  test("detects the agent workspace root for dogfood defaults", () => {
    const workspacePath = resolve("/Users/byung/agent-workspace/repos/samantha");

    expect(workspaceRootForPath(workspacePath)).toBe(resolve("/Users/byung/agent-workspace"));
    expect(workspaceRootForPath(resolve("/tmp/not-workspace/repos/samantha"))).toBeUndefined();
  });

  test("defaults project state under workspace logs when target repo is in agent-workspace", () => {
    const targetRepoRoot = resolve("/Users/byung/agent-workspace/repos/samantha");

    expect(
      defaultProjectStateRoot({
        projectId: "samantha-fixture",
        targetRepoRoot,
      }),
    ).toBe(resolve("/Users/byung/agent-workspace/logs/samantha/projects/samantha-fixture"));
  });

  test("uses explicit samantha home outside workspace defaults", () => {
    expect(
      defaultProjectStateRoot({
        projectId: "project-a",
        targetRepoRoot: resolve("/tmp/repos/project-a"),
        samanthaHome: "/tmp/samantha-home",
      }),
    ).toBe(resolve("/tmp/samantha-home/projects/project-a"));
  });

  test("builds a complete context with explicit overrides", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-project-context-"));
    tmpRoots.push(root);
    const targetRepoRoot = join(root, "target");
    const harnessRoot = join(root, "harness");
    await mkdir(targetRepoRoot, { recursive: true });
    await mkdir(harnessRoot, { recursive: true });

    const ctx = await buildProjectContext({
      targetRepoRoot,
      harnessRoot,
      projectId: "Custom Project",
      stateRoot: join(root, "state"),
      worktreesRoot: join(root, "trees"),
      assetRoot: join(root, "assets"),
    });

    expect(ctx).toEqual({
      projectId: "custom-project",
      targetRepoRoot: await realpath(targetRepoRoot),
      harnessRoot: await realpath(harnessRoot),
      stateRoot: join(root, "state"),
      worktreesRoot: join(root, "trees"),
      assetRoot: join(root, "assets"),
    });
  });

  test("builds workspace state and default asset roots from real paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-project-context-"));
    tmpRoots.push(root);
    const workspaceRoot = join(root, "agent-workspace");
    const targetRepoRoot = join(workspaceRoot, "repos", "app");
    const harnessRoot = join(workspaceRoot, "repos", "samantha");
    await mkdir(targetRepoRoot, { recursive: true });
    await mkdir(join(harnessRoot, "references"), { recursive: true });

    const ctx = await buildProjectContext({ targetRepoRoot, harnessRoot });
    const realWorkspaceRoot = await realpath(workspaceRoot);
    const realHarnessRoot = await realpath(harnessRoot);

    expect(ctx.projectId).toMatch(new RegExp(`^${basename(targetRepoRoot)}-[a-f0-9]{12}$`));
    expect(ctx.stateRoot).toBe(join(realWorkspaceRoot, "logs", "samantha", "projects", ctx.projectId));
    expect(ctx.worktreesRoot).toBe(join(ctx.stateRoot, "worktrees"));
    expect(ctx.assetRoot).toBe(join(realHarnessRoot, "references"));
  });
});
