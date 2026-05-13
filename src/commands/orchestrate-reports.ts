import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentProfile, TaskSpec } from "../core/contracts";
import { RunIndex, summarizeWorkerRun, type RunSummary } from "../core/ledger";
import { summarizeReportOnlyReviews, type ReportReviewSummary } from "../core/report-review";
import { writeWorkerRunLog, type WorkerRunLogInput, type WorkerRunLogWrite } from "../core/run-log";
import { validateDispatch } from "../core/policy";
import { executeWorkerDispatch } from "../core/worker-dispatch";

export interface OrchestrateReportOnlyReviewsInput {
  taskPaths: string[];
  repoRoot: string;
  agentPath?: string;
  runsDir?: string;
  codexBin?: string;
}

export interface OrchestratedReportRun {
  taskId: string;
  runLog: WorkerRunLogWrite;
  runSummary: RunSummary;
}

export interface OrchestrateReportOnlyReviewsResult {
  schemaVersion: 1;
  mode: "parallel-report-only";
  runs: OrchestratedReportRun[];
  summary: ReportReviewSummary;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function defaultAgentPath(repoRoot: string, task: TaskSpec): string {
  return join(repoRoot, "references", "agent-profiles", `${task.targetAgent}.json`);
}

async function readDispatchPair(input: {
  taskPath: string;
  repoRoot: string;
  agentPath?: string;
}): Promise<{ task: TaskSpec; agent: AgentProfile }> {
  const task = await readJson<TaskSpec>(resolve(input.taskPath));
  const agent = await readJson<AgentProfile>(
    resolve(input.agentPath ?? defaultAgentPath(input.repoRoot, task)),
  );
  const plan = validateDispatch(task, agent);

  if (plan.violations.length > 0) {
    throw new Error(`report-only orchestration blocked for ${task.id}:\n${plan.violations.join("\n")}`);
  }

  return { task, agent };
}

async function runReportDispatch(input: {
  task: TaskSpec;
  agent: AgentProfile;
  repoRoot: string;
  codexBin?: string;
}): Promise<WorkerRunLogInput> {
  const startedAt = new Date().toISOString();
  const execution = await executeWorkerDispatch({
    task: input.task,
    agent: input.agent,
    repoRoot: input.repoRoot,
    codexBin: input.codexBin,
  });
  const finishedAt = new Date().toISOString();

  return {
    task: input.task,
    agent: input.agent,
    repoRoot: input.repoRoot,
    startedAt,
    finishedAt,
    execution,
  };
}

export async function orchestrateReportOnlyReviews(
  input: OrchestrateReportOnlyReviewsInput,
): Promise<OrchestrateReportOnlyReviewsResult> {
  if (input.taskPaths.length < 2) {
    throw new Error("reports:orchestrate requires at least two --task entries");
  }

  const repoRoot = resolve(input.repoRoot);
  const runsDir = resolve(input.runsDir ?? join(repoRoot, "runs"));
  const pairs = await Promise.all(
    input.taskPaths.map((taskPath) =>
      readDispatchPair({
        taskPath,
        repoRoot,
        agentPath: input.agentPath,
      }),
    ),
  );
  const logInputs = await Promise.all(
    pairs.map((pair) =>
      runReportDispatch({
        task: pair.task,
        agent: pair.agent,
        repoRoot,
        codexBin: input.codexBin,
      }),
    ),
  );

  await mkdir(runsDir, { recursive: true });
  const runIndex = new RunIndex(join(runsDir, "index.jsonl"));
  const runs: OrchestratedReportRun[] = [];

  for (const logInput of logInputs) {
    const runLog = await writeWorkerRunLog(runsDir, logInput);
    const runSummary = summarizeWorkerRun({
      ...logInput,
      runId: runLog.runId,
      logPath: runLog.path,
    });
    await runIndex.append(runSummary);
    runs.push({ taskId: logInput.task.id, runLog, runSummary });
  }

  const summary = await summarizeReportOnlyReviews({
    runLogPaths: runs.map((run) => run.runLog.path),
  });

  return {
    schemaVersion: 1,
    mode: "parallel-report-only",
    runs,
    summary,
  };
}
