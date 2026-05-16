import { isAbsolute, posix, resolve } from "node:path";
import { git, gitHead, gitTopLevel, gitWorkingTreeFiles } from "./git";

export interface PlanningArtifactBaseCommitGateInput {
  repoRoot?: string;
  planningArtifactPaths: string[];
}

export interface PlanningArtifactBaseCommitGateResult {
  mayUseBaseCommit: boolean;
  violations: string[];
  repoRoot: string;
  planningArtifactPaths: string[];
  dirtyFiles: string[];
  baseCommit?: string;
  nextAction: string;
}

const SUCCESS_NEXT_ACTION =
  "use returned baseCommit for execution BatchSpec generation outside the target repo dirty tree";
const FAILURE_NEXT_ACTION = "commit planning artifacts and clean/rework the target repo before BatchSpec generation";

export async function preflightPlanningArtifactBaseCommit(
  input: PlanningArtifactBaseCommitGateInput,
): Promise<PlanningArtifactBaseCommitGateResult> {
  const resolvedRepoRoot = resolve(input.repoRoot ?? ".");
  const violations: string[] = [];
  const planningArtifactPaths = normalizePlanningArtifactPaths(input.planningArtifactPaths, violations);
  let repoRoot = resolvedRepoRoot;
  let head: string | undefined;
  let dirtyFiles: string[] = [];

  try {
    repoRoot = await gitTopLevel(resolvedRepoRoot);
    head = await gitHead(repoRoot);
  } catch {
    violations.push("repoRoot must be a git repository with a resolvable HEAD");
  }

  if (head !== undefined) {
    for (const path of planningArtifactPaths) {
      if (!(await gitPathExistsInHead(repoRoot, path))) {
        violations.push(`planningArtifactPaths must exist in HEAD before BatchSpec generation: ${path}`);
      }
    }

    dirtyFiles = (await gitWorkingTreeFiles(repoRoot)).sort();
    if (dirtyFiles.length > 0) {
      violations.push("repoRoot working tree and index must be clean before BatchSpec generation");
    }
  }

  const mayUseBaseCommit = violations.length === 0;
  return resultWithOptionalBaseCommit({
    mayUseBaseCommit,
    violations,
    repoRoot,
    planningArtifactPaths,
    dirtyFiles,
    baseCommit: mayUseBaseCommit ? head : undefined,
    nextAction: mayUseBaseCommit ? SUCCESS_NEXT_ACTION : FAILURE_NEXT_ACTION,
  });
}

function normalizePlanningArtifactPaths(values: string[], violations: string[]): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    violations.push("planningArtifactPaths must contain at least one planning artifact path");
    return [];
  }

  const normalizedPaths: string[] = [];
  const seenPaths = new Set<string>();
  const duplicatePaths = new Set<string>();

  for (const value of values) {
    const normalized = normalizePlanningArtifactPath(value, violations);
    if (normalized === undefined) continue;

    normalizedPaths.push(normalized);
    if (seenPaths.has(normalized)) {
      duplicatePaths.add(normalized);
    } else {
      seenPaths.add(normalized);
    }
  }

  for (const path of [...duplicatePaths].sort()) {
    violations.push(`planningArtifactPaths must not contain duplicate paths: ${path}`);
  }

  return normalizedPaths;
}

function normalizePlanningArtifactPath(value: string, violations: string[]): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    violations.push("planningArtifactPaths entries must be non-empty repo-relative paths");
    return undefined;
  }

  const candidate = value.trim().replaceAll("\\", "/");
  const rawSegments = candidate.split("/");
  if (
    isAbsolute(value) ||
    candidate.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    rawSegments.includes("..")
  ) {
    violations.push(`planningArtifactPaths entries must be repo-relative paths without .. segments: ${value}`);
    return undefined;
  }

  const normalized = posix.normalize(candidate);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    violations.push(`planningArtifactPaths entries must stay inside repoRoot: ${value}`);
    return undefined;
  }
  if (!isPlanningArtifactSurface(normalized)) {
    violations.push(
      `planningArtifactPaths entries must be references/batch-plans/*.json or references/tasks/*.json: ${value}`,
    );
    return undefined;
  }

  return normalized;
}

function isPlanningArtifactSurface(path: string): boolean {
  const directory = posix.dirname(path);
  const filename = posix.basename(path);
  return (
    (directory === "references/batch-plans" || directory === "references/tasks") &&
    filename.endsWith(".json") &&
    filename !== ".json"
  );
}

async function gitPathExistsInHead(repoRoot: string, path: string): Promise<boolean> {
  try {
    await git(["cat-file", "-e", `HEAD:${path}`], repoRoot);
    return true;
  } catch {
    return false;
  }
}

function resultWithOptionalBaseCommit(
  result: PlanningArtifactBaseCommitGateResult,
): PlanningArtifactBaseCommitGateResult {
  if (result.baseCommit === undefined) {
    const { baseCommit: _baseCommit, ...withoutBaseCommit } = result;
    return withoutBaseCommit;
  }
  return result;
}
