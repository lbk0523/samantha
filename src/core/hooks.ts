import { spawn, type ChildProcess } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

export const HOOK_SCHEMA_VERSION = 1;
export const HOOK_POLICY_PATH = "references/hooks/hook-policy.json";
export const HOOK_DEFINITION_DIR = "references/hooks/hooks";

export const HOOK_EVENTS = [
  "request.classified",
  "task_spec.drafted",
  "task_spec.preflight",
  "worker.pre_dispatch",
  "worker.completed",
  "verification.completed",
  "run.completed",
] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

export const HOOK_MODES = ["advisory", "trust_gate"] as const;
export type HookMode = (typeof HOOK_MODES)[number];

export const HOOK_FAILURE_BEHAVIORS = ["fail_open", "fail_closed"] as const;
export type HookFailureBehavior = (typeof HOOK_FAILURE_BEHAVIORS)[number];

export const HOOK_RESULT_STATUSES = [
  "passed",
  "blocked",
  "advisory_failed",
  "timed_out",
  "schema_invalid",
] as const;
export type HookResultStatus = (typeof HOOK_RESULT_STATUSES)[number];

export const HOOK_STDOUT_MODES = ["none", "capped"] as const;
export type HookStdoutMode = (typeof HOOK_STDOUT_MODES)[number];

export const HOOK_DECISIONS = ["allow", "block", "none"] as const;
export type HookDecision = (typeof HOOK_DECISIONS)[number];

export const MIN_HOOK_TIMEOUT_MS = 100;
export const DEFAULT_HOOK_TIMEOUT_MS = 5_000;
export const MAX_HOOK_TIMEOUT_MS = 60_000;
export const MAX_HOOK_STDOUT_BYTES = 16_384;
export const MAX_HOOK_CONTEXT_BYTES = 16_384;
export const HOOK_EVENT_VERSION = 1;

const HOOK_TIMEOUT_TERMINATE_GRACE_MS = 100;
const DEFAULT_TRUST_GATE_EVENT_TIMEOUT_MS = DEFAULT_HOOK_TIMEOUT_MS;
const REPO_MUTATION_STATUS_TIMEOUT_MS = 500;
const REPO_MUTATION_STATUS_KILL_GRACE_MS = 50;
const REPO_MUTATION_STATUS_OUTPUT_BYTES = 64 * 1024;

export interface HookStdoutPolicy {
  mode: HookStdoutMode;
  maxBytes: number;
}

export interface HookDefinition {
  schemaVersion: 1;
  id: string;
  purpose: string;
  mode: HookMode;
  events: HookEvent[];
  command: string[];
  timeoutMs: number;
  contextKeys: string[];
  stdout: HookStdoutPolicy;
}

export interface HookEventDefault {
  mode: HookMode;
  failureBehavior: HookFailureBehavior;
  timeoutMs: number;
}

export interface DisabledHookPolicy {
  id: string;
  reason: string;
}

export interface HookPolicy {
  schemaVersion: 1;
  enabled: boolean;
  hooks: string[];
  eventDefaults: Partial<Record<HookEvent, HookEventDefault>>;
  disabledHooks: DisabledHookPolicy[];
}

export interface HookPolicyLoadInput {
  repoRoot: string;
}

export interface LoadedHookPolicy {
  status: "enabled" | "disabled";
  reason: "policy_missing" | "policy_disabled" | null;
  policyPath: string;
  definitionDir: string;
  policy: HookPolicy | null;
  hooks: HookDefinition[];
  disabledHookIds: string[];
  eventDefaults: Record<HookEvent, HookEventDefault>;
}

