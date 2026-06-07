import { afterEach, describe, expect, test } from "bun:test";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { orchestrateReportOnlyReviews } from "../src/commands/orchestrate-reports";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { buildProjectContext } from "../src/core/project-context";
import { projectPaths } from "../src/core/project-paths";
import type { WorkerRunLog } from "../src/core/run-log";
import { git } from "../src/core/git";

let tmpRoots: string[] = [];

const reviewer: AgentProfile = {
  id: "codex-reviewer",
  role: "reviewer",
  model: "gpt-5.5",
  writerClass: "non-writer",
  worktreePolicy: "none",
  mergePolicy: "none",
  skillPolicy: {
    requiredBundles: [],
    blockedSkills: [
      "using-git-worktrees",
      "dispatching-parallel-agents",
      "subagent-driven-development",
    ],
  },
};

function reportTask(id: string): TaskSpec {
  return {
    id,
    title: `Review ${id}`,
    taskFamily: "report-review",
    workMode: "diagnosis-first",
    riskClass: "routine",
    targetAgent: "codex-reviewer",
    targetFiles: [],
    forbiddenChanges: ["**/*"],
    verifyCommands: [],
    instructions: "Review evidence and report only.",
    resultMode: "report",
    status: "pending",
  };
}

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-report-orchestration-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, "README.md"), "base\n", "utf8");
  await git(["add", "README.md"], root);
  await git(["commit", "-m", "chore: initial fixture"], root);
  return root;
}

