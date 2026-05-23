import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

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

export const MIN_HOOK_TIMEOUT_MS = 100;
export const DEFAULT_HOOK_TIMEOUT_MS = 5_000;
export const MAX_HOOK_TIMEOUT_MS = 60_000;
export const MAX_HOOK_STDOUT_BYTES = 16_384;

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

const HOOK_EVENT_SET = new Set<HookEvent>(HOOK_EVENTS);
const HOOK_MODE_SET = new Set<HookMode>(HOOK_MODES);
const HOOK_FAILURE_BEHAVIOR_SET = new Set<HookFailureBehavior>(HOOK_FAILURE_BEHAVIORS);
const HOOK_RESULT_STATUS_SET = new Set<HookResultStatus>(HOOK_RESULT_STATUSES);
const HOOK_STDOUT_MODE_SET = new Set<HookStdoutMode>(HOOK_STDOUT_MODES);

const TRUST_GATE_EVENTS = new Set<HookEvent>(["task_spec.preflight", "worker.pre_dispatch"]);
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