export interface HookResult {
  hookId: string;
  event: HookEvent;
  status: HookResultStatus;
  decision: HookDecision;
  summary: string;
  structuredFindings?: unknown;
  stdoutExcerpt?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface HookRepoMutationEvidence {
  detection: "ok" | "not_git" | "failed" | "timed_out" | "skipped";
  created: string[];
  modified: string[];
  deleted: string[];
  error: string | null;
  timeoutMs: number;
}

export interface RunAdvisoryHooksInput {
  repoRoot: string;
  loadedPolicy: LoadedHookPolicy;
  event: HookEvent;
  runId: string;
  context: Record<string, unknown>;
}

export interface RunTrustGateHooksInput extends RunAdvisoryHooksInput {
  eventTimeoutMs?: number;
}

export interface TrustGateFinalResult {
  decision: "allow" | "block";
  summary: string;
  blockingHookId: string | null;
}

export interface TrustGateHookRunResult {
  final: TrustGateFinalResult;
  evidence: HookRunEvidence[];
}

export interface HookRunEvidence {
  hookId: string;
  event: HookEvent;
  command: string[];
  cwd: string;
  status: HookResultStatus;
  decision: HookDecision;
  summary: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stdoutTruncated: boolean;
  stderr: string;
  stderrTruncated: boolean;
  timedOut: boolean;
  timeoutMs: number;
  timeoutDetails: string | null;
  repoMutations: HookRepoMutationEvidence;
  schemaViolations: string[];
  contextKeys: string[];
  contextBytes: number;
}

const HOOK_EVENT_SET = new Set<HookEvent>(HOOK_EVENTS);
const HOOK_MODE_SET = new Set<HookMode>(HOOK_MODES);
const HOOK_FAILURE_BEHAVIOR_SET = new Set<HookFailureBehavior>(HOOK_FAILURE_BEHAVIORS);
const HOOK_RESULT_STATUS_SET = new Set<HookResultStatus>(HOOK_RESULT_STATUSES);
const HOOK_STDOUT_MODE_SET = new Set<HookStdoutMode>(HOOK_STDOUT_MODES);
const HOOK_DECISION_SET = new Set<HookDecision>(HOOK_DECISIONS);

const TRUST_GATE_EVENTS = new Set<HookEvent>(["task_spec.preflight", "worker.pre_dispatch"]);
const HOOK_RESULT_FIELDS = new Set([
  "hookId",
  "event",
  "status",
  "decision",
  "summary",
  "structuredFindings",
  "stdoutExcerpt",
  "startedAt",
  "finishedAt",
  "durationMs",
]);
const HOOK_POLICY_FIELDS = new Set(["schemaVersion", "enabled", "hooks", "eventDefaults", "disabledHooks"]);
const HOOK_EVENT_DEFAULT_FIELDS = new Set(["mode", "failureBehavior", "timeoutMs"]);
const DISABLED_HOOK_FIELDS = new Set(["id", "reason"]);
const HOOK_DEFINITION_FIELDS = new Set([
  "schemaVersion",
  "id",
  "purpose",
  "mode",
  "events",
  "command",
  "timeoutMs",
  "contextKeys",
  "stdout",
]);
const HOOK_STDOUT_FIELDS = new Set(["mode", "maxBytes"]);

export const DEFAULT_HOOK_EVENT_DEFAULTS: Record<HookEvent, HookEventDefault> = {
  "request.classified": {
    mode: "advisory",
    failureBehavior: "fail_open",
    timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
  },
  "task_spec.drafted": {
    mode: "advisory",
    failureBehavior: "fail_open",
    timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
  },
  "task_spec.preflight": {
    mode: "trust_gate",
    failureBehavior: "fail_closed",
    timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
  },
  "worker.pre_dispatch": {
    mode: "trust_gate",
    failureBehavior: "fail_closed",
    timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
  },
  "worker.completed": {
    mode: "advisory",
    failureBehavior: "fail_open",
    timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
  },
  "verification.completed": {
    mode: "advisory",
    failureBehavior: "fail_open",
    timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
  },
  "run.completed": {
    mode: "advisory",
    failureBehavior: "fail_open",
    timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
  },
};

export async function loadHookPolicy(input: HookPolicyLoadInput): Promise<LoadedHookPolicy> {
  const repoRoot = resolve(input.repoRoot);
  const policyPath = join(repoRoot, HOOK_POLICY_PATH);
  const definitionDir = join(repoRoot, HOOK_DEFINITION_DIR);
  const policyJson = await readOptionalJson(policyPath);

  if (policyJson.status === "missing") {
    return {
      status: "disabled",
      reason: "policy_missing",
      policyPath,
      definitionDir,
      policy: null,
      hooks: [],
      disabledHookIds: [],
      eventDefaults: DEFAULT_HOOK_EVENT_DEFAULTS,
    };
  }

  const policyViolations = validateHookPolicy(policyJson.value);
  if (policyViolations.length > 0) {
    throw new Error(`Hook policy invalid: ${policyPath}: ${policyViolations.join("; ")}`);
  }

  const policy = policyJson.value as HookPolicy;
  const eventDefaults = mergeHookEventDefaults(policy.eventDefaults);
  const disabledHookIds = policy.disabledHooks.map((hook) => hook.id);

  if (!policy.enabled) {
    return {
      status: "disabled",
      reason: "policy_disabled",
      policyPath,
      definitionDir,
      policy,
      hooks: [],
      disabledHookIds,
      eventDefaults,
    };
  }

  const disabledHookSet = new Set(disabledHookIds);
  const hooks = await Promise.all(
    policy.hooks
      .filter((hookId) => !disabledHookSet.has(hookId))
      .map((hookId) => readHookDefinition(definitionDir, hookId)),
  );

  return {
    status: "enabled",
    reason: null,
    policyPath,
    definitionDir,
    policy,
    hooks,
    disabledHookIds,
    eventDefaults,
  };
}

export async function runAdvisoryHooks(input: RunAdvisoryHooksInput): Promise<HookRunEvidence[]> {
  if (input.loadedPolicy.status !== "enabled") {
    return [];
  }

  const repoRoot = await realpath(resolve(input.repoRoot));
  const hooks = input.loadedPolicy.hooks.filter(
    (hook) => hook.mode === "advisory" && hook.events.includes(input.event),
  );
  const evidence: HookRunEvidence[] = [];

  for (const hook of hooks) {
    evidence.push(
      await runHook({
        ...input,
        repoRoot,
        hook,
        timeoutMs: hook.timeoutMs,
        blockOnPreMutationDetectionFailure: false,
      }),
    );
  }

  return evidence;
}

export async function runTrustGateHooks(input: RunTrustGateHooksInput): Promise<TrustGateHookRunResult> {
  if (!TRUST_GATE_EVENTS.has(input.event)) {
    return trustGateFinalBlock(
      `Trust-gate runner only accepts task_spec.preflight or worker.pre_dispatch events; received ${input.event}.`,
      null,
      [],
    );
  }

  if (input.loadedPolicy.status !== "enabled") {
    return trustGateFinalAllow("Hook policy disabled or missing; no trust-gate hooks executed.", []);
  }

  const hooks = input.loadedPolicy.hooks.filter(
    (hook) => hook.mode === "trust_gate" && hook.events.includes(input.event),
  );
  if (hooks.length === 0) {
    return trustGateFinalAllow(`No matching trust-gate hooks for ${input.event}.`, []);
  }

  const repoRoot = await realpath(resolve(input.repoRoot));
  const eventTimeoutMs = normalizeTrustGateEventTimeout(input.eventTimeoutMs);
  const eventStartedAtMs = performance.now();
  const evidence: HookRunEvidence[] = [];

  for (const hook of hooks) {
    const remainingEventBudgetMs = remainingTrustGateEventBudget(eventTimeoutMs, eventStartedAtMs);
    if (remainingEventBudgetMs <= 0) {
      return trustGateFinalBlock(
        `Trust-gate event budget exhausted before hook ${hook.id} could run.`,
        hook.id,
        evidence,
      );
    }

    const hookEvidence = await runHook({
      ...input,
      repoRoot,
      hook,
      timeoutMs: Math.min(hook.timeoutMs, remainingEventBudgetMs),
      blockOnPreMutationDetectionFailure: true,
    });
    evidence.push(hookEvidence);

    const blockSummary = trustGateBlockSummary(hookEvidence);
    if (blockSummary) {
      return trustGateFinalBlock(blockSummary, hook.id, evidence);
    }
  }

  return trustGateFinalAllow(`Trust-gate hooks allowed ${hooks.length} hook(s).`, evidence);
}

function trustGateFinalAllow(summary: string, evidence: HookRunEvidence[]): TrustGateHookRunResult {
  return {
    final: {
      decision: "allow",
      summary,
      blockingHookId: null,
    },
    evidence,
  };
}

function trustGateFinalBlock(
  summary: string,
  blockingHookId: string | null,
  evidence: HookRunEvidence[],
): TrustGateHookRunResult {
  return {
    final: {
      decision: "block",
      summary,
      blockingHookId,
    },
    evidence,
  };
}

function normalizeTrustGateEventTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TRUST_GATE_EVENT_TIMEOUT_MS;
  }
  if (!Number.isFinite(timeoutMs)) {
    return 0;
  }
  return Math.max(0, Math.floor(timeoutMs));
}

