export type WorkerRuntimeKind = "exec-json" | "codex-sdk";

export interface WorkerRuntimeMetadata {
  kind: WorkerRuntimeKind;
  threadId?: string;
  turnId?: string;
  eventCounts?: Record<string, number>;
  fallbackReason?: string;
}
