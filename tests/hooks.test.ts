import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
