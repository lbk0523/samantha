import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { HarnessResult } from "./contracts";
import type { RunOutcome } from "./ledger";
import type { WorkerRuntimeKind } from "./worker-runtime-metadata";

export const RUN_EVENT_SCHEMA_VERSION = 1;
export const DEFAULT_RUN_EVENTS_FILE = "events.jsonl";

export type RunEventType = "worker_turn_completed" | "worker_run_log_written";

interface RunEventBase {
  schemaVersion: typeof RUN_EVENT_SCHEMA_VERSION;
  eventId: string;
  eventType: RunEventType;
  runId: string;
  taskId: string;
  createdAt: string;
  advisoryOnly: true;
}

export interface WorkerTurnCompletedRunEvent extends RunEventBase {
  eventType: "worker_turn_completed";
  worktreePath: string;
  workerExitCode: number;
  pass: boolean;
  runtimeKind?: WorkerRuntimeKind;
  threadId?: string;
  harnessResultStatus?: HarnessResult["status"];
}

export interface WorkerRunLogWrittenRunEvent extends RunEventBase {
  eventType: "worker_run_log_written";
  runLogPath: string;
  pass: boolean;
  outcome?: RunOutcome;
  harnessResultStatus?: HarnessResult["status"];
}

export type RunEvent = WorkerTurnCompletedRunEvent | WorkerRunLogWrittenRunEvent;
export type RunEventInput = RunEvent extends infer Event
  ? Event extends RunEvent
    ? Omit<Event, "schemaVersion" | "eventId" | "createdAt" | "advisoryOnly">
    : never
  : never;

export interface RunEventFilter {
  eventType?: RunEventType;
  runId?: string;
  taskId?: string;
}

export interface MalformedRunEventLine {
  lineNumber: number;
  reason: string;
}

export interface ReadRunEventsInput {
  runsDir: string;
  fileName?: string;
  filter?: RunEventFilter;
  limit?: number;
}

export interface ReadRunEventsResult {
  path: string;
  events: RunEvent[];
  malformedLines: MalformedRunEventLine[];
}

export interface WaitForRunEventInput extends ReadRunEventsInput {
  timeoutMs: number;
  pollIntervalMs?: number;
}

export type WaitForRunEventResult =
  | {
      status: "found";
      path: string;
      event: RunEvent;
      malformedLines: MalformedRunEventLine[];
    }
  | {
      status: "timeout";
      path: string;
      timeoutMs: number;
      malformedLines: MalformedRunEventLine[];
    };

export function runEventsPath(input: { runsDir: string; fileName?: string }): string {
  return join(resolve(input.runsDir), input.fileName ?? DEFAULT_RUN_EVENTS_FILE);
}

export async function appendRunEvent(input: {
  runsDir: string;
  fileName?: string;
  event: RunEventInput;
  createdAt?: string;
  eventId?: string;
}): Promise<RunEvent> {
  const path = runEventsPath(input);
  const event = {
    schemaVersion: RUN_EVENT_SCHEMA_VERSION,
    eventId: input.eventId ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    advisoryOnly: true,
    ...input.event,
  } as RunEvent;

  assertRunEvent(event);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function readRunEvents(input: ReadRunEventsInput): Promise<ReadRunEventsResult> {
  const path = runEventsPath(input);
  let raw = "";
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return { path, events: [], malformedLines: [] };
  }

  const events: RunEvent[] = [];
  const malformedLines: MalformedRunEventLine[] = [];
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      assertRunEvent(parsed);
      if (matchesFilter(parsed, input.filter)) {
        events.push(parsed);
      }
    } catch (err) {
      malformedLines.push({
        lineNumber: index + 1,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    path,
    events: typeof input.limit === "number" ? events.slice(-input.limit) : events,
    malformedLines,
  };
}

export async function waitForRunEvent(input: WaitForRunEventInput): Promise<WaitForRunEventResult> {
  const startedAt = Date.now();
  const pollIntervalMs = input.pollIntervalMs ?? 100;
  let lastMalformedLines: MalformedRunEventLine[] = [];

  while (Date.now() - startedAt <= input.timeoutMs) {
    const result = await readRunEvents(input);
    lastMalformedLines = result.malformedLines;
    const event = result.events[0];
    if (event) {
      return {
        status: "found",
        path: result.path,
        event,
        malformedLines: result.malformedLines,
      };
    }
    await sleep(Math.min(pollIntervalMs, Math.max(0, input.timeoutMs - (Date.now() - startedAt))));
  }

  return {
    status: "timeout",
    path: runEventsPath(input),
    timeoutMs: input.timeoutMs,
    malformedLines: lastMalformedLines,
  };
}

function matchesFilter(event: RunEvent, filter: RunEventFilter | undefined): boolean {
  return (
    (!filter?.eventType || event.eventType === filter.eventType) &&
    (!filter?.runId || event.runId === filter.runId) &&
    (!filter?.taskId || event.taskId === filter.taskId)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertRunEvent(value: unknown): asserts value is RunEvent {
  if (!value || typeof value !== "object") {
    throw new Error("event must be an object");
  }
  const event = value as Record<string, unknown>;
  assertExactKeys(event, event.eventType === "worker_turn_completed" ? workerTurnKeys : workerRunLogKeys);
  assertString(event.eventId, "eventId");
  assertString(event.runId, "runId");
  assertString(event.taskId, "taskId");
  assertString(event.createdAt, "createdAt");
  if (event.schemaVersion !== RUN_EVENT_SCHEMA_VERSION) {
    throw new Error("schemaVersion must be 1");
  }
  if (event.advisoryOnly !== true) {
    throw new Error("advisoryOnly must be true");
  }
  if (event.eventType === "worker_turn_completed") {
    assertString(event.worktreePath, "worktreePath");
    assertNumber(event.workerExitCode, "workerExitCode");
    assertBoolean(event.pass, "pass");
    assertOptionalString(event.runtimeKind, "runtimeKind");
    assertOptionalString(event.threadId, "threadId");
    assertOptionalHarnessStatus(event.harnessResultStatus);
    return;
  }
  if (event.eventType === "worker_run_log_written") {
    assertString(event.runLogPath, "runLogPath");
    assertBoolean(event.pass, "pass");
    assertOptionalString(event.outcome, "outcome");
    assertOptionalHarnessStatus(event.harnessResultStatus);
    return;
  }
  throw new Error("eventType must be worker_turn_completed or worker_run_log_written");
}

const baseKeys = ["advisoryOnly", "createdAt", "eventId", "eventType", "runId", "schemaVersion", "taskId"];
const workerTurnKeys = [
  ...baseKeys,
  "harnessResultStatus",
  "pass",
  "runtimeKind",
  "threadId",
  "workerExitCode",
  "worktreePath",
];
const workerRunLogKeys = [...baseKeys, "harnessResultStatus", "outcome", "pass", "runLogPath"];

function assertExactKeys(event: Record<string, unknown>, allowedKeys: string[]): void {
  const allowed = new Set(allowedKeys);
  const extra = Object.keys(event).filter((key) => !allowed.has(key));
  if (extra.length > 0) {
    throw new Error(`unexpected event field(s): ${extra.sort().join(", ")}`);
  }
}

function assertString(value: unknown, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertOptionalString(value: unknown, field: string): void {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${field} must be a string when present`);
  }
}

function assertNumber(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
}

function assertBoolean(value: unknown, field: string): void {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
}

function assertOptionalHarnessStatus(value: unknown): void {
  if (value === undefined) return;
  if (value !== "pass" && value !== "rework" && value !== "blocked") {
    throw new Error("harnessResultStatus must be pass, rework, or blocked when present");
  }
}
