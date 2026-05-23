import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_HOOK_EVENT_DEFAULTS,
  HOOK_DEFINITION_DIR,
  HOOK_EVENTS,
  HOOK_FAILURE_BEHAVIORS,
  HOOK_MODES,
  HOOK_POLICY_PATH,
  HOOK_RESULT_STATUSES,
  type HookDefinition,
  type HookPolicy,
  isHookEvent,
  isHookMode,
  isHookResultStatus,
  loadHookPolicy,
  runAdvisoryHooks,
  validateHookDefinition,
  validateHookPolicy,
} from "../src/core/hooks";

let tmpRoots: string[] = [];

function policy(overrides: Partial<HookPolicy> = {}): HookPolicy {
  return {
    schemaVersion: 1,
    enabled: true,
    hooks: ["review-task-spec"],
    eventDefaults: {
      "task_spec.drafted": {
        mode: "advisory",
        failureBehavior: "fail_open",
        timeoutMs: 5_000,
      },
    },
    disabledHooks: [],
    ...overrides,
  };
}

function hook(overrides: Partial<HookDefinition> = {}): HookDefinition {
  return {
    schemaVersion: 1,
    id: "review-task-spec",
    purpose: "Review drafted task specs before they are considered ready.",
    mode: "advisory",
    events: ["task_spec.drafted"],
    command: ["bun", "run", "scripts/review-task-spec.ts"],
    timeoutMs: 5_000,
    contextKeys: ["task.id", "task.instructions"],
    stdout: {
      mode: "capped",
      maxBytes: 16_384,
    },
    ...overrides,
  };
}

function contextEchoCommand(): string[] {
  return [
    "bun",
    "--eval",
    `
const input = await new Response(Bun.stdin.stream()).text();
const payload = JSON.parse(input);
console.log(JSON.stringify({
  hookId: payload.hookId,
  event: payload.event,
  status: "passed",
  decision: "allow",
  summary: JSON.stringify({
    cwd: process.cwd(),
    keys: Object.keys(payload.context).sort(),
    id: payload.context["task.id"],
    secret: payload.context.secret ?? null,
    runId: payload.runId
  })
}));
`,
  ];
}

function hookResultCommand(result: Record<string, unknown>): string[] {
  return ["bun", "--eval", `console.log(${JSON.stringify(JSON.stringify(result))});`];
}

function invalidJsonCommand(): string[] {
  return ["bun", "--eval", `console.log("not hook result json");`];
}

function nonZeroCommand(): string[] {
  return ["bun", "--eval", `console.error("hook stderr"); process.exit(7);`];
}