function remainingTrustGateEventBudget(eventTimeoutMs: number, eventStartedAtMs: number): number {
  return Math.max(0, Math.ceil(eventTimeoutMs - (performance.now() - eventStartedAtMs)));
}

function trustGateBlockSummary(evidence: HookRunEvidence): string | null {
  if (evidence.status !== "passed") {
    return `Trust-gate hook ${evidence.hookId} blocked: ${evidence.summary}`;
  }
  if (evidence.decision !== "allow") {
    return `Trust-gate hook ${evidence.hookId} did not explicitly allow the event.`;
  }
  if (evidence.repoMutations.detection !== "ok") {
    const error = evidence.repoMutations.error ? `: ${evidence.repoMutations.error}` : "";
    return `Trust-gate hook ${evidence.hookId} could not verify repo mutations (${evidence.repoMutations.detection})${error}.`;
  }
  if (
    evidence.repoMutations.created.length > 0 ||
    evidence.repoMutations.modified.length > 0 ||
    evidence.repoMutations.deleted.length > 0
  ) {
    return `Trust-gate hook ${evidence.hookId} mutated repository files.`;
  }
  return null;
}

export function validateHookPolicy(input: unknown): string[] {
  if (!isRecord(input)) {
    return ["hook policy must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateAllowedFields(input, HOOK_POLICY_FIELDS, (key) => `unknown hook policy field: ${key}`));

  if (input.schemaVersion !== HOOK_SCHEMA_VERSION) {
    violations.push("hook policy schemaVersion must be exactly 1");
  }
  if (typeof input.enabled !== "boolean") {
    violations.push("hook policy enabled must be a boolean");
  }

  violations.push(...validateHookReferences(input.hooks));
  violations.push(...validateEventDefaults(input.eventDefaults));
  violations.push(...validateDisabledHooks(input.disabledHooks, input.hooks));

  return violations;
}

export function validateHookDefinition(input: unknown): string[] {
  if (!isRecord(input)) {
    return ["hook definition must be an object"];
  }

  const violations: string[] = [];
  violations.push(
    ...validateAllowedFields(input, HOOK_DEFINITION_FIELDS, (key) => `unknown hook definition field: ${key}`),
  );

  if (input.schemaVersion !== HOOK_SCHEMA_VERSION) {
    violations.push("hook definition schemaVersion must be exactly 1");
  }
  violations.push(...validateHookId(input.id, "hook definition id"));
  if (!isNonEmptyString(input.purpose)) {
    violations.push("hook definition purpose must be a non-empty string");
  }
  if (!isHookMode(input.mode)) {
    violations.push(`hook definition mode must be ${joinOptions(HOOK_MODES)}: ${String(input.mode)}`);
  }

  violations.push(...validateHookEvents(input.events, input.mode));
  violations.push(...validateCommand(input.command));
  violations.push(...validateTimeout(input.timeoutMs, "hook definition timeoutMs"));
  violations.push(...validateContextKeys(input.contextKeys));
  violations.push(...validateStdout(input.stdout));

  return violations;
}

export function isHookEvent(value: unknown): value is HookEvent {
  return typeof value === "string" && HOOK_EVENT_SET.has(value as HookEvent);
}

export function isHookMode(value: unknown): value is HookMode {
  return typeof value === "string" && HOOK_MODE_SET.has(value as HookMode);
}

export function isHookResultStatus(value: unknown): value is HookResultStatus {
  return typeof value === "string" && HOOK_RESULT_STATUS_SET.has(value as HookResultStatus);
}

export function isHookFailureBehavior(value: unknown): value is HookFailureBehavior {
  return typeof value === "string" && HOOK_FAILURE_BEHAVIOR_SET.has(value as HookFailureBehavior);
}

export function isHookDecision(value: unknown): value is HookDecision {
  return typeof value === "string" && HOOK_DECISION_SET.has(value as HookDecision);
}

type RunHookInput = Omit<RunAdvisoryHooksInput, "loadedPolicy" | "repoRoot"> & {
  repoRoot: string;
  hook: HookDefinition;
  timeoutMs: number;
  blockOnPreMutationDetectionFailure: boolean;
};

async function runHook(
  input: RunHookInput,
): Promise<HookRunEvidence> {
  const hookInput = buildHookProcessInput(input);
  if (hookInput.contextBytes > MAX_HOOK_CONTEXT_BYTES) {
    return contextTooLargeEvidence(input, hookInput);
  }

  const beforeMutations = await readRepoMutationSnapshot(input.repoRoot);
  if (input.blockOnPreMutationDetectionFailure && beforeMutations.detection !== "ok") {
    return preMutationDetectionFailureEvidence(input, hookInput, beforeMutations);
  }

  const processResult = await runHookProcess({
    command: input.hook.command,
    cwd: input.repoRoot,
    stdin: hookInput.stdin,
    timeoutMs: input.timeoutMs,
    stdoutPolicy: input.hook.stdout,
  });
  const repoMutations = await detectRepoMutations(input.repoRoot, beforeMutations);

  if (processResult.timedOut) {
    return {
      ...baseEvidence(input, hookInput, processResult, repoMutations),
      status: "timed_out",
      decision: "none",
      summary: `Hook timed out after ${input.timeoutMs}ms.`,
      timeoutDetails: `command exceeded timeoutMs=${input.timeoutMs}`,
      schemaViolations: [],
    };
  }

  if (processResult.exitCode !== 0) {
    return {
      ...baseEvidence(input, hookInput, processResult, repoMutations),
      status: "advisory_failed",
      decision: "none",
      summary: `Hook command exited with code ${processResult.exitCode ?? "unknown"}.`,
      timeoutDetails: null,
      schemaViolations: [],
    };
  }

  const parsed = parseHookResult(processResult.stdoutForParsing, input.hook, input.event);
  if (parsed.status === "invalid") {
    return {
      ...baseEvidence(input, hookInput, processResult, repoMutations),
      status: "schema_invalid",
      decision: "none",
      summary: "Hook result schema invalid.",
      timeoutDetails: null,
      schemaViolations: parsed.violations,
    };
  }

  return {
    ...baseEvidence(input, hookInput, processResult, repoMutations),
    status: parsed.result.status,
    decision: parsed.result.decision,
    summary: parsed.result.summary,
    timeoutDetails: null,
    schemaViolations: [],
  };
}

async function readHookDefinition(definitionDir: string, hookId: string): Promise<HookDefinition> {
  const path = join(definitionDir, `${hookId}.json`);
  const definitionJson = await readRequiredJson(path, `referenced hook definition missing: ${hookId}`);
  const violations = validateHookDefinition(definitionJson);
  if (isRecord(definitionJson) && definitionJson.id !== hookId) {
    violations.push(`hook definition id must match policy reference: ${hookId}`);
  }
  if (violations.length > 0) {
    throw new Error(`Hook definition invalid: ${path}: ${violations.join("; ")}`);
  }
  return definitionJson as HookDefinition;
}

async function readOptionalJson(path: string): Promise<{ status: "missing" } | { status: "present"; value: unknown }> {
  try {
    return { status: "present", value: JSON.parse(await readFile(path, "utf8")) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "missing" };
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Hook policy JSON invalid: ${path}: ${err.message}`);
    }
    throw err;
  }
}

async function readRequiredJson(path: string, missingMessage: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${missingMessage}: ${path}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Hook definition JSON invalid: ${path}: ${err.message}`);
    }
    throw err;
  }
}

