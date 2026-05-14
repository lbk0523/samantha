import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { validateMinimalBatchSpec, type BatchSpec } from "./batch-spec";
import type { BatchSpecMutationAuthority } from "./batch-spec-mutation";
import type { BatchStaleBaseReplanEvidence } from "./batch-replan";

export interface BatchSpecReplacementEvidence {
  schemaVersion: 1;
  operation: "create_replacement";
  authority: BatchSpecMutationAuthority;
  sourceBatchSpecMutation: "not_performed";
  sourceBatchId: string;
  sourceBatchPath: string;
  sourceBaseCommit: string;
  observedHead: string;
  replanEvidencePath: string;
  replacementBatchId: string;
  replacementPath: string;
  createdAt: string;
}

export interface CreateReplacementBatchSpecInput {
  sourceBatchPath: string;
  replacementBatchId: string;
  replacementPath: string;
  replanEvidencePath: string;
  authority: string;
  stateDir?: string;
  createdAt?: string;
}

export interface CreateReplacementBatchSpecResult {
  replacementPath: string;
  auditPath: string;
  evidence: BatchSpecReplacementEvidence;
  spec: BatchSpec;
}

const SAMANTHA_REPLACEMENT_AUTHORITIES = new Set<BatchSpecMutationAuthority>([
  "samantha_api",
  "samantha_cli",
]);

export function batchReplacementAuditPath(stateDir: string): string {
  return join(resolve(stateDir), "batch-replacement-audit.jsonl");
}

export async function createReplacementBatchSpec(
  input: CreateReplacementBatchSpecInput,
): Promise<CreateReplacementBatchSpecResult> {
  if (!SAMANTHA_REPLACEMENT_AUTHORITIES.has(input.authority as BatchSpecMutationAuthority)) {
    throw new Error(`BatchSpec replacement generation must be Samantha-owned: ${input.authority}`);
  }

  const sourceBatchPath = resolve(input.sourceBatchPath);
  const replacementPath = resolve(input.replacementPath);
  const replanEvidencePath = resolve(input.replanEvidencePath);
  if (sourceBatchPath === replacementPath) {
    throw new Error("replacement BatchSpec path must differ from source BatchSpec path");
  }

  const sourceSpec = JSON.parse(await readFile(sourceBatchPath, "utf8")) as BatchSpec;
  const sourceViolations = validateMinimalBatchSpec(sourceSpec);
  if (sourceViolations.length > 0) {
    throw new Error(`source BatchSpec must validate before replacement generation: ${sourceViolations.join("; ")}`);
  }

  const replanEvidence = await findReplacementReplanEvidence({
    replanEvidencePath,
    sourceSpec,
  });
  const nextSpec = resetForReplacement({
    sourceSpec,
    replacementBatchId: input.replacementBatchId,
    observedHead: replanEvidence.observedHead,
  });
  const replacementViolations = validateMinimalBatchSpec(nextSpec);
  if (replacementViolations.length > 0) {
    throw new Error(`replacement BatchSpec must validate: ${replacementViolations.join("; ")}`);
  }

  const stateDir = resolve(input.stateDir ?? join(resolve(nextSpec.repoRoot), "runs"));
  const auditPath = batchReplacementAuditPath(stateDir);
  const evidence: BatchSpecReplacementEvidence = {
    schemaVersion: 1,
    operation: "create_replacement",
    authority: input.authority as BatchSpecMutationAuthority,
    sourceBatchSpecMutation: "not_performed",
    sourceBatchId: sourceSpec.batchId,
    sourceBatchPath,
    sourceBaseCommit: sourceSpec.baseCommit,
    observedHead: replanEvidence.observedHead,
    replanEvidencePath,
    replacementBatchId: nextSpec.batchId,
    replacementPath,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  await mkdir(dirname(replacementPath), { recursive: true });
  await mkdir(stateDir, { recursive: true });
  await writeFile(replacementPath, `${JSON.stringify(nextSpec, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await appendFile(auditPath, `${JSON.stringify(evidence)}\n`, "utf8");

  return { replacementPath, auditPath, evidence, spec: nextSpec };
}

function resetForReplacement(input: {
  sourceSpec: BatchSpec;
  replacementBatchId: string;
  observedHead: string;
}): BatchSpec {
  return {
    ...input.sourceSpec,
    batchId: input.replacementBatchId,
    baseCommit: input.observedHead,
    status: "planned",
    tasks: input.sourceSpec.tasks.map((task) => {
      const { runLogPath: _runLogPath, candidateCommit: _candidateCommit, ...plannedTask } = task;
      return { ...plannedTask, status: "planned" };
    }),
    integrationQueue: input.sourceSpec.integrationQueue.map((item) => {
      const { expectedCandidateCommit: _expectedCandidateCommit, ...pendingItem } = item;
      return { ...pendingItem, status: "pending" };
    }),
  };
}

async function findReplacementReplanEvidence(input: {
  replanEvidencePath: string;
  sourceSpec: BatchSpec;
}): Promise<BatchStaleBaseReplanEvidence> {
  const lines = (await readFile(input.replanEvidencePath, "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const matches = lines
    .map((line) => JSON.parse(line) as BatchStaleBaseReplanEvidence)
    .filter((evidence) => isMatchingReplanEvidence(evidence, input.sourceSpec));

  const evidence = matches.at(-1);
  if (!evidence) {
    throw new Error(
      `no block_and_replan evidence found for source batch ${input.sourceSpec.batchId} at base ${input.sourceSpec.baseCommit}`,
    );
  }
  return evidence;
}

function isMatchingReplanEvidence(
  evidence: BatchStaleBaseReplanEvidence,
  sourceSpec: BatchSpec,
): boolean {
  return (
    evidence.schemaVersion === 1 &&
    evidence.batchId === sourceSpec.batchId &&
    evidence.policy === "block_and_replan" &&
    evidence.decision === "blocked_for_replan" &&
    evidence.sourceBaseCommit === sourceSpec.baseCommit &&
    evidence.sourceBatchSpecMutation === "not_performed" &&
    evidence.replanArtifactPath === null &&
    typeof evidence.observedHead === "string"
  );
}
