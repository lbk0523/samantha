import { dirname, join, resolve } from "node:path";
import { RunIndex, type RunSummary } from "./ledger";
import { readWorkerRunLog } from "./merge-gate";
import { RunLifecycleStore, type RunLifecycleRecord } from "./run-lifecycle-store";
import type { WorkerRunHookEvidence, WorkerRunLog } from "./run-log";
import {
  buildRunVisibilitySummary,
  type RunVisibilitySummary,
} from "./run-visibility";

export interface RunShowInput {
  runId: string;
  runsDir?: string;
}

export interface RunShowResult {
  summary: RunSummary;
  log: WorkerRunLog;
  lifecycle: RunLifecycleRecord | null;
  visibilitySummary: RunVisibilitySummary;
  hookSummary?: RunShowHookSummary;
}

export interface RunShowHookSummary {
  eventCount: number;
  hookInvocationCount: number;
  totalDurationMs: number;
  trustGateDecisions: RunShowHookTrustGateDecision[];
  advisoryFailures: RunShowHookInvocationSummary[];
  timeouts: RunShowHookTimeoutSummary[];
  schemaInvalidResults: RunShowHookSchemaInvalidSummary[];
  repoMutationEvidence: RunShowHookRepoMutationSummary[];
}

export interface RunShowHookTrustGateDecision {
  event: string;
  eventVersion: number;
  decision: "allow" | "block";
  blockingHookId: string | null;
  summary: string;
}

export interface RunShowHookInvocationSummary {
  event: string;
  eventVersion: number;
  hookId: string;
  summary: string;
}

export interface RunShowHookTimeoutSummary extends RunShowHookInvocationSummary {
  timeoutMs: number;
  timeoutDetails: string | null;
}

export interface RunShowHookSchemaInvalidSummary extends RunShowHookInvocationSummary {
  schemaViolations: string[];
}

export interface RunShowHookRepoMutationSummary {
  event: string;
  eventVersion: number;
  hookId: string;
  detection: "ok" | "not_git" | "failed" | "timed_out" | "skipped";
  created: string[];
  modified: string[];
  deleted: string[];
  error: string | null;
}

function runIndexPath(runsDir?: string): string {
  return join(resolve(runsDir ?? "runs"), "index.jsonl");
}

function lifecycleStorePath(runLogPath: string): string {
  return join(dirname(resolve(runLogPath)), "run-lifecycle.jsonl");
}

function hasRepoMutationEvidence(input: {
  detection: string;
  created: string[];
  modified: string[];
  deleted: string[];
}): boolean {
  return (
    input.detection !== "ok" ||
    input.created.length > 0 ||
    input.modified.length > 0 ||
    input.deleted.length > 0
  );
}

export function summarizeRunHooks(hookEvidence: WorkerRunHookEvidence): RunShowHookSummary {
  const summary: RunShowHookSummary = {
    eventCount: hookEvidence.events.length,
    hookInvocationCount: 0,
    totalDurationMs: 0,
    trustGateDecisions: [],
    advisoryFailures: [],
    timeouts: [],
    schemaInvalidResults: [],
    repoMutationEvidence: [],
  };

  for (const event of hookEvidence.events) {
    if (event.trustGate) {
      summary.trustGateDecisions.push({
        event: event.event,
        eventVersion: event.eventVersion,
        decision: event.trustGate.decision,
        blockingHookId: event.trustGate.blockingHookId,
        summary: event.trustGate.summary,
      });
    }

    for (const invocation of event.invocations) {
      summary.hookInvocationCount += 1;
      summary.totalDurationMs += invocation.durationMs;

      const invocationSummary = {
        event: event.event,
        eventVersion: event.eventVersion,
        hookId: invocation.hookId,
        summary: invocation.summary,
      };

      if (!event.trustGate && invocation.status === "advisory_failed") {
        summary.advisoryFailures.push(invocationSummary);
      }

      if (invocation.timedOut || invocation.status === "timed_out") {
        summary.timeouts.push({
          ...invocationSummary,
          timeoutMs: invocation.timeoutMs,
          timeoutDetails: invocation.timeoutDetails,
        });
      }

      if (invocation.status === "schema_invalid" || invocation.schemaViolations.length > 0) {
        summary.schemaInvalidResults.push({
          ...invocationSummary,
          schemaViolations: invocation.schemaViolations,
        });
      }

      if (hasRepoMutationEvidence(invocation.repoMutations)) {
        summary.repoMutationEvidence.push({
          event: event.event,
          eventVersion: event.eventVersion,
          hookId: invocation.hookId,
          detection: invocation.repoMutations.detection,
          created: invocation.repoMutations.created,
          modified: invocation.repoMutations.modified,
          deleted: invocation.repoMutations.deleted,
          error: invocation.repoMutations.error,
        });
      }
    }
  }

  return summary;
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
    visibilitySummary: buildRunVisibilitySummary(log),
    ...(log.hookEvidence ? { hookSummary: summarizeRunHooks(log.hookEvidence) } : {}),
  };
}