function buildHookProcessInput(input: {
  repoRoot: string;
  hook: HookDefinition;
  event: HookEvent;
  runId: string;
  context: Record<string, unknown>;
}): { stdin: string; contextKeys: string[]; contextBytes: number } {
  const context: Record<string, unknown> = {};
  for (const key of input.hook.contextKeys) {
    if (Object.prototype.hasOwnProperty.call(input.context, key)) {
      context[key] = input.context[key];
    }
  }

  const payload = {
    schemaVersion: HOOK_SCHEMA_VERSION,
    eventVersion: HOOK_EVENT_VERSION,
    runId: input.runId,
    repoRoot: input.repoRoot,
    hookId: input.hook.id,
    event: input.event,
    context,
  };
  const stdin = `${JSON.stringify(payload)}\n`;
  return {
    stdin,
    contextKeys: Object.keys(context),
    contextBytes: Buffer.byteLength(stdin, "utf8"),
  };
}

function contextTooLargeEvidence(
  input: RunHookInput,
  hookInput: { contextKeys: string[]; contextBytes: number },
): HookRunEvidence {
  const startedAt = new Date().toISOString();
  return {
    hookId: input.hook.id,
    event: input.event,
    command: input.hook.command,
    cwd: input.repoRoot,
    status: "schema_invalid",
    decision: "none",
    summary: `Hook context exceeded ${MAX_HOOK_CONTEXT_BYTES} bytes.`,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    exitCode: null,
    stdout: "",
    stdoutTruncated: false,
    stderr: "",
    stderrTruncated: false,
    timedOut: false,
    timeoutMs: input.timeoutMs,
    timeoutDetails: null,
    repoMutations: skippedRepoMutationEvidence(),
    schemaViolations: [`hook context must be at most ${MAX_HOOK_CONTEXT_BYTES} bytes`],
    contextKeys: hookInput.contextKeys,
    contextBytes: hookInput.contextBytes,
  };
}

