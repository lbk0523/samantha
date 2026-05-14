import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { validateMinimalBatchSpec, type BatchSpec } from "./batch-spec";

export type BatchSpecMutationAuthority = "samantha_api" | "samantha_cli";

export interface BatchSpecLifecycleSnapshot {
  status: BatchSpec["status"];
  tasks: Array<{
    taskId: string;
    status: BatchSpec["tasks"][number]["status"];
    runLogPath?: string;
    candidateCommit?: string;
  }>;
  integrationQueue: Array<{
    order: number;
    taskId: string;
    status: BatchSpec["integrationQueue"][number]["status"];
    expectedCandidateCommit?: string;
  }>;
}

export interface BatchSpecLifecycleMutationEvidence {
  schemaVersion: 1;
  batchId: string;
  batchPath: string;
  operation: "mark_rejected";
  authority: BatchSpecMutationAuthority;
  sourceBatchSpecMutation: "performed";
  reason: string;
  before: BatchSpecLifecycleSnapshot;
  after: BatchSpecLifecycleSnapshot;
  createdAt: string;
}

export interface MarkBatchSpecRejectedInput {
  batchPath: string;
  authority: string;
  reason: string;
  stateDir?: string;
  createdAt?: string;
}

export interface MarkBatchSpecRejectedResult {
  batchPath: string;
  auditPath: string;
  evidence: BatchSpecLifecycleMutationEvidence;
  spec: BatchSpec;
}

const SAMANTHA_MUTATION_AUTHORITIES = new Set<BatchSpecMutationAuthority>([
  "samantha_api",
  "samantha_cli",
]);

export function batchLifecycleAuditPath(stateDir: string): string {
  return join(resolve(stateDir), "batch-lifecycle-audit.jsonl");
}

export async function markBatchSpecRejected(
  input: MarkBatchSpecRejectedInput,
): Promise<MarkBatchSpecRejectedResult> {
  if (!SAMANTHA_MUTATION_AUTHORITIES.has(input.authority as BatchSpecMutationAuthority)) {
    throw new Error(`BatchSpec lifecycle mutation must be Samantha-owned: ${input.authority}`);
  }
  if (input.reason.trim().length === 0) {
    throw new Error("BatchSpec lifecycle mutation requires a non-empty reason");
  }

  const batchPath = resolve(input.batchPath);
  const spec = JSON.parse(await readFile(batchPath, "utf8")) as BatchSpec;
  const beforeViolations = validateMinimalBatchSpec(spec);
  if (beforeViolations.length > 0) {
    throw new Error(`BatchSpec must validate before lifecycle mutation: ${beforeViolations.join("; ")}`);
  }
  if (spec.status === "rejected") {
    throw new Error(`BatchSpec is already rejected: ${spec.batchId}`);
  }

  const before = lifecycleSnapshot(spec);
  const nextSpec: BatchSpec = {
    ...spec,
    status: "rejected",
  };
  const afterViolations = validateMinimalBatchSpec(nextSpec);
  if (afterViolations.length > 0) {
    throw new Error(`BatchSpec must validate after lifecycle mutation: ${afterViolations.join("; ")}`);
  }

  const after = lifecycleSnapshot(nextSpec);
  const stateDir = resolve(input.stateDir ?? join(resolve(nextSpec.repoRoot), "runs"));
  const auditPath = batchLifecycleAuditPath(stateDir);
  const evidence: BatchSpecLifecycleMutationEvidence = {
    schemaVersion: 1,
    batchId: nextSpec.batchId,
    batchPath,
    operation: "mark_rejected",
    authority: input.authority as BatchSpecMutationAuthority,
    sourceBatchSpecMutation: "performed",
    reason: input.reason.trim(),
    before,
    after,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  await mkdir(dirname(batchPath), { recursive: true });
  await mkdir(stateDir, { recursive: true });
  await writeFile(batchPath, `${JSON.stringify(nextSpec, null, 2)}\n`, "utf8");
  await appendFile(auditPath, `${JSON.stringify(evidence)}\n`, "utf8");

  return { batchPath, auditPath, evidence, spec: nextSpec };
}

function lifecycleSnapshot(spec: BatchSpec): BatchSpecLifecycleSnapshot {
  return {
    status: spec.status,
    tasks: spec.tasks.map((task) => ({
      taskId: task.taskId,
      status: task.status,
      ...(task.runLogPath ? { runLogPath: task.runLogPath } : {}),
      ...(task.candidateCommit ? { candidateCommit: task.candidateCommit } : {}),
    })),
    integrationQueue: spec.integrationQueue.map((item) => ({
      order: item.order,
      taskId: item.taskId,
      status: item.status,
      ...(item.expectedCandidateCommit ? { expectedCandidateCommit: item.expectedCandidateCommit } : {}),
    })),
  };
}
