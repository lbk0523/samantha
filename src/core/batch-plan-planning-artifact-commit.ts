import { stat } from "node:fs/promises";
import { isAbsolute, join, posix, resolve } from "node:path";
import { git, gitHead, gitTopLevel, gitWorkingTreeFiles } from "./git";

export interface CommitPlanningArtifactsInput {
  repoRoot?: string;
  draftId: string;
  planningArtifactPaths: string[];
}

export interface CommitPlanningArtifactsResult {
  mayCommit: boolean;
  pass: boolean;
  violations: string[];
  repoRoot: string;
  planningArtifactPaths: string[];
  dirtyFiles: string[];
  commitSubject: string;
  commitHash?: string;
  nextAction: string;
}

const SUCCESS_NEXT_ACTION =
  "use commitHash as the Samantha-owned local planning artifact commit before BatchSpec generation";
const FAILURE_NEXT_ACTION = "rework requested planning artifacts and retry the planning artifact commit helper";

export async function commitPlanningArtifacts(
  input: CommitPlanningArtifactsInput,
): Promise<CommitPlanningArtifactsResult> {
  const resolvedRepoRoot = resolve(input.repoRoot ?? ".");
  const violations: string[] = [];
  const draftId = normalizeDraftId(input.draftId, violations);
  const planningArtifactPaths = normalizePlanningArtifactPaths(input.planningArtifactPaths, violations);
  const commitSubject = `chore: commit batch planning artifacts for ${draftId ?? ""}`;
  let repoRoot = resolvedRepoRoot;
  let dirtyFiles: string[] = [];

  try {
    repoRoot = await gitTopLevel(resolvedRepoRoot);
    await gitHead(repoRoot);
  } catch {
    violations.push("repoRoot must be a git repository with a resolvable HEAD");
  }

  if (violations.length === 0) {
    const missingPaths = await missingPlanningArtifactPaths(repoRoot, planningArtifactPaths);
    for (const path of missingPaths) {
      violations.push(`planningArtifactPaths must exist as files before planning artifact commit: ${path}`);
    }

    dirtyFiles = (await gitWorkingTreeFiles(repoRoot)).sort();
    const requestedPaths = new Set(planningArtifactPaths);
    for (const path of dirtyFiles) {
      if (!requestedPaths.has(path)) {
        violations.push(`repoRoot has dirty files outside requested planning artifacts: ${path}`);
      }
    }

    if (missingPaths.length === 0) {
      const requestedDirtyFiles = planningArtifactPaths.filter((path) => dirtyFiles.includes(path));
      if (requestedDirtyFiles.length === 0) {
        violations.push("planningArtifactPaths must include at least one uncommitted requested planning artifact");
      }
    }
  }

  if (violations.length > 0) {
    return resultWithOptionalCommitHash({
      mayCommit: false,
      pass: false,
      violations,
      repoRoot,
      planningArtifactPaths,
      dirtyFiles,
      commitSubject,
      nextAction: FAILURE_NEXT_ACTION,
    });
  }

  try {
    await git(["add", "--", ...planningArtifactPaths], repoRoot);
    await git(["commit", "-m", commitSubject, "--", ...planningArtifactPaths], repoRoot);
    return resultWithOptionalCommitHash({
      mayCommit: true,
      pass: true,
      violations: [],
      repoRoot,
      planningArtifactPaths,
      dirtyFiles,
      commitSubject,
      commitHash: await gitHead(repoRoot),
      nextAction: SUCCESS_NEXT_ACTION,
    });
  } catch {
    return resultWithOptionalCommitHash({
      mayCommit: false,
      pass: false,
      violations: ["git commit for requested planning artifacts failed"],
      repoRoot,
      planningArtifactPaths,
      dirtyFiles,
      commitSubject,
      nextAction: FAILURE_NEXT_ACTION,
    });
  }
}

function normalizeDraftId(value: string, violations: string[]): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0 || /[\r\n]/.test(value)) {
    violations.push("draftId must be a single-line non-empty string");
    return undefined;
  }
  return value.trim();
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

async function missingPlanningArtifactPaths(repoRoot: string, planningArtifactPaths: string[]): Promise<string[]> {
  const missingPaths: string[] = [];
  for (const path of planningArtifactPaths) {
    try {
      const artifactStat = await stat(join(repoRoot, path));
      if (!artifactStat.isFile()) {
        missingPaths.push(path);
      }
    } catch {
      missingPaths.push(path);
    }
  }
  return missingPaths;
}

function resultWithOptionalCommitHash(result: CommitPlanningArtifactsResult): CommitPlanningArtifactsResult {
  if (result.commitHash === undefined) {
    const { commitHash: _commitHash, ...withoutCommitHash } = result;
    return withoutCommitHash;
  }
  return result;
}
