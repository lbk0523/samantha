import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditOperationsEvidence } from "../src/core/evidence-audit";
import { git, gitHead } from "../src/core/git";
import { RunIndex, type RunSummary } from "../src/core/ledger";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

async function initRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-evidence-audit-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  return root;
}

async function commitFixture(root: string, subject: string): Promise<string> {
  await writeFile(join(root, "fixture.txt"), `${subject}\n`, "utf8");
  await git(["add", "fixture.txt"], root);
  await git(["commit", "-m", subject], root);
  return gitHead(root);
}

function runSummary(root: string, runId: string, commit: string): RunSummary {
  return {
    schemaVersion: 1,
    runId,
    taskId: runId,
    taskTitle: `Task ${runId}`,
    agentId: "codex-worker",
    repoRoot: root,
    worktreePath: join(root, "worktrees", runId),
    logPath: join(root, "runs", `${runId}.json`),
    startedAt: "2026-05-15T10:00:00.000Z",
    finishedAt: "2026-05-15T10:01:00.000Z",
    outcome: "pass",
    pass: true,
    commit,
  };
}

async function appendRunSummary(root: string, runId: string, commit: string): Promise<void> {
  await new RunIndex(join(root, "runs", "index.jsonl")).append(runSummary(root, runId, commit));
}

async function initRepoWithRunEvidence(): Promise<{ root: string; commit: string }> {
  const root = await initRepo();
  const commit = await commitFixture(root, "feat: run-backed fixture");
  await appendRunSummary(root, "run-backed-fixture", commit);
  return { root, commit };
}

describe("auditOperationsEvidence", () => {
  test("clears commit evidence when every audited first-parent commit has a run summary", async () => {
    const root = await initRepo();
    const first = await commitFixture(root, "feat: first run-backed change");
    const second = await commitFixture(root, "feat: second run-backed change");
    await appendRunSummary(root, "run-1", first);
    await appendRunSummary(root, "run-2", second);

    const audit = await auditOperationsEvidence({ repoRoot: root });

    expect(audit.status).toBe("clear");
    expect(audit.commitHistory.anchorCommit).toBe(first);
    expect(audit.commitHistory.auditedCommits).toEqual([first, second]);
    expect(audit.commitHistory.unevidencedCommits).toEqual([]);
    expect(audit.commitHistory.check.status).toBe("clear");
  });

  test("blocks commit evidence when a first-parent commit lacks a run summary", async () => {
    const root = await initRepo();
    const first = await commitFixture(root, "feat: run-backed change");
    const unevidenced = await commitFixture(root, "chore: manual change");
    await appendRunSummary(root, "run-1", first);

    const audit = await auditOperationsEvidence({ repoRoot: root });

    expect(audit.status).toBe("blocked");
    expect(audit.commitHistory.check.status).toBe("blocked");
    expect(audit.commitHistory.unevidencedCommits).toEqual([unevidenced]);
  });

  test("does not audit commits before the first reachable run-backed commit", async () => {
    const root = await initRepo();
    await commitFixture(root, "chore: pre-samantha history");
    const runBacked = await commitFixture(root, "feat: run-backed change");
    await appendRunSummary(root, "run-1", runBacked);

    const audit = await auditOperationsEvidence({ repoRoot: root });

    expect(audit.status).toBe("clear");
    expect(audit.commitHistory.anchorCommit).toBe(runBacked);
    expect(audit.commitHistory.auditedCommits).toEqual([runBacked]);
  });

  test("marks commit evidence missing when no run summary commit is reachable", async () => {
    const root = await initRepo();
    await commitFixture(root, "chore: manual change");

    const audit = await auditOperationsEvidence({ repoRoot: root });

    expect(audit.status).toBe("missing");
    expect(audit.commitHistory.check.status).toBe("missing");
    expect(audit.commitHistory.anchorCommit).toBeNull();
  });

  test("marks lesson inbox evidence missing when candidates exist without a review index", async () => {
    const { root } = await initRepoWithRunEvidence();
    const candidateDir = join(root, "references", "lessons", "inbox");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(join(candidateDir, "run-1.md"), "# Lesson Candidate: run-1\n", "utf8");

    const audit = await auditOperationsEvidence({ repoRoot: root });

    expect(audit.status).toBe("missing");
    expect(audit.lessonInbox.check.status).toBe("missing");
    expect(audit.lessonInbox.uncoveredCandidatePaths).toEqual([join(candidateDir, "run-1.md")]);
  });

  test("marks lesson inbox evidence stale when the review index misses current candidates", async () => {
    const { root } = await initRepoWithRunEvidence();
    const candidateDir = join(root, "references", "lessons", "inbox");
    const reviewDir = join(root, "references", "lessons", "reviews");
    const candidatePath = join(candidateDir, "run-1.md");
    await mkdir(candidateDir, { recursive: true });
    await mkdir(reviewDir, { recursive: true });
    await writeFile(candidatePath, "# Lesson Candidate: run-1\n", "utf8");
    await writeFile(
      join(reviewDir, "index.json"),
      `${JSON.stringify({ schemaVersion: 1, candidates: [{ candidatePath: join(candidateDir, "old.md") }] })}\n`,
      "utf8",
    );

    const audit = await auditOperationsEvidence({ repoRoot: root });

    expect(audit.status).toBe("stale");
    expect(audit.lessonInbox.check.status).toBe("stale");
    expect(audit.lessonInbox.uncoveredCandidatePaths).toEqual([candidatePath]);
  });

  test("clears lesson inbox evidence when current candidates are covered", async () => {
    const { root } = await initRepoWithRunEvidence();
    const candidateDir = join(root, "references", "lessons", "inbox");
    const reviewDir = join(root, "references", "lessons", "reviews");
    const candidatePath = join(candidateDir, "run-1.md");
    await mkdir(candidateDir, { recursive: true });
    await mkdir(reviewDir, { recursive: true });
    await writeFile(candidatePath, "# Lesson Candidate: run-1\n", "utf8");
    await writeFile(
      join(reviewDir, "index.json"),
      `${JSON.stringify({ schemaVersion: 1, candidates: [{ candidatePath }] })}\n`,
      "utf8",
    );

    const audit = await auditOperationsEvidence({ repoRoot: root });

    expect(audit.status).toBe("clear");
    expect(audit.lessonInbox.check.status).toBe("clear");
    expect(audit.lessonInbox.uncoveredCandidatePaths).toEqual([]);
  });
});