function timeoutCommand(): string[] {
  return ["bun", "--eval", `await new Promise((resolve) => setTimeout(resolve, 1000));`];
}

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-hooks-"));
  tmpRoots.push(root);
  return root;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("Samantha hook policy loading", () => {
  test("loads a valid policy and referenced hook definitions without executing hooks", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"), hook());

    await expect(loadHookPolicy({ repoRoot })).resolves.toEqual({
      status: "enabled",
      reason: null,
      policyPath: join(repoRoot, HOOK_POLICY_PATH),
      definitionDir: join(repoRoot, HOOK_DEFINITION_DIR),
      policy: policy(),
      hooks: [hook()],
      disabledHookIds: [],
      eventDefaults: {
        ...DEFAULT_HOOK_EVENT_DEFAULTS,
        "task_spec.drafted": {
          mode: "advisory",
          failureBehavior: "fail_open",
          timeoutMs: 5_000,
        },
      },
    });
  });

  test("returns disabled no-hooks state when policy is absent without creating repository files", async () => {
    const repoRoot = await makeTempRoot();

    await expect(loadHookPolicy({ repoRoot })).resolves.toEqual({
      status: "disabled",
      reason: "policy_missing",
      policyPath: join(repoRoot, HOOK_POLICY_PATH),
      definitionDir: join(repoRoot, HOOK_DEFINITION_DIR),
      policy: null,
      hooks: [],
      disabledHookIds: [],
      eventDefaults: DEFAULT_HOOK_EVENT_DEFAULTS,
    });
    await expect(pathExists(join(repoRoot, "references"))).resolves.toBe(false);
  });

  test("rejects present invalid hook policy schemas instead of silently disabling hooks", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), {
      ...policy(),
      hooks: ["review-task-spec", "../escape", "review-task-spec"],
      disabledHooks: [{ id: "review-task-spec", reason: " " }],
      extraAuthority: true,
    });

    await expect(loadHookPolicy({ repoRoot })).rejects.toThrow("unknown hook policy field: extraAuthority");
    await expect(loadHookPolicy({ repoRoot })).rejects.toThrow("hook policy hooks[1] must be a stable repo-local hook id");
    await expect(loadHookPolicy({ repoRoot })).rejects.toThrow(
      "hook policy hooks must not contain duplicate ids: review-task-spec",
    );
    await expect(loadHookPolicy({ repoRoot })).rejects.toThrow(
      "hook policy disabledHooks[0].reason must be a non-empty string",
    );
  });

  test("rejects missing referenced hook definitions when policy is enabled", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());

    await expect(loadHookPolicy({ repoRoot })).rejects.toThrow("referenced hook definition missing: review-task-spec");
  });

  test("validates trust-gate failure closed and advisory failure open behavior", () => {
    const violations = validateHookPolicy(
      policy({
        eventDefaults: {
          "task_spec.preflight": {
            mode: "trust_gate",
            failureBehavior: "fail_open",
            timeoutMs: 5_000,
          },
          "worker.completed": {
            mode: "advisory",
            failureBehavior: "fail_closed",
            timeoutMs: 5_000,
          },
        },
      }),
    );

    expect(violations).toContain("hook policy eventDefaults.task_spec.preflight.failureBehavior must be fail_closed");
    expect(violations).toContain("hook policy eventDefaults.worker.completed.failureBehavior must be fail_open");
  });

  test("validates hook definitions with closed events, argv commands, explicit context, caps, and stable ids", () => {
    const violations = validateHookDefinition({
      ...hook(),
      id: "../escape",
      mode: "trust_gate",
      events: ["worker.completed", "worker.done"],
      command: "bun run scripts/review-task-spec.ts",
      timeoutMs: 60_001,
      contextKeys: ["*", "task.id", "task.id"],
      stdout: {
        mode: "capped",
        maxBytes: 16_385,
      },
      writesRepo: true,
    });

    expect(violations).toContain("unknown hook definition field: writesRepo");
    expect(violations).toContain("hook definition id must be a stable repo-local hook id");
    expect(violations).toContain("hook definition mode trust_gate cannot attach to worker.completed; expected advisory");
    expect(violations).toContain(
      "hook definition events[1] must be request.classified, task_spec.drafted, task_spec.preflight, worker.pre_dispatch, worker.completed, verification.completed, or run.completed: worker.done",
    );
    expect(violations).toContain("hook definition command must be a non-empty argv-style string array");
    expect(violations).toContain("hook definition timeoutMs must be an integer from 100 to 60000");
    expect(violations).toContain("hook definition contextKeys[0] must be an explicit context key string");
    expect(violations).toContain("hook definition contextKeys must not contain duplicate keys: task.id");
    expect(violations).toContain("hook definition stdout.maxBytes must be an integer from 0 to 16384");
  });

  test("requires disabled hooks to carry reasons and reference policy hooks", () => {
    const violations = validateHookPolicy(
      policy({
        disabledHooks: [
          { id: "review-task-spec", reason: "" },
          { id: "unreferenced-hook", reason: "Temporarily disabled while dogfooding." },
        ],
      }),
    );

    expect(violations).toContain("hook policy disabledHooks[0].reason must be a non-empty string");
    expect(violations).toContain("hook policy disabledHooks[1].id must reference a policy hook: unreferenced-hook");
  });

  test("exposes closed schema constants and status validators", () => {
    expect(HOOK_EVENTS).toEqual([
      "request.classified",
      "task_spec.drafted",
      "task_spec.preflight",
      "worker.pre_dispatch",
      "worker.completed",
      "verification.completed",
      "run.completed",
    ]);
    expect(HOOK_MODES).toEqual(["advisory", "trust_gate"]);
    expect(HOOK_FAILURE_BEHAVIORS).toEqual(["fail_open", "fail_closed"]);
    expect(HOOK_RESULT_STATUSES).toEqual([
      "passed",
      "blocked",
      "advisory_failed",
      "timed_out",
      "schema_invalid",
    ]);
    expect(isHookEvent("worker.pre_dispatch")).toBe(true);
    expect(isHookEvent("worker.dispatched")).toBe(false);
    expect(isHookMode("trust_gate")).toBe(true);
    expect(isHookMode("blocking")).toBe(false);
    expect(isHookResultStatus("schema_invalid")).toBe(true);
    expect(isHookResultStatus("failed")).toBe(false);
  });

  test("reads policy and definitions without modifying temporary repository artifacts", async () => {
    const repoRoot = await makeTempRoot();
    const policyPath = join(repoRoot, HOOK_POLICY_PATH);
    const definitionPath = join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json");
    const policyText = `${JSON.stringify(policy(), null, 2)}\n`;
    const definitionText = `${JSON.stringify(hook(), null, 2)}\n`;
    await mkdir(dirname(policyPath), { recursive: true });
    await mkdir(dirname(definitionPath), { recursive: true });
    await writeFile(policyPath, policyText, "utf8");
    await writeFile(definitionPath, definitionText, "utf8");

    await loadHookPolicy({ repoRoot });

    await expect(readFile(policyPath, "utf8")).resolves.toBe(policyText);
    await expect(readFile(definitionPath, "utf8")).resolves.toBe(definitionText);
    expect((await readdir(join(repoRoot, "references", "hooks"))).sort()).toEqual(["hook-policy.json", "hooks"]);
    expect((await readdir(join(repoRoot, "references", "hooks", "hooks"))).sort()).toEqual([
      "review-task-spec.json",
    ]);
  });
});

