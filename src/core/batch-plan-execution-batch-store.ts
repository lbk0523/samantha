import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ExecutionBatchSpecAssemblyDryRunResult } from "./batch-plan-execution-batch-assembly";
import { type BatchSpec, validateMinimalBatchSpec } from "./batch-spec";
import { git } from "./git";

export type ExecutionBatchSpecStoreLocation = "outside_target_repo" | "ignored_in_target_repo";

export interface WriteExecutionBatchSpecInput {
  executionBatchesDir: string;
  dryRun: ExecutionBatchSpecAssemblyDryRunResult;
}

export interface ExecutionBatchSpecStoreInput {
  executionBatchesDir: string;
}

export interface ExecutionBatchSpecRecord {
  batchId: string;
  path: string;
  batchSpec: BatchSpec;
  storeLocation: ExecutionBatchSpecStoreLocation;
}

export async function writeExecutionBatchSpec(
  input: WriteExecutionBatchSpecInput,
): Promise<ExecutionBatchSpecRecord> {
  const batchSpec = batchSpecFromDryRun(input.dryRun);
  validateExecutionBatchSpec(batchSpec, "candidate");

  const executionBatchesDir = resolve(input.executionBatchesDir);
  const path = resolve(executionBatchesDir, `${batchSpec.batchId}.json`);
  assertPathInsideDir(path, executionBatchesDir);
  const storeLocation = await classifyStoreLocation({ executionBatchesDir, path, repoRoot: batchSpec.repoRoot });

  await mkdir(executionBatchesDir, { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(batchSpec, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Execution BatchSpec already exists: ${path}`);
    }
    throw err;
  }

  return { batchId: batchSpec.batchId, path, batchSpec, storeLocation };
}

export async function listExecutionBatchSpecs(
  input: ExecutionBatchSpecStoreInput,
): Promise<ExecutionBatchSpecRecord[]> {
  const records = await readExecutionBatchSpecRecords(input);
  return records.sort(compareExecutionBatchSpecRecords);
}

export async function readExecutionBatchSpecById(
  input: ExecutionBatchSpecStoreInput & { batchId: string },
): Promise<BatchSpec> {
  return (await readExecutionBatchSpecRecordById(input)).batchSpec;
}

export async function readExecutionBatchSpecRecordById(
  input: ExecutionBatchSpecStoreInput & { batchId: string },
): Promise<ExecutionBatchSpecRecord> {
  const records = await readExecutionBatchSpecRecords(input);
  const record = records.find((item) => item.batchId === input.batchId);
  if (record === undefined) {
    throw new Error(`execution BatchSpec not found: ${input.batchId}`);
  }
  return record;
}

async function readExecutionBatchSpecRecords(
  input: ExecutionBatchSpecStoreInput,
): Promise<ExecutionBatchSpecRecord[]> {
  const executionBatchesDir = resolve(input.executionBatchesDir);
  const paths = await listExecutionBatchJsonFiles(executionBatchesDir);
  const records = await Promise.all(paths.map((path) => readExecutionBatchSpecRecord(executionBatchesDir, path)));
  assertUniqueBatchIds(records);
  return records;
}

async function listExecutionBatchJsonFiles(executionBatchesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(executionBatchesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(executionBatchesDir, entry.name))
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function readExecutionBatchSpecRecord(
  executionBatchesDir: string,
  path: string,
): Promise<ExecutionBatchSpecRecord> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    throw new Error(`Execution BatchSpec JSON invalid: ${path}: ${(err as Error).message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Execution BatchSpec JSON must be an object: ${path}`);
  }

  const batchSpec = parsed as unknown as BatchSpec;
  validateExecutionBatchSpec(batchSpec, path);
  const storeLocation = await classifyStoreLocation({ executionBatchesDir, path, repoRoot: batchSpec.repoRoot });
  return { batchId: batchSpec.batchId, path, batchSpec, storeLocation };
}

function batchSpecFromDryRun(dryRun: ExecutionBatchSpecAssemblyDryRunResult): BatchSpec {
  if (dryRun.mayAssembleExecutionBatch && dryRun.batchSpec !== null) {
    return dryRun.batchSpec;
  }

  const detail = dryRun.violations.length > 0
    ? dryRun.violations.join("; ")
    : "mayAssembleExecutionBatch was false or batchSpec was missing";
  throw new Error(`Execution BatchSpec dry-run blocked write: ${detail}`);
}

function validateExecutionBatchSpec(batchSpec: BatchSpec, label: string): void {
  if (!isNonEmptyString(batchSpec.repoRoot)) {
    throw new Error(`Execution BatchSpec failed minimal validation: ${label}: repoRoot must be a non-empty string`);
  }

  let violations: string[];
  try {
    violations = validateMinimalBatchSpec(batchSpec);
  } catch (err) {
    violations = [`BatchSpec shape is invalid: ${(err as Error).message}`];
  }

  if (violations.length > 0) {
    throw new Error(`Execution BatchSpec failed minimal validation: ${label}: ${violations.join("; ")}`);
  }
}

async function classifyStoreLocation(input: {
  executionBatchesDir: string;
  path: string;
  repoRoot: string;
}): Promise<ExecutionBatchSpecStoreLocation> {
  const repoRoot = resolve(input.repoRoot);
  const executionBatchesDir = resolve(input.executionBatchesDir);
  const path = resolve(input.path);
  const repoRelativePath = relative(repoRoot, path).replaceAll("\\", "/");

  if (isOutside(repoRelativePath)) {
    return "outside_target_repo";
  }

  const repoRelativeDir = relative(repoRoot, executionBatchesDir).replaceAll("\\", "/");
  if (isReferencesBatchSpecsPath(repoRelativePath) || isReferencesBatchSpecsPath(repoRelativeDir)) {
    throw new Error(`Execution BatchSpec store must not use references/batch-specs: ${repoRelativePath}`);
  }

  if (!(await isGitIgnored(repoRoot, repoRelativePath))) {
    throw new Error(`Execution BatchSpec store must be outside repoRoot or git-ignored: ${repoRelativePath}`);
  }

  return "ignored_in_target_repo";
}

async function isGitIgnored(repoRoot: string, repoRelativePath: string): Promise<boolean> {
  try {
    await git(["check-ignore", "--quiet", "--", repoRelativePath], repoRoot);
    return true;
  } catch {
    return false;
  }
}

function assertPathInsideDir(path: string, dir: string): void {
  const dirRelativePath = relative(dir, path);
  if (dirRelativePath === "" || dirRelativePath.startsWith("..") || isAbsolute(dirRelativePath)) {
    throw new Error(`Execution BatchSpec write path escapes executionBatchesDir: ${path}`);
  }
}

function assertUniqueBatchIds(records: ExecutionBatchSpecRecord[]): void {
  const pathsByBatchId = new Map<string, string[]>();
  for (const record of records) {
    pathsByBatchId.set(record.batchId, [...(pathsByBatchId.get(record.batchId) ?? []), record.path]);
  }

  const duplicates = [...pathsByBatchId.entries()]
    .filter(([, paths]) => paths.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  if (duplicates.length === 0) return;

  const detail = duplicates
    .map(([batchId, paths]) => `${batchId}: ${paths.sort().join(", ")}`)
    .join("; ");
  throw new Error(`duplicate batchId in execution BatchSpec store: ${detail}`);
}

function compareExecutionBatchSpecRecords(
  left: ExecutionBatchSpecRecord,
  right: ExecutionBatchSpecRecord,
): number {
  return left.batchId.localeCompare(right.batchId) || left.path.localeCompare(right.path);
}

function isReferencesBatchSpecsPath(path: string): boolean {
  return path === "references/batch-specs" || path.startsWith("references/batch-specs/");
}

function isOutside(repoRelativePath: string): boolean {
  return repoRelativePath.startsWith("../") || repoRelativePath === ".." || isAbsolute(repoRelativePath);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
