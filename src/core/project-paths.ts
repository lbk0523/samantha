import { join } from "node:path";
import type { ProjectContext } from "./project-context";

export function sanitizePathSegment(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!safe) {
    throw new Error(`invalid path segment: ${value}`);
  }
  return safe;
}

export const projectPaths = {
  projectManifest(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "project.json");
  },

  runsDir(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "runs");
  },

  runIndexPath(ctx: ProjectContext): string {
    return join(projectPaths.runsDir(ctx), "index.jsonl");
  },

  runEventsPath(ctx: ProjectContext): string {
    return join(projectPaths.runsDir(ctx), "events.jsonl");
  },

  runLifecycleLog(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "run-lifecycle.jsonl");
  },

  taskSpecsDir(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "tasks");
  },

  taskSpecPath(ctx: ProjectContext, taskId: string): string {
    return join(projectPaths.taskSpecsDir(ctx), `${sanitizePathSegment(taskId)}.json`);
  },

  batchesDir(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "batches");
  },

  batchSpecPath(ctx: ProjectContext, batchId: string): string {
    return join(projectPaths.batchesDir(ctx), `${sanitizePathSegment(batchId)}.json`);
  },

  lessonInboxDir(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "lessons", "inbox");
  },

  lessonReviewsDir(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "lessons", "reviews");
  },

  lessonDailyDir(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "lessons", "daily");
  },

  lessonCandidatePath(ctx: ProjectContext, runId: string): string {
    return join(projectPaths.lessonInboxDir(ctx), `${sanitizePathSegment(runId)}.md`);
  },

  lessonReviewPath(ctx: ProjectContext, runId: string): string {
    return join(projectPaths.lessonReviewsDir(ctx), `${sanitizePathSegment(runId)}.json`);
  },

  lessonDailyReviewPath(ctx: ProjectContext, targetDate: string): string {
    return join(projectPaths.lessonDailyDir(ctx), `${sanitizePathSegment(targetDate)}.json`);
  },

  locksDir(ctx: ProjectContext): string {
    return join(ctx.stateRoot, "locks");
  },

  writerLockPath(ctx: ProjectContext): string {
    return join(projectPaths.locksDir(ctx), "writer.lock");
  },

  worktreesRoot(ctx: ProjectContext): string {
    return ctx.worktreesRoot;
  },

  worktreePathForTask(ctx: ProjectContext, taskId: string): string {
    return join(ctx.worktreesRoot, sanitizePathSegment(taskId));
  },

  agentProfilesDir(ctx: ProjectContext): string {
    return join(ctx.assetRoot, "agent-profiles");
  },

  agentProfilePath(ctx: ProjectContext, agentId: string): string {
    return join(projectPaths.agentProfilesDir(ctx), `${sanitizePathSegment(agentId)}.json`);
  },

  taskTemplatesDir(ctx: ProjectContext): string {
    return join(ctx.assetRoot, "task-templates");
  },

  taskTemplatePath(ctx: ProjectContext, templateId: string): string {
    return join(projectPaths.taskTemplatesDir(ctx), `${sanitizePathSegment(templateId)}.json`);
  },

  projectAssetRoot(ctx: ProjectContext): string {
    return join(ctx.targetRepoRoot, ".samantha");
  },
};