describe("Samantha advisory hook runner", () => {
  test("runs only advisory hooks for the event and delivers bounded context from the repository root", async () => {
    const repoRoot = await makeTempRoot();
    const command = contextEchoCommand();
    await writeJson(
      join(repoRoot, HOOK_POLICY_PATH),
      policy({ hooks: ["review-task-spec", "worker-result-review"] }),
    );
    await writeJson(join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"), hook({ command }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "worker-result-review.json"),
      hook({
        id: "worker-result-review",
        purpose: "Review completed worker results.",
        events: ["worker.completed"],
        command,
      }),
    );

    const loadedPolicy = await loadHookPolicy({ repoRoot });
    const commandCwd = await realpath(repoRoot);
    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy,
      event: "task_spec.drafted",
      runId: "run-1",
      context: {
        "task.id": "task-1",
        secret: "hidden",
      },
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      hookId: "review-task-spec",
      event: "task_spec.drafted",
      command,
      cwd: commandCwd,
      status: "passed",
      decision: "allow",
      exitCode: 0,
      timedOut: false,
      stdoutTruncated: false,
      stderr: "",
      stderrTruncated: false,
      schemaViolations: [],
      contextKeys: ["task.id"],
    });
    expect(evidence[0].startedAt).toEqual(expect.any(String));
    expect(evidence[0].finishedAt).toEqual(expect.any(String));
    expect(evidence[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(evidence[0].contextBytes).toBeGreaterThan(0);
    expect(JSON.parse(evidence[0].summary)).toEqual({
      cwd: commandCwd,
      keys: ["task.id"],
      id: "task-1",
      secret: null,
      runId: "run-1",
    });
  });

  test("caps retained stdout while still parsing the structured hook result", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({
        command: hookResultCommand({
          hookId: "review-task-spec",
          event: "task_spec.drafted",
          status: "passed",
          decision: "allow",
          summary: "x".repeat(80),
        }),
        stdout: {
          mode: "capped",
          maxBytes: 48,
        },
      }),
    );

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-stdout-cap",
      context: {},
    });

    expect(evidence[0]).toMatchObject({
      status: "passed",
      decision: "allow",
      summary: "x".repeat(80),
      stdoutTruncated: true,
    });
    expect(Buffer.byteLength(evidence[0].stdout, "utf8")).toBeLessThanOrEqual(48);
  });

  test("records invalid JSON as fail-open schema evidence", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({ command: invalidJsonCommand() }),
    );

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-invalid-json",
      context: {},
    });

    expect(evidence[0]).toMatchObject({
      status: "schema_invalid",
      decision: "none",
      summary: "Hook result schema invalid.",
      exitCode: 0,
      timedOut: false,
    });
    expect(evidence[0].schemaViolations[0]).toContain("hook stdout must be valid HookResult JSON");
  });

  test("records invalid HookResult schema as fail-open schema evidence", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({
        command: hookResultCommand({
          hookId: "wrong-hook",
          event: "task_spec.drafted",
          status: "passed",
          decision: "allow",
          summary: "looks fine but names the wrong hook",
        }),
      }),
    );

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-invalid-schema",
      context: {},
    });

    expect(evidence[0]).toMatchObject({
      status: "schema_invalid",
      decision: "none",
      summary: "Hook result schema invalid.",
      exitCode: 0,
    });
    expect(evidence[0].schemaViolations).toContain("hook result hookId must be review-task-spec");
  });

  test("records timeouts as fail-open advisory evidence", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({
        command: timeoutCommand(),
        timeoutMs: 100,
      }),
    );

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-timeout",
      context: {},
    });

    expect(evidence[0]).toMatchObject({
      status: "timed_out",
      decision: "none",
      summary: "Hook timed out after 100ms.",
      timedOut: true,
      timeoutMs: 100,
      timeoutDetails: "command exceeded timeoutMs=100",
    });
  });

  test("records non-zero command exits as fail-open advisory evidence", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({ command: nonZeroCommand() }),
    );

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-non-zero",
      context: {},
    });

    expect(evidence[0]).toMatchObject({
      status: "advisory_failed",
      decision: "none",
      summary: "Hook command exited with code 7.",
      exitCode: 7,
      timedOut: false,
    });
    expect(evidence[0].stderr).toBe("hook stderr\n");
  });

  test("records advisory block decisions without throwing or blocking the runner", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({
        command: hookResultCommand({
          hookId: "review-task-spec",
          event: "task_spec.drafted",
          status: "blocked",
          decision: "block",
          summary: "advisory concern only",
        }),
      }),
    );

    await expect(
      runAdvisoryHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.drafted",
        runId: "run-advisory-block",
        context: {},
      }),
    ).resolves.toMatchObject([
      {
        status: "blocked",
        decision: "block",
        summary: "advisory concern only",
      },
    ]);
  });

  test("refuses to execute trust-gate hooks through the advisory runner", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(
      join(repoRoot, HOOK_POLICY_PATH),
      policy({
        hooks: ["pre-dispatch-gate"],
      }),
    );
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "pre-dispatch-gate.json"),
      hook({
        id: "pre-dispatch-gate",
        purpose: "Gate worker dispatch.",
        mode: "trust_gate",
        events: ["worker.pre_dispatch"],
        command: nonZeroCommand(),
        contextKeys: [],
      }),
    );

    await expect(
      runAdvisoryHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "worker.pre_dispatch",
        runId: "run-trust-gate",
        context: {},
      }),
    ).resolves.toEqual([]);
  });
});
