import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BatchSpec } from "./batch-spec";
import { buildProjectContext } from "./project-context";
import { projectPaths } from "./project-paths";

export const DEFAULT_BATCHES_DIR = "references/batch-specs";

export interface BatchSpecStoreInput {
  batchesDir?: string;
  repoRoot?: string;
  stateRoot?: string;
}

export interface BatchSpecSummary {
  batchId: string;
  path: string;
  status: BatchSpec["status"];
  baseCommit: string;
  taskCount: number;
}

export interface BatchSpecRecord {
  path: string;
  spec: BatchSpec;
}

export async function listBatchSpecs(input: BatchSpecStoreInput = {}): Promise<BatchSpecSummary[]> {
  const records = await readBatchSpecRecords(input);
  return records
    .map(({ path, spec }) => ({
      batchId: spec.batchId,
      path,
      status: spec.status,
      baseCommit: spec.baseCommit,
      taskCount: Array.isArray(spec.tasks) ? spec.tasks.length : 0,
    }))
    .sort(compareBatchSummaries);
}

export async function readBatchSpecById(input: BatchSpecStoreInput & { batchId: string }): Promise<BatchSpec> {
  return (await readBatchSpecRecordById(input)).spec;
}

export async function readBatchSpecRecordById(
  input: BatchSpecStoreInput & { batchId: string },
): Promise<BatchSpecRecord> {
  const records = await readBatchSpecRecords(input);
  const record = records.find((item) => item.spec.batchId === input.batchId);
  if (!record) {
    throw new Error(`batch not found: ${input.batchId}`);
  }
  return record;
}

async function readBatchSpecRecords(input: BatchSpecStoreInput): Promise<BatchSpecRecord[]> {
  const batchesDir = await resolveBatchesDir(input);
  const filePaths = await listBatchJsonFiles(batchesDir);
  const records = await Promise.all(filePaths.map(readBatchSpecRecord));
  assertUniqueBatchIds(records);
  return records.sort(compareBatchRecords);
}

async function resolveBatchesDir(input: BatchSpecStoreInput): Promise<string> {
  if (input.batchesDir) return resolve(input.batchesDir);

  const projectContext = await buildProjectContext({
    targetRepoRoot: input.repoRoot,
    ...(input.stateRoot ? { stateRoot: input.stateRoot } : {}),
  });
  return projectPaths.batchesDir(projectContext);
}

async function listBatchJsonFiles(batchesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(batchesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(batchesDir, entry.name))
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function readBatchSpecRecord(path: string): Promise<BatchSpecRecord> {
  const spec = JSON.parse(await readFile(path, "utf8")) as BatchSpec;
  if (typeof spec.batchId !== "string" || spec.batchId.trim().length === 0) {
    throw new Error(`BatchSpec JSON missing batchId: ${path}`);
  }
  return { path, spec };
}

function assertUniqueBatchIds(records: BatchSpecRecord[]): void {
  const pathsByBatchId = new Map<string, string[]>();
  for (const record of records) {
    pathsByBatchId.set(record.spec.batchId, [...(pathsByBatchId.get(record.spec.batchId) ?? []), record.path]);
  }

  const duplicates = [...pathsByBatchId.entries()]
    .filter(([, paths]) => paths.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  if (duplicates.length === 0) return;

  const detail = duplicates
    .map(([batchId, paths]) => `${batchId}: ${paths.sort().join(", ")}`)
    .join("; ");
  throw new Error(`duplicate batchId in BatchSpec store: ${detail}`);
}

function compareBatchRecords(left: BatchSpecRecord, right: BatchSpecRecord): number {
  return left.spec.batchId.localeCompare(right.spec.batchId) || left.path.localeCompare(right.path);
}

function compareBatchSummaries(left: BatchSpecSummary, right: BatchSpecSummary): number {
  return left.batchId.localeCompare(right.batchId) || left.path.localeCompare(right.path);
}