function preMutationDetectionFailureEvidence(
  input: RunHookInput,
  hookInput: { contextKeys: string[]; contextBytes: number },
  snapshot: Exclude<RepoMutationSnapshot, { detection: "ok" }>,
): HookRunEvidence {
  const startedAt = new Date().toISOString();
  const error = snapshot.error ? `: ${snapshot.error}` : "";
  return {
    hookId: input.hook.id,
    event: input.event,
    command: input.hook.command,
    cwd: input.repoRoot,
    status: "advisory_failed",
    decision: "none",
    summary: `Hook command not executed because pre-command repo mutation detection was ${snapshot.detection}${error}.`,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    exitCode: null,
    stdout: "",
    stdoutTruncated: false,
    stderr: "",
    stderrTruncated: false,
    timedOut: false,
    timeoutMs: input.timeoutMs,
    timeoutDetails: null,
    repoMutations: repoMutationEvidenceFromSnapshot(snapshot),
    schemaViolations: [],
    contextKeys: hookInput.contextKeys,
    contextBytes: hookInput.contextBytes,
  };
}

function baseEvidence(
  input: RunHookInput,
  hookInput: { contextKeys: string[]; contextBytes: number },
  processResult: HookProcessResult,
  repoMutations: HookRepoMutationEvidence,
): Omit<HookRunEvidence, "status" | "decision" | "summary" | "timeoutDetails" | "schemaViolations"> {
  return {
    hookId: input.hook.id,
    event: input.event,
    command: input.hook.command,
    cwd: input.repoRoot,
    startedAt: processResult.startedAt,
    finishedAt: processResult.finishedAt,
    durationMs: processResult.durationMs,
    exitCode: processResult.exitCode,
    stdout: processResult.stdout,
    stdoutTruncated: processResult.stdoutTruncated,
    stderr: processResult.stderr,
    stderrTruncated: processResult.stderrTruncated,
    timedOut: processResult.timedOut,
    timeoutMs: input.timeoutMs,
    repoMutations,
    contextKeys: hookInput.contextKeys,
    contextBytes: hookInput.contextBytes,
  };
}

interface HookProcessInput {
  command: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  stdoutPolicy: HookStdoutPolicy;
}

interface HookProcessResult {
  exitCode: number | null;
  stdout: string;
  stdoutForParsing: string;
  stdoutTruncated: boolean;
  stderr: string;
  stderrTruncated: boolean;
  timedOut: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

async function runHookProcess(input: HookProcessInput): Promise<HookProcessResult> {
  const startedAt = new Date().toISOString();
  const startedAtMs = performance.now();
  const stdoutEvidence = new CappedOutput(outputLimit(input.stdoutPolicy));
  const stdoutForParsing = new CappedOutput(MAX_HOOK_STDOUT_BYTES);
  const stderrEvidence = new CappedOutput(outputLimit(input.stdoutPolicy));
  let timedOut = false;
  let closed = false;
  let killAfterGrace: NodeJS.Timeout | null = null;

  return await new Promise((resolveProcess) => {
    const child = spawn(input.command[0], input.command.slice(1), {
      cwd: input.cwd,
      env: hookSubprocessEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killAfterGrace = setTimeout(() => {
        if (!closed) {
          child.kill("SIGKILL");
        }
      }, HOOK_TIMEOUT_TERMINATE_GRACE_MS);
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutEvidence.append(chunk);
      stdoutForParsing.append(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrEvidence.append(chunk);
    });
    child.stdin.on("error", (err) => {
      stderrEvidence.append(Buffer.from(err.message));
    });
    child.on("error", (err) => {
      stderrEvidence.append(Buffer.from(err.message));
    });
    child.on("close", (code) => {
      closed = true;
      clearTimeout(timeout);
      if (killAfterGrace) {
        clearTimeout(killAfterGrace);
      }
      resolveProcess({
        exitCode: code,
        stdout: stdoutEvidence.text(),
        stdoutForParsing: stdoutForParsing.text(),
        stdoutTruncated: stdoutEvidence.truncated,
        stderr: stderrEvidence.text(),
        stderrTruncated: stderrEvidence.truncated,
        timedOut,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
      });
    });

    try {
      child.stdin.end(input.stdin);
    } catch (err) {
      stderrEvidence.append(Buffer.from((err as Error).message));
    }
  });
}

type RepoMutationKind = "created" | "modified" | "deleted";

type RepoMutationSnapshot =
  | { detection: "ok"; paths: Map<string, RepoMutationKind>; error: null }
  | { detection: "not_git" | "failed" | "timed_out"; paths: null; error: string };

async function detectRepoMutations(
  repoRoot: string,
  before: RepoMutationSnapshot,
): Promise<HookRepoMutationEvidence> {
  if (before.detection !== "ok") {
    return repoMutationEvidenceFromSnapshot(before);
  }

  const after = await readRepoMutationSnapshot(repoRoot);
  if (after.detection !== "ok") {
    return repoMutationEvidenceFromSnapshot(after);
  }

  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const paths = new Set([...before.paths.keys(), ...after.paths.keys()]);

  for (const path of paths) {
    const beforeKind = before.paths.get(path);
    const afterKind = after.paths.get(path);
    if (beforeKind === afterKind) {
      continue;
    }
    if (afterKind === "created") {
      created.push(path);
    } else if (afterKind === "modified") {
      modified.push(path);
    } else if (afterKind === "deleted") {
      deleted.push(path);
    } else if (beforeKind === "created") {
      deleted.push(path);
    } else {
      modified.push(path);
    }
  }

  return {
    detection: "ok",
    created: created.sort(),
    modified: modified.sort(),
    deleted: deleted.sort(),
    error: null,
    timeoutMs: REPO_MUTATION_STATUS_TIMEOUT_MS,
  };
}

async function readRepoMutationSnapshot(repoRoot: string): Promise<RepoMutationSnapshot> {
  const result = await runBoundedProcess({
    command: "git",
    args: [
      "-C",
      repoRoot,
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=normal",
      "--ignore-submodules=all",
      "--",
      ".",
      ":(exclude).git",
      ":(exclude).git/**",
      ":(exclude)node_modules",
      ":(exclude)node_modules/**",
      ":(exclude)worktrees",
      ":(exclude)worktrees/**",
      ":(exclude)runs",
      ":(exclude)runs/**",
    ],
    cwd: repoRoot,
    timeoutMs: REPO_MUTATION_STATUS_TIMEOUT_MS,
    killGraceMs: REPO_MUTATION_STATUS_KILL_GRACE_MS,
  });

  if (result.timedOut) {
    return {
      detection: "timed_out",
      paths: null,
      error: `git status exceeded ${REPO_MUTATION_STATUS_TIMEOUT_MS}ms`,
    };
  }
  if (result.exitCode !== 0) {
    const error = result.stderr.trim() || `git status exited with code ${result.exitCode ?? "unknown"}`;
    return {
      detection: error.includes("not a git repository") ? "not_git" : "failed",
      paths: null,
      error,
    };
  }

  return {
    detection: "ok",
    paths: parseGitStatusSnapshot(result.stdout),
    error: null,
  };
}

function parseGitStatusSnapshot(output: string): Map<string, RepoMutationKind> {
  const paths = new Map<string, RepoMutationKind>();
  const entries = output.split("\0").filter((entry) => entry.length > 0);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.length < 4) {
      continue;
    }

    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    if (status === "??") {
      paths.set(path, "created");
      continue;
    }
    if (status[0] === "R" || status[0] === "C") {
      paths.set(path, "modified");
      index += 1;
      continue;
    }
    if (status.includes("D")) {
      paths.set(path, "deleted");
      continue;
    }
    paths.set(path, "modified");
  }

