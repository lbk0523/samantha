import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BatchPlanDraft } from "./batch-plan-draft";
import { validateBatchPlanDraft } from "./batch-plan-draft";

export const DEFAULT_BATCH_PLAN_DRAFTS_DIR = "references/batch-plans";

export interface BatchPlanDraftStoreInput {
  draftsDir?: string;
}

export interface WriteBatchPlanDraftInput extends BatchPlanDraftStoreInput {
  draft: BatchPlanDraft;
}

export interface BatchPlanDraftSummary {
  draftId: string;
  path: string;
  classification: BatchPlanDraft["classification"];
  promotionReadiness: {
    status: BatchPlanDraft["promotionReadiness"]["status"];
  };
  proposedTaskCount: number;
  blockedPlaceholderCount: number;
}

export interface BatchPlanDraftRecord {
  path: string;
  draft: BatchPlanDraft;
}

export async function writeBatchPlanDraft(input: WriteBatchPlanDraftInput): Promise<BatchPlanDraftRecord> {
  const violations = validateBatchPlanDraft(input.draft);
  if (violations.length > 0) {
    throw new Error(`invalid BatchPlanDraft ${draftIdForError(input.draft)}: ${violations.join("; ")}`);
  }

  const draftsDir = resolve(input.draftsDir ?? DEFAULT_BATCH_PLAN_DRAFTS_DIR);
  const path = join(draftsDir, `${input.draft.draftId}.json`);
  await mkdir(draftsDir, { recursive: true });

  try {
    await writeFile(path, `${JSON.stringify(input.draft, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`batch plan draft already exists: ${input.draft.draftId}`);
    }
    throw err;
  }

  return { path, draft: input.draft };
}

export async function listBatchPlanDrafts(input: BatchPlanDraftStoreInput = {}): Promise<BatchPlanDraftSummary[]> {
  const records = await readBatchPlanDraftRecords(input);
  return records.map(({ path, draft }) => ({
    draftId: draft.draftId,
    path,
    classification: draft.classification,
    promotionReadiness: {
      status: draft.promotionReadiness.status,
    },
    proposedTaskCount: draft.proposedTasks.length,
    blockedPlaceholderCount: draft.structuredPlaceholders.filter((placeholder) => placeholder.blocksPromotion).length,
  }));
}

export async function readBatchPlanDraftById(
  input: BatchPlanDraftStoreInput & { draftId: string },
): Promise<BatchPlanDraft> {
  return (await readBatchPlanDraftRecordById(input)).draft;
}

export async function readBatchPlanDraftRecordById(
  input: BatchPlanDraftStoreInput & { draftId: string },
): Promise<BatchPlanDraftRecord> {
  const records = await readBatchPlanDraftRecords(input);
  const record = records.find((item) => item.draft.draftId === input.draftId);
  if (!record) {
    throw new Error(`batch plan draft not found: ${input.draftId}`);
  }
  return record;
}

async function readBatchPlanDraftRecords(input: BatchPlanDraftStoreInput): Promise<BatchPlanDraftRecord[]> {
  const draftsDir = resolve(input.draftsDir ?? DEFAULT_BATCH_PLAN_DRAFTS_DIR);
  const filePaths = await listBatchPlanDraftJsonFiles(draftsDir);
  const records: BatchPlanDraftRecord[] = [];

  for (const path of filePaths) {
    records.push(await readBatchPlanDraftRecord(path));
  }

  assertUniqueDraftIds(records);
  return records.sort(compareBatchPlanDraftRecords);
}

async function listBatchPlanDraftJsonFiles(draftsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(draftsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => join(draftsDir, entry.name))
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function readBatchPlanDraftRecord(path: string): Promise<BatchPlanDraftRecord> {
  const draft = parseBatchPlanDraftJson(await readFile(path, "utf8"), path);
  assertValidStoredBatchPlanDraft(draft, path);
  return { path, draft: draft as BatchPlanDraft };
}

function parseBatchPlanDraftJson(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid BatchPlanDraft JSON at ${path}: ${(err as Error).message}`);
  }
}

function assertValidStoredBatchPlanDraft(draft: unknown, path: string): void {
  const violations = validateBatchPlanDraft(draft as BatchPlanDraft);
  if (violations.length > 0) {
    throw new Error(`invalid stored BatchPlanDraft at ${path}: ${violations.join("; ")}`);
  }
}

function assertUniqueDraftIds(records: BatchPlanDraftRecord[]): void {
  const pathsByDraftId = new Map<string, string[]>();
  for (const record of records) {
    pathsByDraftId.set(record.draft.draftId, [...(pathsByDraftId.get(record.draft.draftId) ?? []), record.path]);
  }

  const duplicates = [...pathsByDraftId.entries()]
    .filter(([, paths]) => paths.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  if (duplicates.length === 0) return;

  const detail = duplicates
    .map(([draftId, paths]) => `${draftId}: ${paths.sort().join(", ")}`)
    .join("; ");
  throw new Error(`duplicate draftId in BatchPlanDraft store: ${detail}`);
}

function compareBatchPlanDraftRecords(left: BatchPlanDraftRecord, right: BatchPlanDraftRecord): number {
  return left.draft.draftId.localeCompare(right.draft.draftId) || left.path.localeCompare(right.path);
}

function draftIdForError(draft: BatchPlanDraft): string {
  return typeof draft.draftId === "string" && draft.draftId.trim().length > 0 ? draft.draftId : "(missing draftId)";
}
