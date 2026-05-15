import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { RunIndex, type RunSummary } from "./ledger";
import { git, GitError } from "./git";

export type EvidenceAuditStatus = "clear" | "missing" | "stale" | "blocked";

export interface EvidenceAuditCheck {
  id: string;
  status: EvidenceAuditStatus;
  reason: string;
  evidence: string[];
}

export interface CommitEvidenceAudit {
  anchorCommit: string | null;
  auditedCommits: string[];
  runSummaryCommits: string[];
  unevidencedCommits: string[];
  baselinePath: string;
  baselineCoveredCommits: string[];
  unreviewedCommits: string[];
  check: EvidenceAuditCheck;
}

export interface LessonInboxEvidenceAudit {
  inboxPath: string;
  reviewIndexPath: string;
  candidatePaths: string[];
  uncoveredCandidatePaths: string[];
  check: EvidenceAuditCheck;
}

export interface OperationsEvidenceAudit {
  repoRoot: string;
  status: EvidenceAuditStatus;
  commitHistory: CommitEvidenceAudit;
  lessonInbox: LessonInboxEvidenceAudit;
  checks: EvidenceAuditCheck[];
}

export interface AuditOperationsEvidenceInput {
  repoRoot: string;
}

interface LessonInboxReviewIndex {
  candidates?: Array<{
    candidatePath?: string;
  }>;
}

interface EvidenceBaselineCommit {
  commit?: string;
  subject?: string;
}

interface EvidenceBaselineArtifact {
  schemaVersion?: number;
  commits?: EvidenceBaselineCommit[];
}

interface FirstParentCommit {
  commit: string;
  subject: string;
}

function combineStatus(checks: EvidenceAuditCheck[]): EvidenceAuditStatus {
  if (checks.some((check) => check.status === "blocked")) return "blocked";
  if (checks.some((check) => check.status === "stale")) return "stale";
  if (checks.some((check) => check.status === "missing")) return "missing";
  return "clear";
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function shortCommit(commit: string): string {
  return commit.slice(0, 12);
}

function repoRelativePath(repoRoot: string, path: string): string {
  return relative(repoRoot, path).split(sep).join("/");
}

async function firstParentHistory(repoRoot: string): Promise<FirstParentCommit[]> {
  try {
    const out = await git(["log", "--first-parent", "--reverse", "--format=%H%x00%s", "HEAD"], repoRoot);
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [commit, subject = ""] = line.split("\0");
        return { commit, subject };
      });
  } catch (error) {
    if (error instanceof GitError && error.stderr.includes("ambiguous argument 'HEAD'")) {
      return [];
    }
    throw error;
  }
}

function summaryCommits(summaries: RunSummary[]): string[] {
  return Array.from(
    new Set(
      summaries
        .map((summary) => summary.commit.trim())
        .filter((commit) => commit.length > 0),
    ),
  ).sort();
}

async function readEvidenceBaseline(path: string): Promise<EvidenceBaselineArtifact | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as EvidenceBaselineArtifact;
  } catch (error) {
    if (isMissingPath(error)) return null;
    throw error;
  }
}

function baselineCoverage(input: {
  baseline: EvidenceBaselineArtifact | null;
  firstParentSubjects: Map<string, string>;
}): {
  mentionedCommits: Set<string>;
  compatibleCommits: Set<string>;
  problems: string[];
} {
  const mentionedCommits = new Set<string>();
  const compatibleCommits = new Set<string>();
  const problems: string[] = [];
  if (!input.baseline) return { mentionedCommits, compatibleCommits, problems };

  if (input.baseline.schemaVersion !== 1) {
    problems.push("schemaVersion must be 1");
  }
  if (!Array.isArray(input.baseline.commits)) {
    problems.push("commits must be an array");
    return { mentionedCommits, compatibleCommits, problems };
  }

  for (const [index, entry] of input.baseline.commits.entries()) {
    const commit = entry.commit?.trim() ?? "";
    const subject = entry.subject?.trim() ?? "";
    if (!/^[0-9a-f]{40}$/.test(commit)) {
      problems.push(`commits[${index}].commit must be a 40-character lowercase git hash`);
      continue;
    }
    if (mentionedCommits.has(commit)) {
      problems.push(`${shortCommit(commit)} is duplicated in evidence baseline`);
      continue;
    }
    mentionedCommits.add(commit);

    const currentSubject = input.firstParentSubjects.get(commit);
    if (!currentSubject) {
      problems.push(`${shortCommit(commit)} is not on current first-parent history`);
      continue;
    }
    if (subject !== currentSubject) {
      problems.push(`${shortCommit(commit)} subject mismatch`);
      continue;
    }
    compatibleCommits.add(commit);
  }

  return { mentionedCommits, compatibleCommits, problems };
}