  return paths;
}

function repoMutationEvidenceFromSnapshot(snapshot: Exclude<RepoMutationSnapshot, { detection: "ok" }>): HookRepoMutationEvidence {
  return {
    detection: snapshot.detection,
    created: [],
    modified: [],
    deleted: [],
    error: snapshot.error,
    timeoutMs: REPO_MUTATION_STATUS_TIMEOUT_MS,
  };
}

function skippedRepoMutationEvidence(): HookRepoMutationEvidence {
  return {
    detection: "skipped",
    created: [],
    modified: [],
    deleted: [],
    error: null,
    timeoutMs: REPO_MUTATION_STATUS_TIMEOUT_MS,
  };
}

interface BoundedProcessInput {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  killGraceMs: number;
}

interface BoundedProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

async function runBoundedProcess(input: BoundedProcessInput): Promise<BoundedProcessResult> {
  const stdout = new CappedOutput(REPO_MUTATION_STATUS_OUTPUT_BYTES);
  const stderr = new CappedOutput(REPO_MUTATION_STATUS_OUTPUT_BYTES);
  let timedOut = false;
  let closed = false;
  let killAfterGrace: NodeJS.Timeout | null = null;

  return await new Promise((resolveProcess) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: hookSubprocessEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      killAfterGrace = terminateAfterGrace(child, input.killGraceMs, () => closed);
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.append(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.append(chunk);
    });
    child.on("error", (err) => {
      stderr.append(Buffer.from(err.message));
    });
    child.on("close", (code) => {
      closed = true;
      clearTimeout(timeout);
      if (killAfterGrace) {
        clearTimeout(killAfterGrace);
      }
      resolveProcess({
        exitCode: code,
        stdout: stdout.text(),
        stderr: stderr.text(),
        timedOut,
      });
    });
  });
}

function terminateAfterGrace(
  child: ChildProcess,
  graceMs: number,
  isClosed: () => boolean,
): NodeJS.Timeout {
  child.kill("SIGTERM");
  return setTimeout(() => {
    if (!isClosed()) {
      child.kill("SIGKILL");
    }
  }, graceMs);
}

class CappedOutput {
  private chunks: Buffer[] = [];
  private bytes = 0;
  truncated = false;

  constructor(private readonly maxBytes: number) {}

  append(chunk: Buffer): void {
    if (this.maxBytes === 0) {
      if (chunk.byteLength > 0) {
        this.truncated = true;
      }
      return;
    }

    const remaining = this.maxBytes - this.bytes;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    if (chunk.byteLength > remaining) {
      this.chunks.push(chunk.subarray(0, remaining));
      this.bytes += remaining;
      this.truncated = true;
      return;
    }
    this.chunks.push(chunk);
    this.bytes += chunk.byteLength;
  }

