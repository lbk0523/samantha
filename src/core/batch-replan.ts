import { appendFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BatchSpec } from "./batch-spec";

export type BatchReplanTrigger = "preflight" | "integration";

export interface BatchStaleBaseReplanEvidence {
  schemaVersion: 1;
  batchId: string;
  policy: "block_and_replan";
  decision: "blocked_for_replan";
  trigger: BatchReplanTrigger;
  sourceBaseCommit: string;
  observedHead: string;
  expectedIntegrationHead?: string;
  targetBranch: string;
  sourceBatchSpecMutation: "not_performed";
  replanArtifactPath: null;
  reason: string;
  violations: string[];
  createdAt: string;
}

export function batchReplanEvidencePath(stateDir: string): string {
  return join(resolve(stateDir), "batch-replan-evidence.jsonl");
}

export async function recordStaleBaseReplanEvidence(input: {
  stateDir: string;
  spec: BatchSpec;
  targetBranch: string;
  trigger: BatchReplanTrigger;
  observedHead: string;
  expectedIntegrationHead?: string;
  violations: string[];
  createdAt?: string;
}): Promise<BatchStaleBaseReplanEvidence> {
  const evidence: BatchStaleBaseReplanEvidence = {
    schemaVersion: 1,
    batchId: input.spec.batchId,
    policy: "block_and_replan",
    decision: "blocked_for_replan",
    trigger: input.trigger,
    sourceBaseCommit: input.spec.baseCommit,
    observedHead: input.observedHead,
    ...(input.expectedIntegrationHead ? { expectedIntegrationHead: input.expectedIntegrationHead } : {}),
    targetBranch: input.targetBranch,
    sourceBatchSpecMutation: "not_performed",
    replanArtifactPath: null,
    reason:
      input.trigger === "preflight"
        ? "BatchSpec baseCommit was stale before dispatch; no worker ran and no source BatchSpec mutation was performed."
        : "Target HEAD moved during batch integration; candidate acceptance stopped and no source BatchSpec mutation was performed.",
    violations: input.violations,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  const path = batchReplanEvidencePath(input.stateDir);
  await mkdir(resolve(input.stateDir), { recursive: true });
  await appendFile(path, `${JSON.stringify(evidence)}\n`, "utf8");
  return evidence;
}