async function auditCommitEvidence(repoRoot: string): Promise<CommitEvidenceAudit> {
  const baselinePath = join(repoRoot, "references", "operations", "evidence-baseline.json");
  const runSummaryCommits = summaryCommits(await new RunIndex(join(repoRoot, "runs", "index.jsonl")).list());
  const runSummaryCommitSet = new Set(runSummaryCommits);
  const firstParentEntries = await firstParentHistory(repoRoot);
  const firstParentSubjects = new Map(firstParentEntries.map((entry) => [entry.commit, entry.subject]));
  const firstParentCommits = firstParentEntries.map((entry) => entry.commit);
  const anchorIndex = firstParentCommits.findIndex((commit) => runSummaryCommitSet.has(commit));

  if (firstParentCommits.length === 0) {
    return {
      anchorCommit: null,
      auditedCommits: [],
      runSummaryCommits,
      unevidencedCommits: [],
      baselinePath,
      baselineCoveredCommits: [],
      unreviewedCommits: [],
      check: {
        id: "operations.evidence.commit-history",
        status: "missing",
        reason: "no first-parent commits exist to audit",
        evidence: runSummaryCommits.map(shortCommit),
      },
    };
  }

  const auditedCommits = anchorIndex === -1 ? firstParentCommits : firstParentCommits.slice(anchorIndex);
  const unevidencedCommits = auditedCommits.filter((commit) => !runSummaryCommitSet.has(commit));
  const anchorCommit = anchorIndex === -1 ? null : (firstParentCommits[anchorIndex] ?? null);
  const baseline = await readEvidenceBaseline(baselinePath);
  const baselineAudit = baselineCoverage({ baseline, firstParentSubjects });
  const unreviewedCommits = unevidencedCommits.filter((commit) => !baselineAudit.mentionedCommits.has(commit));
  const baselineCoveredCommits = unevidencedCommits.filter((commit) => baselineAudit.compatibleCommits.has(commit));

  let status: EvidenceAuditStatus = "clear";
  let reason =
    anchorCommit === null
      ? "all first-parent commits have run summary evidence or reviewed baseline coverage"
      : `all first-parent commits since ${shortCommit(anchorCommit)} have run summary evidence or reviewed baseline coverage`;
  let evidence = baselineCoveredCommits.map(shortCommit);

  if (unreviewedCommits.length > 0) {
    status = "blocked";
    reason = "first-parent history has commits without run summary evidence or reviewed baseline coverage";
    evidence = unreviewedCommits.map(shortCommit);
  } else if (baselineAudit.problems.length > 0 && unevidencedCommits.length > 0) {
    status = "stale";
    reason = "historical evidence baseline is stale or mismatched";
    evidence = baselineAudit.problems;
  } else if (baselineCoveredCommits.length > 0) {
    reason = "historical first-parent evidence gaps are covered by reviewed baseline";
  }

  return {
    anchorCommit,
    auditedCommits,
    runSummaryCommits,
    unevidencedCommits,
    baselinePath,
    baselineCoveredCommits,
    unreviewedCommits,
    check: {
      id: "operations.evidence.commit-history",
      status,
      reason,
      evidence,
    },
  };
}

async function listLessonCandidates(inboxPath: string): Promise<string[]> {
  try {
    const entries = await readdir(inboxPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => join(inboxPath, entry.name))
      .sort();
  } catch (error) {
    if (isMissingPath(error)) return [];
    throw error;
  }
}

async function readReviewIndex(path: string): Promise<LessonInboxReviewIndex | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as LessonInboxReviewIndex;
  } catch (error) {
    if (isMissingPath(error)) return null;
    throw error;
  }
}

function candidateKeys(repoRoot: string, path: string): string[] {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(repoRoot, path);
  return [absolute, repoRelativePath(repoRoot, absolute)];
}

async function auditLessonInboxEvidence(repoRoot: string): Promise<LessonInboxEvidenceAudit> {
  const inboxPath = join(repoRoot, "references", "lessons", "inbox");
  const reviewIndexPath = join(repoRoot, "references", "lessons", "reviews", "index.json");
  const candidatePaths = await listLessonCandidates(inboxPath);
  const candidateEvidence = candidatePaths.map((path) => repoRelativePath(repoRoot, path));

  if (candidatePaths.length === 0) {
    return {
      inboxPath,
      reviewIndexPath,
      candidatePaths,
      uncoveredCandidatePaths: [],
      check: {
        id: "operations.evidence.lesson-inbox",
        status: "clear",
        reason: "lesson inbox has no candidates awaiting review coverage",
        evidence: [],
      },
    };
  }

  const index = await readReviewIndex(reviewIndexPath);
  if (!index) {
    return {
      inboxPath,
      reviewIndexPath,
      candidatePaths,
      uncoveredCandidatePaths: candidatePaths,
      check: {
        id: "operations.evidence.lesson-inbox",
        status: "missing",
        reason: "lesson inbox candidates exist but no review index exists",
        evidence: candidateEvidence,
      },
    };
  }

  const covered = new Set(
    (index.candidates ?? []).flatMap((candidate) =>
      candidate.candidatePath ? candidateKeys(repoRoot, candidate.candidatePath) : [],
    ),
  );
  const uncoveredCandidatePaths = candidatePaths.filter((path) =>
    candidateKeys(repoRoot, path).every((key) => !covered.has(key)),
  );

  return {
    inboxPath,
    reviewIndexPath,
    candidatePaths,
    uncoveredCandidatePaths,
    check: {
      id: "operations.evidence.lesson-inbox",
      status: uncoveredCandidatePaths.length === 0 ? "clear" : "stale",
      reason:
        uncoveredCandidatePaths.length === 0
          ? "lesson review index covers current inbox candidates"
          : "lesson review index does not cover current inbox candidates",
      evidence: uncoveredCandidatePaths.map((path) => repoRelativePath(repoRoot, path)),
    },
  };
}

export async function auditOperationsEvidence(
  input: AuditOperationsEvidenceInput,
): Promise<OperationsEvidenceAudit> {
  const repoRoot = resolve(input.repoRoot);
  const commitHistory = await auditCommitEvidence(repoRoot);
  const lessonInbox = await auditLessonInboxEvidence(repoRoot);
  const checks = [commitHistory.check, lessonInbox.check];

  return {
    repoRoot,
    status: combineStatus(checks),
    commitHistory,
    lessonInbox,
    checks,
  };
}