  text(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function outputLimit(policy: HookStdoutPolicy): number {
  return policy.mode === "capped" ? policy.maxBytes : 0;
}

function parseHookResult(
  stdout: string,
  hook: HookDefinition,
  event: HookEvent,
): { status: "valid"; result: HookResult } | { status: "invalid"; violations: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch (err) {
    return {
      status: "invalid",
      violations: [`hook stdout must be valid HookResult JSON: ${(err as Error).message}`],
    };
  }

  const violations = validateHookResult(parsed, hook, event);
  if (violations.length > 0) {
    return { status: "invalid", violations };
  }

  return { status: "valid", result: parsed as HookResult };
}

function validateHookResult(input: unknown, hook: HookDefinition, event: HookEvent): string[] {
  if (!isRecord(input)) {
    return ["hook result must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateAllowedFields(input, HOOK_RESULT_FIELDS, (key) => `unknown hook result field: ${key}`));
  if (input.hookId !== hook.id) {
    violations.push(`hook result hookId must be ${hook.id}`);
  }
  if (input.event !== event) {
    violations.push(`hook result event must be ${event}`);
  }
  if (!isHookResultStatus(input.status)) {
    violations.push(`hook result status must be ${joinOptions(HOOK_RESULT_STATUSES)}: ${String(input.status)}`);
  }
  if (!isHookDecision(input.decision)) {
    violations.push(`hook result decision must be ${joinOptions(HOOK_DECISIONS)}: ${String(input.decision)}`);
  }
  if (isHookResultStatus(input.status) && isHookDecision(input.decision)) {
    violations.push(...validateHookResultDecision(input.status, input.decision));
  }
  if (!isNonEmptyString(input.summary)) {
    violations.push("hook result summary must be a non-empty string");
  }
  if ("stdoutExcerpt" in input && typeof input.stdoutExcerpt !== "string") {
    violations.push("hook result stdoutExcerpt must be a string when present");
  }
  if ("startedAt" in input && typeof input.startedAt !== "string") {
    violations.push("hook result startedAt must be a string when present");
  }
  if ("finishedAt" in input && typeof input.finishedAt !== "string") {
    violations.push("hook result finishedAt must be a string when present");
  }
  if ("durationMs" in input && !isBoundedInteger(input.durationMs, 0, Number.MAX_SAFE_INTEGER)) {
    violations.push("hook result durationMs must be a non-negative integer when present");
  }
  return violations;
}

function validateHookResultDecision(status: HookResultStatus, decision: HookDecision): string[] {
  const allowedDecisions = hookResultAllowedDecisions(status);
  if (allowedDecisions.includes(decision)) {
    return [];
  }
  return [
    `hook result decision ${decision} is invalid for status ${status}; expected ${allowedDecisions.join(" or ")}`,
  ];
}

function hookResultAllowedDecisions(status: HookResultStatus): HookDecision[] {
  if (status === "passed") {
    return ["allow", "none"];
  }
  if (status === "blocked") {
    return ["block"];
  }
  return ["none"];
}

const HOOK_ENV_KEYS = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
] as const;

function hookSubprocessEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of HOOK_ENV_KEYS) {
    const value = source[key];
    if (value) {
      env[key] = value;
    }
  }
  env.PATH ??= "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
  return env;
}

function mergeHookEventDefaults(
  overrides: Partial<Record<HookEvent, HookEventDefault>>,
): Record<HookEvent, HookEventDefault> {
  return {
    ...DEFAULT_HOOK_EVENT_DEFAULTS,
    ...overrides,
  };
}

function validateHookReferences(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["hook policy hooks must be an array of hook ids"];
  }

  const violations: string[] = [];
  const seen = new Set<string>();
  value.forEach((hookId, index) => {
    violations.push(...validateHookId(hookId, `hook policy hooks[${index}]`));
    if (typeof hookId === "string") {
      if (seen.has(hookId)) {
        violations.push(`hook policy hooks must not contain duplicate ids: ${hookId}`);
      }
      seen.add(hookId);
    }
  });
  return violations;
}

function validateDisabledHooks(value: unknown, hookReferences: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["hook policy disabledHooks must be an array"];
  }

  const referencedHookIds = new Set(Array.isArray(hookReferences) ? hookReferences.filter(isString) : []);
  const violations: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      violations.push(`hook policy disabledHooks[${index}] must be an object`);
      return;
    }
    violations.push(
      ...validateAllowedFields(item, DISABLED_HOOK_FIELDS, (key) => `unknown disabledHooks[${index}] field: ${key}`),
    );
    violations.push(...validateHookId(item.id, `hook policy disabledHooks[${index}].id`));
    if (!isNonEmptyString(item.reason)) {
      violations.push(`hook policy disabledHooks[${index}].reason must be a non-empty string`);
    }
    if (typeof item.id === "string") {
      if (seen.has(item.id)) {
        violations.push(`hook policy disabledHooks must not contain duplicate ids: ${item.id}`);
      }
      seen.add(item.id);
      if (referencedHookIds.size > 0 && !referencedHookIds.has(item.id)) {
        violations.push(`hook policy disabledHooks[${index}].id must reference a policy hook: ${item.id}`);
      }
    }
  });
  return violations;
}

