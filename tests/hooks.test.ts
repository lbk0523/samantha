import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
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
  runTrustGateHooks,
  validateHookDefinition,
  validateHookPolicy,
} from "../src/core/hooks";

let tmpRoots: string[] = [];
const execFileAsync = promisify(execFile);

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

function ignoreSigtermCommand(): string[] {
  return ["bun", "--eval", `process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);`];
}

function mutatingHookCommand(): string[] {
  return [
    "bun",
    "--eval",
    `
await Bun.write("hook-output.txt", "mutated by advisory hook\\n");
console.log(JSON.stringify({
  hookId: "review-task-spec",
  event: "task_spec.drafted",
  status: "passed",
  decision: "allow",
  summary: "wrote advisory evidence"
}));
`,
  ];
}

function trustGateResultCommand(overrides: Record<string, unknown> = {}): string[] {
  return hookResultCommand({
    hookId: "preflight-gate",
    event: "task_spec.preflight",
    status: "passed",
    decision: "allow",
    summary: "trust gate allowed",
    ...overrides,
  });
}

function trustGateMarkerCommand(markerPath: string, overrides: Record<string, unknown> = {}): string[] {
  return [
    "bun",
    "--eval",
    `
await Bun.write(${JSON.stringify(markerPath)}, "executed\\n");
console.log(JSON.stringify({
  hookId: "preflight-gate",
  event: "task_spec.preflight",
  status: "passed",
  decision: "allow",
  summary: "trust gate marker executed",
  ...${JSON.stringify(overrides)}
}));
`,
  ];
}

function delayedTrustGateMarkerCommand(markerPath: string, delayMs: number): string[] {
  return [
    "bun",
    "--eval",
    `
await new Promise((resolve) => setTimeout(resolve, ${delayMs}));
await Bun.write(${JSON.stringify(markerPath)}, "executed\\n");
console.log(JSON.stringify({
  hookId: "preflight-gate",
  event: "task_spec.preflight",
  status: "passed",
  decision: "allow",
  summary: "trust gate delayed marker executed"
}));
`,
  ];
}

function delayedTrustGateResultCommand(hookId: string, delayMs: number): string[] {
  return [
    "bun",
    "--eval",
    `
await new Promise((resolve) => setTimeout(resolve, ${delayMs}));
console.log(JSON.stringify({
  hookId: ${JSON.stringify(hookId)},
  event: "task_spec.preflight",
  status: "passed",
  decision: "allow",
  summary: "trust gate delayed allow"
}));
`,
  ];
}

function trustGateMutationCommand(): string[] {
  return [
    "bun",
    "--eval",
    `
await Bun.write("hook-output.txt", "mutated by trust gate\\n");
console.log(JSON.stringify({
  hookId: "preflight-gate",
  event: "task_spec.preflight",
  status: "passed",
  decision: "allow",
  summary: "wrote trust-gate evidence"
}));
`,
  ];
}

function trustGateRemoveGitCommand(): string[] {
  return [
    "bun",
    "--eval",
    `
import { rm } from "node:fs/promises";
await rm(".git", { recursive: true, force: true });
console.log(JSON.stringify({
  hookId: "preflight-gate",
  event: "task_spec.preflight",
  status: "passed",
  decision: "allow",
  summary: "removed git metadata"
}));
`,
  ];
}

function trustHook(overrides: Partial<HookDefinition> = {}): HookDefinition {
  return hook({
    id: "preflight-gate",
    purpose: "Gate task spec preflight before worker dispatch.",
    mode: "trust_gate",
    events: ["task_spec.preflight"],
    command: trustGateResultCommand(),
    contextKeys: [],
    ...overrides,
  });
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

async function initGitRepo(repoRoot: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: repoRoot });
}