async function makeWorkspaceRepo(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-report-workspace-"));
  tmpRoots.push(root);
  const repo = join(root, "agent-workspace", "repos", name);
  await mkdir(repo, { recursive: true });
  await git(["init"], repo);
  await git(["config", "user.email", "samantha@example.local"], repo);
  await git(["config", "user.name", "Samantha Test"], repo);
  await writeFile(join(repo, "README.md"), "base\n", "utf8");
  await git(["add", "README.md"], repo);
  await git(["commit", "-m", "chore: initial fixture"], repo);
  return repo;
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

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function makeBarrierCodex(markerPath: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-fake-codex-"));
  tmpRoots.push(root);
  const path = join(root, "fake-codex");
  await writeFile(
    path,
    [
      "#!/usr/bin/env bash",
      `marker=${JSON.stringify(markerPath)}`,
      'printf "start\\n" >> "$marker"',
      "for _ in $(seq 1 40); do",
      '  count=$(grep -c "^start$" "$marker" 2>/dev/null || true)',
      '  if [ "$count" -ge 2 ]; then break; fi',
      "  sleep 0.05",
      "done",
      'count=$(grep -c "^start$" "$marker" 2>/dev/null || true)',
      'if [ "$count" -lt 2 ]; then echo "parallel barrier timed out" >&2; exit 42; fi',
      'echo "Review: report-only evidence inspected."',
      `echo 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}'`,
      "",
    ].join("\n"),
    "utf8",
  );
  await chmod(path, 0o755);
  return path;
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("report-only orchestration", () => {
  test("runs multiple report-only reviewers in one explicit parallel orchestration", async () => {
    const repo = await makeRepo();
    const fixtureDir = await mkdtemp(join(tmpdir(), "samantha-report-fixtures-"));
    tmpRoots.push(fixtureDir);
    const agentPath = join(fixtureDir, "codex-reviewer.json");
    const taskAPath = join(fixtureDir, "review-a.json");
    const taskBPath = join(fixtureDir, "review-b.json");
    const markerPath = join(fixtureDir, "starts.txt");
    const runsDir = join(fixtureDir, "runs");
    const fakeCodex = await makeBarrierCodex(markerPath);

    await writeJson(agentPath, reviewer);
    await writeJson(taskAPath, reportTask("review-a"));
    await writeJson(taskBPath, reportTask("review-b"));

    const result = await orchestrateReportOnlyReviews({
      taskPaths: [taskAPath, taskBPath],
      repoRoot: repo,
      agentPath,
      runsDir,
      codexBin: fakeCodex,
    });

    expect(result.mode).toBe("parallel-report-only");
    expect(result.runs.map((run) => run.taskId).sort()).toEqual(["review-a", "review-b"]);
    expect(result.summary.acceptedReportCount).toBe(2);
    expect(result.summary.rejectedReportCount).toBe(0);
    expect(result.summary.decisionPoint).toMatchObject({
      owner: "samantha",
      reviewerAuthority: "advice-only",
      trustedStateChanges: false,
      recommendation: "review_reports",
    });

    const logs = await Promise.all(
      result.runs.map(async (run) => JSON.parse(await readFile(run.runLog.path, "utf8")) as WorkerRunLog),
    );
    for (const log of logs) {
      expect(log.agent.writerClass).toBe("non-writer");
      expect(log.task.resultMode).toBe("report");
      expect(log.result.preparation.allocation).toBeUndefined();
      expect(log.result.setupResults).toEqual([]);
      expect(log.result.evaluation?.verifyResults).toEqual([]);
      expect(log.result.evaluation?.changedFiles).toEqual([]);
      expect(log.result.commit).toBeUndefined();
    }

    const indexLines = (await readFile(join(runsDir, "index.jsonl"), "utf8")).trim().split("\n");
    expect(indexLines).toHaveLength(2);
  });

  test("defaults report run evidence to project-scoped state", async () => {
    const repo = await makeWorkspaceRepo("review-app");
    const fixtureDir = await mkdtemp(join(tmpdir(), "samantha-report-fixtures-"));
    tmpRoots.push(fixtureDir);
    const taskAPath = join(fixtureDir, "review-a.json");
    const taskBPath = join(fixtureDir, "review-b.json");
    const markerPath = join(fixtureDir, "starts.txt");
    const fakeCodex = await makeBarrierCodex(markerPath);
    await writeJson(taskAPath, reportTask("review-a"));
    await writeJson(taskBPath, reportTask("review-b"));

    const projectContext = await buildProjectContext({ targetRepoRoot: repo });
    const result = await orchestrateReportOnlyReviews({
      taskPaths: [taskAPath, taskBPath],
      repoRoot: repo,
      codexBin: fakeCodex,
    });

    expect(result.runs.map((run) => run.taskId).sort()).toEqual(["review-a", "review-b"]);
    expect(result.runs.every((run) => run.runLog.path.startsWith(projectPaths.runsDir(projectContext)))).toBe(
      true,
    );
    expect(await readFile(projectPaths.runIndexPath(projectContext), "utf8")).toContain("review-a");
    expect(await pathExists(join(repo, "runs"))).toBe(false);
  });

  test("blocks the whole orchestration before dispatch when any task is not report-only", async () => {
    const repo = await makeRepo();
    const fixtureDir = await mkdtemp(join(tmpdir(), "samantha-report-fixtures-"));
    tmpRoots.push(fixtureDir);
    const agentPath = join(fixtureDir, "codex-reviewer.json");
    const validTaskPath = join(fixtureDir, "review-valid.json");
    const invalidTaskPath = join(fixtureDir, "review-invalid.json");
    const markerPath = join(fixtureDir, "starts.txt");
    const fakeCodex = await makeBarrierCodex(markerPath);

    await writeJson(agentPath, reviewer);
    await writeJson(validTaskPath, reportTask("review-valid"));
    await writeJson(invalidTaskPath, { ...reportTask("review-invalid"), resultMode: "write" });

    await expect(
      orchestrateReportOnlyReviews({
        taskPaths: [validTaskPath, invalidTaskPath],
        repoRoot: repo,
        agentPath,
        runsDir: join(fixtureDir, "runs"),
        codexBin: fakeCodex,
      }),
    ).rejects.toThrow("non-writer tasks must use report resultMode");

    await expect(readFile(markerPath, "utf8")).rejects.toThrow();
  });
});
