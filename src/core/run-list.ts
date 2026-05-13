import { dirname, join, resolve } from "node:path";
import { RunIndex, type RunSummary } from "./ledger";
import { RunLifecycleStore, type RunLifecycleRecord } from "./run-lifecycle-store";

export interface RunListInput {
  runsDir?: string;
}

export type RunListItem = RunSummary & {
  lifecycle: RunLifecycleRecord | null;
};

function runIndexPath(runsDir?: string): string {
  return join(resolve(runsDir ?? "runs"), "index.jsonl");
}

function lifecycleStorePath(indexPath: string): string {
  return join(dirname(indexPath), "run-lifecycle.jsonl");
}

export async function listRuns(input: RunListInput = {}): Promise<RunListItem[]> {
  const indexPath = runIndexPath(input.runsDir);
  const summaries = await new RunIndex(indexPath).list();
  const lifecycleByRunId = new Map(
    (await new RunLifecycleStore(lifecycleStorePath(indexPath)).list()).map((record) => [record.runId, record]),
  );

  return summaries.map((summary) => ({
    ...summary,
    lifecycle: lifecycleByRunId.get(summary.runId) ?? null,
  }));
}
