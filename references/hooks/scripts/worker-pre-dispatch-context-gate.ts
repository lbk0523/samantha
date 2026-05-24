type HookDecision = "allow" | "block";
type HookStatus = "passed" | "blocked";

interface Finding {
  code: string;
  path: string;
  message: string;
}

interface HookResult {
  hookId: string;
  event: "worker.pre_dispatch";
  status: HookStatus;
  decision: HookDecision;
  summary: string;
  structuredFindings: {
    findings: Finding[];
  };
}

const HOOK_ID = "worker-pre-dispatch-context-gate";
const EVENT = "worker.pre_dispatch";
const CONTEXT_KEYS = ["task", "agent", "dispatch"] as const;
const TASK_FIELDS = new Set([
  "id",
  "title",
  "taskFamily",
  "workMode",
  "riskClass",
  "targetAgent",
  "resultMode",
  "status",
  "targetFiles",
  "forbiddenChanges",
  "verifyCommands",
  "setupCommands",
  "expectedCommitSubject",
]);
const AGENT_FIELDS = new Set(["id", "role", "writerClass", "worktreePolicy", "mergePolicy"]);
const DISPATCH_FIELDS = new Set([
  "worktreePath",
  "allocationExists",
  "branch",
  "baseCommit",
  "runtimeKind",
]);
const FORBIDDEN_RAW_KEYS = new Set([
  "instructions",
  "rawinstructions",
  "prompt",
  "rawprompt",
  "transcript",
  "messages",
  "conversation",
  "fullcontext",
  "rawcontext",
  "connectordata",
  "hiddenmemory",
  "memory",
  "secrets",
  "credentials",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finding(code: string, path: string, message: string): Finding {
  return { code, path, message };
}

function addUnknownFields(
  findings: Finding[],
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
): void {
  for (const key of Object.keys(value).sort()) {
    if (!allowed.has(key)) {
      findings.push(finding("unknown_context_field", `${path}.${key}`, "context field is not in the bounded worker.pre_dispatch contract"));
    }
  }
}

function addForbiddenRawContext(findings: Finding[], value: unknown, path: string): void {
  if (!isRecord(value)) return;

  for (const key of Object.keys(value).sort()) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_RAW_KEYS.has(key.toLowerCase())) {
      findings.push(finding("forbidden_raw_context", childPath, "long, raw, secret, or unbounded context is not allowed"));
    }
    addForbiddenRawContext(findings, value[key], childPath);
  }
}

function requireRecord(
  findings: Finding[],
  value: unknown,
  path: string,
): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  findings.push(finding("missing_required_context", path, "required context object is missing"));
  return false;
}

function requireString(findings: Finding[], value: Record<string, unknown>, key: string, path: string): void {
  if (typeof value[key] === "string" && value[key].trim().length > 0) return;
  findings.push(finding("missing_required_field", `${path}.${key}`, "required string field is missing"));
}

function requireBoolean(findings: Finding[], value: Record<string, unknown>, key: string, path: string): void {
  if (typeof value[key] === "boolean") return;
  findings.push(finding("missing_required_field", `${path}.${key}`, "required boolean field is missing"));
}

function requireStringArray(findings: Finding[], value: Record<string, unknown>, key: string, path: string): void {
  const field = value[key];
  if (Array.isArray(field) && field.every((item) => typeof item === "string")) return;
  findings.push(finding("missing_required_field", `${path}.${key}`, "required string array field is missing"));
}

function requireNullableString(findings: Finding[], value: Record<string, unknown>, key: string, path: string): void {
  const field = value[key];
  if (typeof field === "string" || field === null) return;
  findings.push(finding("missing_required_field", `${path}.${key}`, "required nullable string field is missing"));
}

function validateTask(findings: Finding[], task: Record<string, unknown>): void {
  addUnknownFields(findings, task, TASK_FIELDS, "context.task");
  for (const key of ["id", "title", "taskFamily", "workMode", "riskClass", "targetAgent", "resultMode", "status"]) {
    requireString(findings, task, key, "context.task");
  }
  for (const key of ["targetFiles", "forbiddenChanges", "verifyCommands", "setupCommands"]) {
    requireStringArray(findings, task, key, "context.task");
  }
  requireNullableString(findings, task, "expectedCommitSubject", "context.task");
}

function validateAgent(findings: Finding[], agent: Record<string, unknown>): void {
  addUnknownFields(findings, agent, AGENT_FIELDS, "context.agent");
  for (const key of ["id", "role", "writerClass", "worktreePolicy", "mergePolicy"]) {
    requireString(findings, agent, key, "context.agent");
  }
}

function validateDispatch(findings: Finding[], dispatch: Record<string, unknown>): void {
  addUnknownFields(findings, dispatch, DISPATCH_FIELDS, "context.dispatch");
  requireString(findings, dispatch, "worktreePath", "context.dispatch");
  requireBoolean(findings, dispatch, "allocationExists", "context.dispatch");
  requireString(findings, dispatch, "runtimeKind", "context.dispatch");
  if (dispatch.allocationExists === true) {
    requireString(findings, dispatch, "branch", "context.dispatch");
    requireString(findings, dispatch, "baseCommit", "context.dispatch");
  }
}

function validatePayload(payload: unknown): Finding[] {
  const findings: Finding[] = [];
  if (!requireRecord(findings, payload, "payload")) return findings;

  if (payload.hookId !== HOOK_ID) {
    findings.push(finding("invalid_hook_payload", "payload.hookId", "hook payload id does not match this gate"));
  }
  if (payload.event !== EVENT) {
    findings.push(finding("invalid_hook_payload", "payload.event", "hook payload event is not worker.pre_dispatch"));
  }

  const context = payload.context;
  if (!requireRecord(findings, context, "context")) return findings;

  const contextKeySet = new Set(CONTEXT_KEYS);
  for (const key of Object.keys(context).sort()) {
    if (!contextKeySet.has(key as (typeof CONTEXT_KEYS)[number])) {
      findings.push(finding("unknown_top_level_context", `context.${key}`, "top-level context must be task, agent, or dispatch"));
    }
  }
  for (const key of CONTEXT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(context, key)) {
      findings.push(finding("missing_required_context", `context.${key}`, "required top-level context is missing"));
    }
  }

  addForbiddenRawContext(findings, context, "context");

  if (isRecord(context.task)) validateTask(findings, context.task);
  if (isRecord(context.agent)) validateAgent(findings, context.agent);
  if (isRecord(context.dispatch)) validateDispatch(findings, context.dispatch);

  return findings;
}

function result(findings: Finding[]): HookResult {
  if (findings.length === 0) {
    return {
      hookId: HOOK_ID,
      event: EVENT,
      status: "passed",
      decision: "allow",
      summary: "worker.pre_dispatch context allowed",
      structuredFindings: { findings },
    };
  }

  return {
    hookId: HOOK_ID,
    event: EVENT,
    status: "blocked",
    decision: "block",
    summary: `worker.pre_dispatch context blocked: ${findings.length} finding(s)`,
    structuredFindings: { findings },
  };
}

async function main(): Promise<void> {
  const input = await new Response(Bun.stdin.stream()).text();
  let payload: unknown;
  try {
    payload = JSON.parse(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify(
        result([finding("invalid_json", "stdin", `hook payload must be valid JSON: ${message}`)]),
      ),
    );
    return;
  }

  process.stdout.write(JSON.stringify(result(validatePayload(payload))));
}

await main();