function validateEventDefaults(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["hook policy eventDefaults must be an object"];
  }

  const violations: string[] = [];
  Object.entries(value).forEach(([event, defaults]) => {
    if (!isHookEvent(event)) {
      violations.push(`hook policy eventDefaults contains unknown event: ${event}`);
      return;
    }
    if (!isRecord(defaults)) {
      violations.push(`hook policy eventDefaults.${event} must be an object`);
      return;
    }

    violations.push(
      ...validateAllowedFields(
        defaults,
        HOOK_EVENT_DEFAULT_FIELDS,
        (key) => `unknown eventDefaults.${event} field: ${key}`,
      ),
    );
    if (!isHookMode(defaults.mode)) {
      violations.push(`hook policy eventDefaults.${event}.mode must be ${joinOptions(HOOK_MODES)}: ${String(defaults.mode)}`);
    }
    if (!isHookFailureBehavior(defaults.failureBehavior)) {
      violations.push(
        `hook policy eventDefaults.${event}.failureBehavior must be ${joinOptions(HOOK_FAILURE_BEHAVIORS)}: ${String(defaults.failureBehavior)}`,
      );
    }
    violations.push(...validateTimeout(defaults.timeoutMs, `hook policy eventDefaults.${event}.timeoutMs`));

    const expectedMode = expectedModeForEvent(event);
    if (isHookMode(defaults.mode) && defaults.mode !== expectedMode) {
      violations.push(`hook policy eventDefaults.${event}.mode must be ${expectedMode}`);
    }

    const expectedFailureBehavior = expectedFailureBehaviorForEvent(event);
    if (isHookFailureBehavior(defaults.failureBehavior) && defaults.failureBehavior !== expectedFailureBehavior) {
      violations.push(`hook policy eventDefaults.${event}.failureBehavior must be ${expectedFailureBehavior}`);
    }
  });

  return violations;
}

function validateHookEvents(value: unknown, mode: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ["hook definition events must be a non-empty array"];
  }

  const violations: string[] = [];
  const seen = new Set<string>();
  value.forEach((event, index) => {
    if (!isHookEvent(event)) {
      violations.push(`hook definition events[${index}] must be ${joinOptions(HOOK_EVENTS)}: ${String(event)}`);
      return;
    }
    if (seen.has(event)) {
      violations.push(`hook definition events must not contain duplicate events: ${event}`);
    }
    seen.add(event);

    if (isHookMode(mode) && mode !== expectedModeForEvent(event)) {
      violations.push(`hook definition mode ${mode} cannot attach to ${event}; expected ${expectedModeForEvent(event)}`);
    }
  });
  return violations;
}

function validateCommand(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ["hook definition command must be a non-empty argv-style string array"];
  }

  const violations: string[] = [];
  value.forEach((arg, index) => {
    if (!isNonEmptyString(arg)) {
      violations.push(`hook definition command[${index}] must be a non-empty string`);
    }
  });
  return violations;
}

function validateContextKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["hook definition contextKeys must be an array of explicit strings"];
  }

  const violations: string[] = [];
  const seen = new Set<string>();
  value.forEach((key, index) => {
    if (typeof key !== "string" || !/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(key)) {
      violations.push(`hook definition contextKeys[${index}] must be an explicit context key string`);
      return;
    }
    if (seen.has(key)) {
      violations.push(`hook definition contextKeys must not contain duplicate keys: ${key}`);
    }
    seen.add(key);
  });
  return violations;
}

function validateStdout(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["hook definition stdout must be an object"];
  }

  const violations: string[] = [];
  violations.push(...validateAllowedFields(value, HOOK_STDOUT_FIELDS, (key) => `unknown stdout field: ${key}`));
  if (!isHookStdoutMode(value.mode)) {
    violations.push(`hook definition stdout.mode must be ${joinOptions(HOOK_STDOUT_MODES)}: ${String(value.mode)}`);
  }
  if (!isBoundedInteger(value.maxBytes, 0, MAX_HOOK_STDOUT_BYTES)) {
    violations.push(`hook definition stdout.maxBytes must be an integer from 0 to ${MAX_HOOK_STDOUT_BYTES}`);
  }
  if (value.mode === "capped" && value.maxBytes === 0) {
    violations.push("hook definition stdout.maxBytes must be greater than 0 when stdout.mode is capped");
  }
  if (value.mode === "none" && value.maxBytes !== 0) {
    violations.push("hook definition stdout.maxBytes must be 0 when stdout.mode is none");
  }
  return violations;
}

function validateTimeout(value: unknown, label: string): string[] {
  if (!isBoundedInteger(value, MIN_HOOK_TIMEOUT_MS, MAX_HOOK_TIMEOUT_MS)) {
    return [`${label} must be an integer from ${MIN_HOOK_TIMEOUT_MS} to ${MAX_HOOK_TIMEOUT_MS}`];
  }
  return [];
}

function validateHookId(value: unknown, label: string): string[] {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    return [`${label} must be a stable repo-local hook id`];
  }
  return [];
}

function expectedModeForEvent(event: HookEvent): HookMode {
  return TRUST_GATE_EVENTS.has(event) ? "trust_gate" : "advisory";
}

function expectedFailureBehaviorForEvent(event: HookEvent): HookFailureBehavior {
  return TRUST_GATE_EVENTS.has(event) ? "fail_closed" : "fail_open";
}

function isHookStdoutMode(value: unknown): value is HookStdoutMode {
  return typeof value === "string" && HOOK_STDOUT_MODE_SET.has(value as HookStdoutMode);
}

function isBoundedInteger(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && typeof value === "number" && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function validateAllowedFields(
  value: Record<string, unknown>,
  allowedFields: Set<string>,
  formatViolation: (key: string) => string,
): string[] {
  return Object.keys(value)
    .filter((key) => !allowedFields.has(key))
    .map(formatViolation);
}

function joinOptions(values: readonly string[]): string {
  return values.join(", ").replace(/, ([^,]*)$/, ", or $1");
}
