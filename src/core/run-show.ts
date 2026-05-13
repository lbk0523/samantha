import { dirname, join, resolve } from "node:path";
import { RunIndex, type RunSummary } from "./ledger";
import { readWorkerRunLog } from "./merge-gate";
import { RunLifecycleStore, type RunLifecycleRecord } from "./run-lifecycle-store";
import type { WorkerRunLog } from "./run-log";

export interface RunShowInput {
  runId: string;
  runsDir?: string;
}

export interface RunShowResult {
  summary: RunSummary;
  log: WorkerRunLog;
  lifecycle: RunLifecycleRecord | null;
}

function runIndexPath(runsDir?: string): string {
  return join(resolve(runsDir ?? "runs"), "index.jsonl");
}

function lifecycleStorePath(runLogPath: string): string {
  return join(dirname(resolve(runLogPath)), "run-lifecycle.jsonl");
}

export async function showRun(input: RunShowInput): Promise<RunShowResult> {
  const summary = await new RunIndex(runIndexPath(input.runsDir)).find(input.runId);
  if (!summary) throw new Error(`run not found: ${input.runId}`);

  const log = await readWorkerRunLog(summary.logPath);
  const lifecycle = await new RunLifecycleStore(lifecycleStorePath(summary.logPath)).find(summary.runId);

  return {
    summary,
    log,
    lifecycle: lifecycle ?? null,
  };
}
