import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { ProjectContext } from "../src/core/project-context";
import { projectPaths, sanitizePathSegment } from "../src/core/project-paths";

const ctx: ProjectContext = {
  projectId: "app-abc123",
  harnessRoot: "/workspace/repos/samantha",
  targetRepoRoot: "/workspace/repos/app",
  stateRoot: "/workspace/logs/samantha/projects/app-abc123",
  worktreesRoot: "/workspace/logs/samantha/projects/app-abc123/worktrees",
  assetRoot: "/workspace/repos/samantha/references",
};

describe("project paths", () => {
  test("resolves runtime state under stateRoot", () => {
    expect(projectPaths.projectManifest(ctx)).toBe(join(ctx.stateRoot, "project.json"));
    expect(projectPaths.runsDir(ctx)).toBe(join(ctx.stateRoot, "runs"));
    expect(projectPaths.runIndexPath(ctx)).toBe(join(ctx.stateRoot, "runs", "index.jsonl"));
    expect(projectPaths.runEventsPath(ctx)).toBe(join(ctx.stateRoot, "runs", "events.jsonl"));
    expect(projectPaths.runLifecycleLog(ctx)).toBe(join(ctx.stateRoot, "run-lifecycle.jsonl"));
    expect(projectPaths.taskSpecsDir(ctx)).toBe(join(ctx.stateRoot, "tasks"));
    expect(projectPaths.taskSpecPath(ctx, "Feature A")).toBe(join(ctx.stateRoot, "tasks", "feature-a.json"));
    expect(projectPaths.batchesDir(ctx)).toBe(join(ctx.stateRoot, "batches"));
    expect(projectPaths.batchSpecPath(ctx, "Batch A")).toBe(join(ctx.stateRoot, "batches", "batch-a.json"));
    expect(projectPaths.lessonInboxDir(ctx)).toBe(join(ctx.stateRoot, "lessons", "inbox"));
    expect(projectPaths.lessonReviewsDir(ctx)).toBe(join(ctx.stateRoot, "lessons", "reviews"));
    expect(projectPaths.lessonDailyDir(ctx)).toBe(join(ctx.stateRoot, "lessons", "daily"));
    expect(projectPaths.lessonCandidatePath(ctx, "Run A")).toBe(
      join(ctx.stateRoot, "lessons", "inbox", "run-a.md"),
    );
    expect(projectPaths.lessonReviewPath(ctx, "Run A")).toBe(
      join(ctx.stateRoot, "lessons", "reviews", "run-a.json"),
    );
    expect(projectPaths.lessonDailyReviewPath(ctx, "2026-06-07")).toBe(
      join(ctx.stateRoot, "lessons", "daily", "2026-06-07.json"),
    );
    expect(projectPaths.locksDir(ctx)).toBe(join(ctx.stateRoot, "locks"));
    expect(projectPaths.writerLockPath(ctx)).toBe(join(ctx.stateRoot, "locks", "writer.lock"));
  });

  test("resolves worktrees under the project worktrees root", () => {
    expect(projectPaths.worktreesRoot(ctx)).toBe(ctx.worktreesRoot);
    expect(projectPaths.worktreePathForTask(ctx, "Task 1")).toBe(join(ctx.worktreesRoot, "task-1"));
  });

  test("resolves reusable assets under assetRoot and project overrides separately", () => {
    expect(projectPaths.agentProfilesDir(ctx)).toBe(join(ctx.assetRoot, "agent-profiles"));
    expect(projectPaths.agentProfilePath(ctx, "codex-worker")).toBe(
      join(ctx.assetRoot, "agent-profiles", "codex-worker.json"),
    );
    expect(projectPaths.taskTemplatesDir(ctx)).toBe(join(ctx.assetRoot, "task-templates"));
    expect(projectPaths.taskTemplatePath(ctx, "core-module-with-tests")).toBe(
      join(ctx.assetRoot, "task-templates", "core-module-with-tests.json"),
    );
    expect(projectPaths.projectAssetRoot(ctx)).toBe(join(ctx.targetRepoRoot, ".samantha"));
  });

  test("rejects empty path segments", () => {
    expect(sanitizePathSegment(" Feature A ")).toBe("feature-a");
    expect(() => sanitizePathSegment(" ! ")).toThrow("invalid path segment");
  });
});