async function commitRepo(repoRoot: string): Promise<void> {
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.name=Samantha Test",
      "-c",
      "user.email=samantha@example.invalid",
      "commit",
      "-m",
      "test baseline",
    ],
    { cwd: repoRoot },
  );
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

  test("kills timeout hooks that ignore SIGTERM and still returns timed-out advisory evidence", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({
        command: ignoreSigtermCommand(),
        timeoutMs: 100,
      }),
    );

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-timeout-ignores-sigterm",
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
    expect(evidence[0].durationMs).toBeLessThan(1_000);
  });

  test("records repo file mutations as fail-open evidence without changing the hook decision", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({ command: mutatingHookCommand() }),
    );

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-mutating-hook",
      context: {},
    });

    expect(evidence[0]).toMatchObject({
      status: "passed",
      decision: "allow",
      summary: "wrote advisory evidence",
      repoMutations: {
        detection: "ok",
        created: ["hook-output.txt"],
        modified: [],
        deleted: [],
        error: null,
      },
    });
  });

  test("runs advisory hooks on a dirty repo and records fail-open mutation evidence", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({ command: mutatingHookCommand() }),
    );
    await commitRepo(repoRoot);
    await writeFile(join(repoRoot, "pre-existing-dirty-file.txt"), "dirty before advisory hook\n", "utf8");

    const evidence = await runAdvisoryHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.drafted",
      runId: "run-advisory-dirty-baseline",
      context: {},
    });

    expect(evidence[0]).toMatchObject({
      status: "passed",
      decision: "allow",
      repoMutations: {
        detection: "ok",
        created: ["hook-output.txt"],
        modified: [],
        deleted: [],
      },
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

  test("rejects HookResult status and decision combinations that would broaden authority", async () => {
    const invalidResults = [
      {
        status: "passed",
        decision: "block",
        violation: "hook result decision block is invalid for status passed; expected allow or none",
      },
      {
        status: "blocked",
        decision: "none",
        violation: "hook result decision none is invalid for status blocked; expected block",
      },
      {
        status: "timed_out",
        decision: "allow",
        violation: "hook result decision allow is invalid for status timed_out; expected none",
      },
    ];

    for (const invalidResult of invalidResults) {
      const repoRoot = await makeTempRoot();
      await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
      await writeJson(
        join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
        hook({
          command: hookResultCommand({
            hookId: "review-task-spec",
            event: "task_spec.drafted",
            status: invalidResult.status,
            decision: invalidResult.decision,
            summary: "invalid authority combination",
          }),
        }),
      );

      const evidence = await runAdvisoryHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.drafted",
        runId: `run-invalid-${invalidResult.status}-${invalidResult.decision}`,
        context: {},
      });

      expect(evidence[0]).toMatchObject({
        status: "schema_invalid",
        decision: "none",
        summary: "Hook result schema invalid.",
        exitCode: 0,
      });
      expect(evidence[0].schemaViolations).toContain(invalidResult.violation);
    }
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

describe("Samantha trust-gate hook runner", () => {
  test("allows with empty evidence when policy is missing or disabled", async () => {
    const missingPolicyRoot = await makeTempRoot();
    await expect(
      runTrustGateHooks({
        repoRoot: missingPolicyRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot: missingPolicyRoot }),
        event: "task_spec.preflight",
        runId: "run-missing-policy",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "allow",
        blockingHookId: null,
      },
      evidence: [],
    });

    const disabledPolicyRoot = await makeTempRoot();
    await writeJson(
      join(disabledPolicyRoot, HOOK_POLICY_PATH),
      policy({
        enabled: false,
        hooks: ["preflight-gate"],
      }),
    );

    await expect(
      runTrustGateHooks({
        repoRoot: disabledPolicyRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot: disabledPolicyRoot }),
        event: "task_spec.preflight",
        runId: "run-disabled-policy",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "allow",
        blockingHookId: null,
      },
      evidence: [],
    });
  });

  test("allows with empty evidence when no matching trust-gate hook exists", async () => {
    const repoRoot = await makeTempRoot();
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy());
    await writeJson(join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"), hook());

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: "run-no-matching-trust-hook",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "allow",
        blockingHookId: null,
      },
      evidence: [],
    });
  });

  test("allows only when a trust-gate hook explicitly passes with allow and no repo mutation", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"), trustHook());
    await commitRepo(repoRoot);

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-allow",
      context: {},
    });

    expect(result).toMatchObject({
      final: {
        decision: "allow",
        blockingHookId: null,
      },
      evidence: [
        {
          hookId: "preflight-gate",
          event: "task_spec.preflight",
          status: "passed",
          decision: "allow",
          summary: "trust gate allowed",
          repoMutations: {
            detection: "ok",
            created: [],
            modified: [],
            deleted: [],
            error: null,
          },
        },
      ],
    });
  });

  test("allows worker.pre_dispatch when a matching trust-gate hook passes with allow", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["pre-dispatch-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "pre-dispatch-gate.json"),
      trustHook({
        id: "pre-dispatch-gate",
        purpose: "Gate worker dispatch.",
        events: ["worker.pre_dispatch"],
        command: trustGateResultCommand({
          hookId: "pre-dispatch-gate",
          event: "worker.pre_dispatch",
          summary: "worker dispatch allowed",
        }),
      }),
    );
    await commitRepo(repoRoot);

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "worker.pre_dispatch",
        runId: "run-worker-pre-dispatch-allow",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "allow",
        blockingHookId: null,
      },
      evidence: [
        {
          hookId: "pre-dispatch-gate",
          event: "worker.pre_dispatch",
          status: "passed",
          decision: "allow",
          summary: "worker dispatch allowed",
          repoMutations: {
            detection: "ok",
            created: [],
            modified: [],
            deleted: [],
            error: null,
          },
        },
      ],
    });
  });

  test("blocks when a trust-gate hook returns blocked with block", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({
        command: trustGateResultCommand({
          status: "blocked",
          decision: "block",
          summary: "task spec is not dispatchable",
        }),
      }),
    );
    await commitRepo(repoRoot);

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: "run-trust-block",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "blocked",
          decision: "block",
          summary: "task spec is not dispatchable",
        },
      ],
    });
  });

  test("blocks when a passed trust-gate hook does not explicitly allow", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({
        command: trustGateResultCommand({
          decision: "none",
          summary: "no explicit allow",
        }),
      }),
    );
    await commitRepo(repoRoot);

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: "run-trust-no-allow",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "passed",
          decision: "none",
        },
      ],
    });
  });

  test("blocks on hook timeout and reports the effective event-budget timeout", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({
        command: timeoutCommand(),
        timeoutMs: 500,
      }),
    );
    await commitRepo(repoRoot);

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-timeout",
      context: {},
      eventTimeoutMs: 100,
    });

    expect(result).toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "timed_out",
          decision: "none",
          timedOut: true,
        },
      ],
    });
    expect(result.evidence[0].timeoutMs).toBeGreaterThan(0);
    expect(result.evidence[0].timeoutMs).toBeLessThanOrEqual(100);
    expect(result.evidence[0].timeoutDetails).toBe(
      `command exceeded timeoutMs=${result.evidence[0].timeoutMs}`,
    );
  });

  test("blocks timeout hooks that ignore SIGTERM with bounded completion", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({
        command: ignoreSigtermCommand(),
        timeoutMs: 100,
      }),
    );
    await commitRepo(repoRoot);

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-timeout-ignores-sigterm",
      context: {},
    });

    expect(result).toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "timed_out",
          decision: "none",
          timedOut: true,
          timeoutMs: 100,
        },
      ],
    });
    expect(result.evidence[0].durationMs).toBeLessThan(1_000);
  });

  test("blocks on non-zero exits, invalid JSON, and invalid HookResult schemas", async () => {
    const cases = [
      {
        name: "non-zero",
        command: nonZeroCommand(),
        expectedEvidence: {
          status: "advisory_failed",
          decision: "none",
          summary: "Hook command exited with code 7.",
          exitCode: 7,
        },
        expectedViolation: null,
      },
      {
        name: "invalid-json",
        command: invalidJsonCommand(),
        expectedEvidence: {
          status: "schema_invalid",
          decision: "none",
          summary: "Hook result schema invalid.",
          exitCode: 0,
        },
        expectedViolation: "hook stdout must be valid HookResult JSON",
      },
      {
        name: "invalid-schema",
        command: trustGateResultCommand({
          hookId: "wrong-hook",
          summary: "wrong hook id",
        }),
        expectedEvidence: {
          status: "schema_invalid",
          decision: "none",
          summary: "Hook result schema invalid.",
          exitCode: 0,
        },
        expectedViolation: "hook result hookId must be preflight-gate",
      },
    ];

    for (const testCase of cases) {
      const repoRoot = await makeTempRoot();
      await initGitRepo(repoRoot);
      await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
      await writeJson(
        join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
        trustHook({ command: testCase.command }),
      );
      await commitRepo(repoRoot);

      const result = await runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: `run-trust-${testCase.name}`,
        context: {},
      });

      expect(result).toMatchObject({
        final: {
          decision: "block",
          blockingHookId: "preflight-gate",
        },
        evidence: [testCase.expectedEvidence],
      });
      if (testCase.expectedViolation) {
        expect(result.evidence[0].schemaViolations[0]).toContain(testCase.expectedViolation);
      }
    }
  });

  test("blocks context size overflow before executing the hook command", async () => {
    const repoRoot = await makeTempRoot();
    const markerPath = join(repoRoot, "should-not-run.txt");
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({
        command: trustGateMarkerCommand(markerPath),
        contextKeys: ["task.large"],
      }),
    );

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-context-too-large",
      context: {
        "task.large": "x".repeat(20_000),
      },
    });

    expect(result).toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "schema_invalid",
          decision: "none",
          summary: "Hook context exceeded 16384 bytes.",
          repoMutations: {
            detection: "skipped",
          },
        },
      ],
    });
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("blocks when a trust-gate hook mutates repository files", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({ command: trustGateMutationCommand() }),
    );
    await commitRepo(repoRoot);

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: "run-trust-mutation",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "passed",
          decision: "allow",
          repoMutations: {
            detection: "ok",
            created: ["hook-output.txt"],
          },
        },
      ],
    });
  });

  test("blocks before executing the hook when the repo already has an untracked file", async () => {
    const repoRoot = await makeTempRoot();
    const markerRoot = await makeTempRoot();
    const markerPath = join(markerRoot, "dirty-baseline-hook-ran.txt");
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({ command: trustGateMarkerCommand(markerPath) }),
    );
    await commitRepo(repoRoot);
    await writeFile(join(repoRoot, "pre-existing-untracked.txt"), "dirty before trust gate\n", "utf8");

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-dirty-created-baseline",
      context: {},
    });

    expect(result).toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "advisory_failed",
          decision: "none",
          exitCode: null,
          stdout: "",
          stderr: "",
          repoMutations: {
            detection: "ok",
            created: ["pre-existing-untracked.txt"],
            modified: [],
            deleted: [],
          },
        },
      ],
    });
    expect(result.evidence[0].summary).toContain("pre-existing repository mutations");
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("blocks before executing the hook when the repo already has a modified tracked file", async () => {
    const repoRoot = await makeTempRoot();
    const markerRoot = await makeTempRoot();
    const markerPath = join(markerRoot, "modified-baseline-hook-ran.txt");
    await initGitRepo(repoRoot);
    await writeFile(join(repoRoot, "tracked.txt"), "clean baseline\n", "utf8");
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({ command: trustGateMarkerCommand(markerPath) }),
    );
    await commitRepo(repoRoot);
    await writeFile(join(repoRoot, "tracked.txt"), "dirty before trust gate\n", "utf8");

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-dirty-modified-baseline",
      context: {},
    });

    expect(result).toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "advisory_failed",
          decision: "none",
          exitCode: null,
          stdout: "",
          stderr: "",
          repoMutations: {
            detection: "ok",
            created: [],
            modified: ["tracked.txt"],
            deleted: [],
          },
        },
      ],
    });
    expect(result.evidence[0].summary).toContain("pre-existing repository mutations");
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("blocks before executing the hook when pre-command mutation detection exhausts the event budget", async () => {
    const repoRoot = await makeTempRoot();
    const markerRoot = await makeTempRoot();
    const markerPath = join(markerRoot, "pre-budget-hook-ran.txt");
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({ command: trustGateMarkerCommand(markerPath) }),
    );
    await commitRepo(repoRoot);

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-pre-budget",
      context: {},
      eventTimeoutMs: 1,
    });

    expect(result.final).toMatchObject({
      decision: "block",
      blockingHookId: "preflight-gate",
    });
    expect(result.evidence[0]).toMatchObject({
      status: "advisory_failed",
      decision: "none",
      exitCode: null,
      stdout: "",
    });
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("blocks when a hook command cannot finish within the remaining event budget", async () => {
    const repoRoot = await makeTempRoot();
    const markerRoot = await makeTempRoot();
    const markerPath = join(markerRoot, "post-budget-hook-ran.txt");
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({
        command: delayedTrustGateMarkerCommand(markerPath, 300),
        timeoutMs: 500,
      }),
    );
    await commitRepo(repoRoot);

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-post-budget",
      context: {},
      eventTimeoutMs: 180,
    });

    expect(result.final).toMatchObject({
      decision: "block",
      blockingHookId: "preflight-gate",
    });
    expect(result.evidence[0]).toMatchObject({
      hookId: "preflight-gate",
      status: "timed_out",
      decision: "none",
      timedOut: true,
    });
    expect(result.evidence[0].timeoutMs).toBeLessThanOrEqual(180);
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("bounds later hook commands to the remaining trust-gate event budget", async () => {
    const repoRoot = await makeTempRoot();
    const markerRoot = await makeTempRoot();
    const markerPath = join(markerRoot, "late-hook-side-effect.txt");
    await initGitRepo(repoRoot);
    await writeJson(
      join(repoRoot, HOOK_POLICY_PATH),
      policy({ hooks: ["slow-preflight-gate", "late-preflight-gate"] }),
    );
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "slow-preflight-gate.json"),
      trustHook({
        id: "slow-preflight-gate",
        command: delayedTrustGateResultCommand("slow-preflight-gate", 420),
        timeoutMs: 1_000,
      }),
    );
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "late-preflight-gate.json"),
      trustHook({
        id: "late-preflight-gate",
        command: delayedTrustGateMarkerCommand(markerPath, 300),
        timeoutMs: 1_000,
      }),
    );
    await commitRepo(repoRoot);

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-late-budget",
      context: {},
      eventTimeoutMs: 600,
    });

    expect(result.final).toMatchObject({
      decision: "block",
      blockingHookId: "late-preflight-gate",
    });
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toMatchObject({
      hookId: "slow-preflight-gate",
      status: "passed",
      decision: "allow",
    });
    expect(result.evidence[1].hookId).toBe("late-preflight-gate");
    expect(result.evidence[1].timeoutMs).toBeLessThan(1_000);
    expect(result.evidence[1].status).toBe("timed_out");
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("blocks before executing the hook when pre-command mutation detection reports not_git", async () => {
    const repoRoot = await makeTempRoot();
    const markerPath = join(repoRoot, "pre-command-not-git-hook-ran.txt");
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({ command: trustGateMarkerCommand(markerPath) }),
    );

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-pre-not-git",
      context: {},
    });

    expect(result).toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          hookId: "preflight-gate",
          event: "task_spec.preflight",
          status: "advisory_failed",
          decision: "none",
          exitCode: null,
          stdout: "",
          stderr: "",
          timedOut: false,
          repoMutations: {
            detection: "not_git",
          },
        },
      ],
    });
    expect(result.evidence[0].summary).toContain("pre-command repo mutation detection was not_git");
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("blocks when post-command mutation detection reports not_git", async () => {
    const repoRoot = await makeTempRoot();
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({ command: trustGateRemoveGitCommand() }),
    );
    await commitRepo(repoRoot);

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: "run-trust-post-not-git",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [
        {
          status: "passed",
          decision: "allow",
          summary: "removed git metadata",
          repoMutations: {
            detection: "not_git",
          },
        },
      ],
    });
  });

  test("runs matching trust-gate hooks in policy order and short-circuits after the first block", async () => {
    const repoRoot = await makeTempRoot();
    const markerPath = join(repoRoot, "second-hook-ran.txt");
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["first-gate", "second-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "first-gate.json"),
      trustHook({
        id: "first-gate",
        command: trustGateResultCommand({
          hookId: "first-gate",
          status: "blocked",
          decision: "block",
          summary: "first gate blocked",
        }),
      }),
    );
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "second-gate.json"),
      trustHook({
        id: "second-gate",
        command: trustGateMarkerCommand(markerPath, {
          hookId: "second-gate",
          summary: "second gate executed",
        }),
      }),
    );
    await commitRepo(repoRoot);

    const result = await runTrustGateHooks({
      repoRoot,
      loadedPolicy: await loadHookPolicy({ repoRoot }),
      event: "task_spec.preflight",
      runId: "run-trust-short-circuit",
      context: {},
    });

    expect(result).toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "first-gate",
      },
      evidence: [
        {
          hookId: "first-gate",
          status: "blocked",
          decision: "block",
        },
      ],
    });
    expect(result.evidence).toHaveLength(1);
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("does not execute advisory hooks or non-trust events through the trust-gate runner", async () => {
    const repoRoot = await makeTempRoot();
    const markerPath = join(repoRoot, "advisory-hook-ran.txt");
    await initGitRepo(repoRoot);
    await writeJson(
      join(repoRoot, HOOK_POLICY_PATH),
      policy({ hooks: ["preflight-gate", "review-task-spec"] }),
    );
    await writeJson(join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"), trustHook());
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "review-task-spec.json"),
      hook({ command: trustGateMarkerCommand(markerPath) }),
    );
    await commitRepo(repoRoot);

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: "run-trust-skips-advisory",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "allow",
        blockingHookId: null,
      },
      evidence: [
        {
          hookId: "preflight-gate",
          status: "passed",
          decision: "allow",
        },
      ],
    });
    await expect(pathExists(markerPath)).resolves.toBe(false);

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.drafted",
        runId: "run-trust-rejects-advisory-event",
        context: {},
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "block",
        blockingHookId: null,
      },
      evidence: [],
    });
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });

  test("blocks without executing hooks when the trust-gate event budget is already exhausted", async () => {
    const repoRoot = await makeTempRoot();
    const markerPath = join(repoRoot, "budget-exhausted-hook-ran.txt");
    await initGitRepo(repoRoot);
    await writeJson(join(repoRoot, HOOK_POLICY_PATH), policy({ hooks: ["preflight-gate"] }));
    await writeJson(
      join(repoRoot, HOOK_DEFINITION_DIR, "preflight-gate.json"),
      trustHook({ command: trustGateMarkerCommand(markerPath) }),
    );

    await expect(
      runTrustGateHooks({
        repoRoot,
        loadedPolicy: await loadHookPolicy({ repoRoot }),
        event: "task_spec.preflight",
        runId: "run-trust-budget-exhausted",
        context: {},
        eventTimeoutMs: 0,
      }),
    ).resolves.toMatchObject({
      final: {
        decision: "block",
        blockingHookId: "preflight-gate",
      },
      evidence: [],
    });
    await expect(pathExists(markerPath)).resolves.toBe(false);
  });
});
