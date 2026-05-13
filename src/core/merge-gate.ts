import { readFile } from "node:fs/promises";
import type { WorkerRunLog } from "./run-log";
import { git, gitHead, gitRaw } from "./git";
import { actionableCommitForRunLog } from "./run-commit";

export interface MergeGateInput {
  runLogPath: string;
  repoRoot: string;
  targetBranch?: string;
}

export type MergeCandidateStatus =
  | "mergeable"
  | "already_merged"
  | "stale_base"
  | "failed_verification"
  | "dirty_target_repo"
  | "missing_commit"
  | "blocked";

export interface MergeGateResult {
  mayMerge: boolean;
  alreadyMerged: boolean;
  status: MergeCandidateStatus;
  targetBranch: string;
  commit: string;
  command?: string[];
  violations: string[];
}

export async function readWorkerRunLog(path: string): Promise<WorkerRunLog> {
  return JSON.parse(await readFile(path, "utf8")) as WorkerRunLog;
}

async function gitSucceeds(args: string[], cwd: string): Promise<boolean> {
  try {
    await git(args, cwd);
    return true;
  } catch {
    return false;
  }
}

function classifyMergeCandidate(input: {
  alreadyMerged: boolean;
  failedVerification: boolean;
  missingCommit: boolean;
  dirtyTargetRepo: boolean;
  staleBase: boolean;
  violations: string[];
}): MergeCandidateStatus {
  if (input.failedVerification) return "failed_verification";
  if (input.missingCommit) return "missing_commit";
  if (input.dirtyTargetRepo) return "dirty_target_repo";
  if (input.alreadyMerged && input.violations.length === 0) return "already_merged";
  if (input.staleBase) return "stale_base";
  if (input.violations.length === 0) return "mergeable";
  return "blocked";
}

export async function evaluateMergeGate(input: MergeGateInput): Promise<MergeGateResult> {
  const log = await readWorkerRunLog(input.runLogPath);
  const targetBranch = input.targetBranch ?? "main";
  const execution = log.result;
  const commit = actionableCommitForRunLog(log);
  const violations: string[] = [];
  let failedVerification = false;
  let missingCommit = false;
  let dirtyTargetRepo = false;
  let staleBase = false;

  if (!execution.pass) {
    failedVerification = true;
    violations.push("run did not pass Samantha evaluation");
  }
  if (!commit) {
    missingCommit = true;
    violations.push("run did not report a commit");
  }

  const branch = await git(["branch", "--show-current"], input.repoRoot);
  if (branch !== targetBranch) {
    violations.push(`target repo is on ${branch || "(detached)"}, expected ${targetBranch}`);
  }

  const status = await gitRaw(["status", "--porcelain"], input.repoRoot);
  if (status.trim().length > 0) {
    dirtyTargetRepo = true;
    violations.push("target repo has uncommitted changes");
  }

  const baseCommit = execution.preparation.allocation?.baseCommit;
  if (!baseCommit) {
    staleBase = true;
    violations.push("run log has no allocated worktree base commit");
  }

  if (commit && !(await gitSucceeds(["cat-file", "-e", `${commit}^{commit}`], input.repoRoot))) {
    missingCommit = true;
    violations.push("reported commit does not exist in target repo");
  }

  if (commit && baseCommit) {
    if (!(await gitSucceeds(["merge-base", "--is-ancestor", baseCommit, commit], input.repoRoot))) {
      staleBase = true;
      violations.push("reported commit is not descended from the worker base commit");
    }
  }

  const head = await gitHead(input.repoRoot);
  const alreadyMerged = commit
    ? await gitSucceeds(["merge-base", "--is-ancestor", commit, head], input.repoRoot)
    : false;

  if (baseCommit && head !== baseCommit) {
    staleBase = true;
    violations.push("target repo HEAD no longer matches the worker base commit");
  }

  if (alreadyMerged) {
    const baseMismatchIndex = violations.indexOf("target repo HEAD no longer matches the worker base commit");
    if (baseMismatchIndex !== -1) {
      violations.splice(baseMismatchIndex, 1);
      staleBase = false;
    }
  }

  const candidateStatus = classifyMergeCandidate({
    alreadyMerged,
    failedVerification,
    missingCommit,
    dirtyTargetRepo,
    staleBase,
    violations,
  });
  const mayMerge = violations.length === 0 && !alreadyMerged;

  return {
    mayMerge,
    alreadyMerged,
    status: candidateStatus,
    targetBranch,
    commit,
    ...(mayMerge ? { command: ["git", "merge", "--ff-only", commit] } : {}),
    violations,
  };
}
