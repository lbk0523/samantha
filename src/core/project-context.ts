import { access, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

export interface ProjectContext {
  projectId: string;
  harnessRoot: string;
  targetRepoRoot: string;
  stateRoot: string;
  worktreesRoot: string;
  assetRoot: string;
}

export interface BuildProjectContextInput {
  targetRepoRoot?: string;
  harnessRoot?: string;
  stateRoot?: string;
  worktreesRoot?: string;
  assetRoot?: string;
  projectId?: string;
  samanthaHome?: string;
  workspaceRoot?: string;
}

const WORKSPACE_MARKER = "agent-workspace";

export function sanitizeProjectIdPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "project";
}

export function projectIdForTargetRepo(targetRepoRoot: string): string {
  const normalized = resolve(targetRepoRoot);
  const name = sanitizeProjectIdPart(basename(normalized));
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `${name}-${hash}`;
}

export function workspaceRootForPath(path: string): string | undefined {
  const normalized = resolve(path);
  const parts = normalized.split(sep);
  const markerIndex = parts.lastIndexOf(WORKSPACE_MARKER);
  if (markerIndex === -1) return undefined;

  const root = parts.slice(0, markerIndex + 1).join(sep);
  return root || sep;
}

export function defaultProjectStateRoot(input: {
  projectId: string;
  targetRepoRoot: string;
  samanthaHome?: string;
  workspaceRoot?: string;
}): string {
  const workspaceRoot = input.workspaceRoot ?? workspaceRootForPath(input.targetRepoRoot);
  if (workspaceRoot && !input.samanthaHome) {
    return join(workspaceRoot, "logs", "samantha", "projects", input.projectId);
  }

  const homeRoot = resolve(input.samanthaHome ?? process.env.SAMANTHA_HOME ?? join(homedir(), ".samantha"));
  return join(homeRoot, "projects", input.projectId);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

export async function defaultHarnessRoot(): Promise<string> {
  const candidates = [
    resolve(import.meta.dir, "..", ".."),
    resolve(import.meta.dir, ".."),
    resolve("."),
  ];

  for (const candidate of candidates) {
    if (await pathExists(join(candidate, "package.json"))) return candidate;
  }

  return resolve(".");
}

export async function buildProjectContext(input: BuildProjectContextInput = {}): Promise<ProjectContext> {
  const targetRepoRoot = await realpath(resolve(input.targetRepoRoot ?? "."));
  const harnessRoot = await realpath(resolve(input.harnessRoot ?? (await defaultHarnessRoot())));
  const projectId = sanitizeProjectIdPart(input.projectId ?? projectIdForTargetRepo(targetRepoRoot));
  const stateRoot = resolve(
    input.stateRoot ??
      defaultProjectStateRoot({
        projectId,
        targetRepoRoot,
        ...(input.samanthaHome ? { samanthaHome: input.samanthaHome } : {}),
        ...(input.workspaceRoot ? { workspaceRoot: input.workspaceRoot } : {}),
      }),
  );

  return {
    projectId,
    harnessRoot,
    targetRepoRoot,
    stateRoot,
    worktreesRoot: resolve(input.worktreesRoot ?? join(stateRoot, "worktrees")),
    assetRoot: resolve(input.assetRoot ?? join(harnessRoot, "references")),
  };
}
