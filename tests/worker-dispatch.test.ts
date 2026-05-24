import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";
import {
  HOOK_DEFINITION_DIR,
  HOOK_POLICY_PATH,
  type HookDefinition,
  type HookPolicy,
} from "../src/core/hooks";
import {
  commitWorkerChanges,
  executeWorkerDispatch,
  prepareWorkerDispatch,
  runCommand,
  runSetupCommands,
} from "../src/core/worker-dispatch";
import { createCodexSdkWorkerRuntimeAdapter } from "../src/core/worker-runtime-adapter";
import { runTaskCommand } from "../src/commands/run-task";

let tmpRoots: string[] = [];

const agent: AgentProfile = {
  id: "codex-worker",
  role: "writer",
  model: "gpt-5.5",
  writerClass: "writer",
  worktreePolicy: "per-task",
  mergePolicy: "samantha-controlled",
  skillPolicy: {
    requiredBundles: [],
    blockedSkills: [
      "using-git-worktrees",
      "dispatching-parallel-agents",
      "subagent-driven-development",
    ],
  },
};

const task: TaskSpec = {
  id: "worker-dispatch-fixture",
  title: "Run worker dispatch",
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "lifecycle-sensitive",
  targetAgent: "codex-worker",
  targetFiles: ["README.md"],
  forbiddenChanges: ["runs/**", "worktrees/**"],
  setupCommands: ["test -f README.md"],
  verifyCommands: ["grep -q changed README.md"],
  instructions: "Change README.md to contain the word changed.",
  expectedCommitSubject: "test: dispatch worker fixture",
  status: "pending",
};

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-dispatch-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await writeFile(join(root, "README.md"), "base\n", "utf8");
  await git(["add", "README.md"], root);
  await git(["commit", "-m", "chore: initial fixture"], root);
  return root;
}

async function makeFakeCodex(lines: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-fake-codex-"));
  tmpRoots.push(root);
  const path = join(root, "fake-codex");
  await writeFile(path, ["#!/usr/bin/env bash", ...lines, ""].join("\n"), "utf8");
  await chmod(path, 0o755);
  return path;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function commitRepo(repo: string, subject: string): Promise<void> {
  await git(["add", "."], repo);
  await git(["commit", "-m", subject], repo);
}

function hookPolicy(overrides: Partial<HookPolicy> = {}): HookPolicy {
  return {
    schemaVersion: 1,
    enabled: true,
    hooks: ["pre-dispatch-gate"],
    eventDefaults: {},
    disabledHooks: [],
    ...overrides,
  };
}

function workerPreDispatchResultCommand(overrides: Record<string, unknown> = {}): string[] {
  return [
    "bun",
    "--eval",
    `console.log(${JSON.stringify(
      JSON.stringify({
        hookId: "pre-dispatch-gate",
        event: "worker.pre_dispatch",
        status: "passed",
        decision: "allow",
        summary: "worker dispatch allowed",
        ...overrides,
      }),
    )});`,
  ];
}

function preDispatchHook(overrides: Partial<HookDefinition> = {}): HookDefinition {
  return {
    schemaVersion: 1,
    id: "pre-dispatch-gate",
    purpose: "Gate worker dispatch before setup or worker execution.",
    mode: "trust_gate",
    events: ["worker.pre_dispatch"],
    command: workerPreDispatchResultCommand(),
    timeoutMs: 5_000,
    contextKeys: ["task", "agent", "dispatch"],
    stdout: {
      mode: "capped",
      maxBytes: 16_384,
    },
    ...overrides,
  };
}

function boundedContextHookCommand(): string[] {
  return [
    "bun",
    "--eval",
    `
const input = await new Response(Bun.stdin.stream()).text();
const payload = JSON.parse(input);
const keys = Object.keys(payload.context).sort();
const taskKeys = Object.keys(payload.context.task ?? {}).sort();
const agentKeys = Object.keys(payload.context.agent ?? {}).sort();
const dispatchKeys = Object.keys(payload.context.dispatch ?? {}).sort();
if (keys.some((key) => !["agent", "dispatch", "task"].includes(key))) {
  throw new Error("unexpected top-level context key");
}
if (taskKeys.includes("instructions")) {
  throw new Error("task instructions leaked into hook context");
}
console.log(JSON.stringify({
  hookId: payload.hookId,
  event: payload.event,
  status: "passed",
  decision: "allow",
  summary: JSON.stringify({
    keys,
    taskKeys,
    agentKeys,
    dispatchKeys,
    runtimeKind: payload.context.dispatch?.runtimeKind
  })
}));
`,
  ];
}

async function addWorkerPreDispatchHook(
  repo: string,
  hookOverrides: Partial<HookDefinition> = {},
  policyOverrides: Partial<HookPolicy> = {},
): Promise<void> {
  await writeJson(join(repo, HOOK_POLICY_PATH), hookPolicy(policyOverrides));
  await writeJson(join(repo, HOOK_DEFINITION_DIR, "pre-dispatch-gate.json"), preDispatchHook(hookOverrides));
  await commitRepo(repo, "test: add worker pre-dispatch hook");
}

function reviewerAgent(): AgentProfile {
  return {
    ...agent,
    id: "codex-reviewer",
    role: "reviewer",
    writerClass: "non-writer",
    worktreePolicy: "none",
    mergePolicy: "none",
  };
}

function sdkReportTask(id: string): TaskSpec {
  return {
    id,
    title: "Review SDK runtime fixture",
    taskFamily: "report-review",
    workMode: "diagnosis-first",
    riskClass: "routine",
    targetAgent: "codex-reviewer",
    targetFiles: [],
    forbiddenChanges: ["**/*"],
    verifyCommands: [],
    instructions: "Review evidence and report only.",
    resultMode: "report",
    status: "pending",
  };
}

function expectCommandTiming(result: {
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}): void {
  expect(result.startedAt).toBeTruthy();
  expect(result.finishedAt).toBeTruthy();
  expect(Number.isNaN(Date.parse(result.startedAt!))).toBe(false);
  expect(Number.isNaN(Date.parse(result.finishedAt!))).toBe(false);
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("worker dispatch", () => {
  test("prepares a policy-checked Codex command in an allocated worktree", async () => {
    const repo = await makeRepo();
    const prepared = await prepareWorkerDispatch({
      task,
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
    });

    expect(prepared.taskId).toBe(task.id);
    expect(prepared.agentId).toBe(agent.id);
    expect(prepared.allocation?.branch).toBe("samantha/worker-dispatch-fixture");
    expect(prepared.codex.command).toContain(prepared.worktreePath);
  });

  test("blocks dispatch when generated task placeholders were not narrowed", async () => {
    const repo = await makeRepo();

    await expect(
      prepareWorkerDispatch({
        task: {
          ...task,
          targetFiles: ["src/core/<module>.ts"],
          verifyCommands: ["bun test tests/<module>.test.ts"],
          expectedCommitSubject: "feat: add <module> core behavior",
        },
        agent,
        repoRoot: repo,
        worktreesDir: "worktrees",
      }),
    ).rejects.toThrow("task contains unresolved dispatch placeholders: module");
  });

  test("allows instruction-only CLI metavars during dispatch", async () => {
    const repo = await makeRepo();
    const prepared = await prepareWorkerDispatch({
      task: {
        ...task,
        instructions: "Keep command usage examples like --run-log=<path> in the prompt.",
      },
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
    });

    expect(prepared.taskId).toBe(task.id);
  });

  test("prepares non-writer report tasks without allocating a worktree", async () => {
    const repo = await makeRepo();
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const reportTask: TaskSpec = {
      id: "review-fixture",
      title: "Review fixture",
      taskFamily: "report-review",
      workMode: "diagnosis-first",
      riskClass: "routine",
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      instructions: "Review evidence and report only.",
      resultMode: "report",
      status: "pending",
    };

    const prepared = await prepareWorkerDispatch({
      task: reportTask,
      agent: reviewer,
      repoRoot: repo,
      worktreesDir: "worktrees",
    });

    expect(prepared.worktreePath).toBe(repo);
    expect(prepared.allocation).toBeUndefined();
    expect(prepared.codex.command).toContain("read-only");
  });

  test("runs setup, Codex, evaluation, and Samantha-owned commit after gates pass", async () => {
    const repo = await makeRepo();
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed > README.md",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"changed readme","commit":""}'`,
    ]);

    const result = await executeWorkerDispatch({
      task,
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(true);
    expectCommandTiming(result.preparation.allocationTiming!);
    expectCommandTiming(result.setupResults[0]!);
    expectCommandTiming(result.command!);
    expect(result.setupResults[0]?.exitCode).toBe(0);
    expect(result.command?.command[0]).toBe(fakeCodex);
    expect(result.command?.command).toEqual(result.preparation.codex.command);
    expect(result.runtime).toEqual({ kind: "exec-json", approvalPolicy: "never" });
    expect(result.evaluation?.changedFiles).toEqual(["README.md"]);
    expectCommandTiming(result.evaluation?.harnessTiming!);
    expectCommandTiming(result.evaluation?.verificationTiming!);
    expectCommandTiming(result.evaluation?.verifyResults[0]!);
    expect(result.commit?.subject).toBe("test: dispatch worker fixture");
    expectCommandTiming(result.commit?.add!);
    expectCommandTiming(result.commit?.commit!);
    expect(result.commit?.commitHash).toHaveLength(40);
    expect(await git(["log", "-1", "--pretty=%s"], result.preparation.worktreePath)).toBe(
      "test: dispatch worker fixture",
    );
  });

  test("runs report-only reviewer tasks without committing", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "dirty-before-review.txt"), "pre-existing change\n", "utf8");
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const reportTask: TaskSpec = {
      id: "review-fixture",
      title: "Review fixture",
      taskFamily: "report-review",
      workMode: "diagnosis-first",
      riskClass: "routine",
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      instructions: "Review evidence and report only.",
      resultMode: "report",
      status: "pending",
    };
    const fakeCodex = await makeFakeCodex([
      `echo 'Review: README.md exists and no write is needed.'`,
      `echo 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}'`,
    ]);

    const result = await executeWorkerDispatch({
      task: reportTask,
      agent: reviewer,
      repoRoot: repo,
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(true);
    expect(result.preparation.worktreePath).toBe(repo);
    expect(result.preparation.allocation).toBeUndefined();
    expect(result.evaluation?.changedFiles).toEqual([]);
    expect(result.evaluation?.verifyResults).toEqual([]);
    expect(result.commit).toBeUndefined();
  });

  test("can run a codex-sdk runtime adapter without changing Samantha-owned gates", async () => {
    const repo = await makeRepo();
    const reviewer = reviewerAgent();
    const reportTask = sdkReportTask("sdk-review-fixture");
    const sdkAdapter = createCodexSdkWorkerRuntimeAdapter({
      createClient: () => ({
        startThread: (options) => ({
          id: "thread-from-fake-sdk",
          async runStreamed(input) {
            expect(options?.workingDirectory).toBe(repo);
            expect(options?.sandboxMode).toBe("read-only");
            expect(options?.approvalPolicy).toBe("never");
            expect(input).toContain("Review evidence and report only.");
            async function* events() {
              yield { type: "thread.started", thread_id: "thread-from-fake-sdk" } as const;
              yield { type: "turn.started" } as const;
              yield {
                type: "item.completed",
                item: {
                  id: "message-1",
                  type: "agent_message",
                  text: 'SDK report.\nHARNESS_RESULT: {"status":"pass","note":"sdk report"}',
                },
              } as const;
              yield {
                type: "turn.completed",
                usage: {
                  input_tokens: 1,
                  cached_input_tokens: 0,
                  output_tokens: 1,
                  reasoning_output_tokens: 0,
                },
              } as const;
            }
            return { events: events() };
          },
        }),
      }),
    });

    const result = await executeWorkerDispatch({
      task: reportTask,
      agent: reviewer,
      repoRoot: repo,
      runtimeAdapter: sdkAdapter,
    });

    expect(result.pass).toBe(true);
    expect(result.command).toMatchObject({
      command: ["codex-sdk", "run", "--cd", repo, "--sandbox", "read-only", "--model", "gpt-5.5"],
      exitCode: 0,
    });
    expectCommandTiming(result.command!);
    expect(result.command?.stdout).toContain("HARNESS_RESULT");
    expect(result.runtime).toEqual({
      kind: "codex-sdk",
      approvalPolicy: "never",
      threadId: "thread-from-fake-sdk",
      eventCounts: {
        "thread.started": 1,
        "turn.started": 1,
        "item.completed": 1,
        "turn.completed": 1,
      },
    });
    expect(result.evaluation?.changedFiles).toEqual([]);
    expect(result.evaluation?.verifyResults).toEqual([]);
    expect(result.commit).toBeUndefined();
  });

  test("captures codex-sdk turn.failed errors as diagnosable runtime evidence", async () => {
    const repo = await makeRepo();
    const sdkAdapter = createCodexSdkWorkerRuntimeAdapter({
      createClient: () => ({
        startThread: () => ({
          id: "thread-from-turn-failed",
          async runStreamed() {
            async function* events() {
              yield { type: "thread.started", thread_id: "thread-from-turn-failed" } as const;
              yield { type: "turn.started" } as const;
              yield {
                type: "turn.failed",
                error: { message: "model rejected the request" },
              } as const;
            }
            return { events: events() };
          },
        }),
      }),
    });

    const result = await executeWorkerDispatch({
      task: sdkReportTask("sdk-turn-failed-fixture"),
      agent: reviewerAgent(),
      repoRoot: repo,
      runtimeAdapter: sdkAdapter,
    });

    expect(result.pass).toBe(false);
    expect(result.command).toMatchObject({
      exitCode: 1,
      stderr: "model rejected the request",
    });
    expectCommandTiming(result.command!);
    expect(result.runtime).toEqual({
      kind: "codex-sdk",
      approvalPolicy: "never",
      threadId: "thread-from-turn-failed",
      eventCounts: {
        "thread.started": 1,
        "turn.started": 1,
        "turn.failed": 1,
      },
    });
    expect(result.evaluation?.parseError).toBe("missing HARNESS_RESULT line");
    expect(result.commit).toBeUndefined();
  });

  test("captures codex-sdk stream error events as diagnosable runtime evidence", async () => {
    const repo = await makeRepo();
    const sdkAdapter = createCodexSdkWorkerRuntimeAdapter({
      createClient: () => ({
        startThread: () => ({
          id: "thread-from-stream-error",
          async runStreamed() {
            async function* events() {
              yield { type: "thread.started", thread_id: "thread-from-stream-error" } as const;
              yield {
                type: "error",
                message: "stream lost connection",
              } as const;
            }
            return { events: events() };
          },
        }),
      }),
    });

    const result = await executeWorkerDispatch({
      task: sdkReportTask("sdk-stream-error-fixture"),
      agent: reviewerAgent(),
      repoRoot: repo,
      runtimeAdapter: sdkAdapter,
    });

    expect(result.pass).toBe(false);
    expect(result.command).toMatchObject({
      exitCode: 1,
      stderr: "stream lost connection",
    });
    expect(result.runtime).toEqual({
      kind: "codex-sdk",
      approvalPolicy: "never",
      threadId: "thread-from-stream-error",
      eventCounts: {
        "thread.started": 1,
        error: 1,
      },
    });
    expect(result.commit).toBeUndefined();
  });

  test("captures thrown codex-sdk client exceptions as diagnosable runtime evidence", async () => {
    const repo = await makeRepo();
    const sdkAdapter = createCodexSdkWorkerRuntimeAdapter({
      createClient: () => ({
        startThread: () => {
          throw new Error("client could not start thread");
        },
      }),
    });

    const result = await executeWorkerDispatch({
      task: sdkReportTask("sdk-client-exception-fixture"),
      agent: reviewerAgent(),
      repoRoot: repo,
      runtimeAdapter: sdkAdapter,
    });

    expect(result.pass).toBe(false);
    expect(result.command).toMatchObject({
      exitCode: 1,
      stderr: "codex-sdk runtime failed: client could not start thread",
    });
    expect(result.runtime).toEqual({
      kind: "codex-sdk",
      approvalPolicy: "never",
      eventCounts: {},
    });
    expect(result.evaluation?.parseError).toBe("missing HARNESS_RESULT line");
    expect(result.commit).toBeUndefined();
  });

  test("fails report-only reviewer tasks that change pre-existing dirty files", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "dirty-before-review.txt"), "pre-existing change\n", "utf8");
    const reviewer: AgentProfile = {
      ...agent,
      id: "codex-reviewer",
      role: "reviewer",
      writerClass: "non-writer",
      worktreePolicy: "none",
      mergePolicy: "none",
    };
    const reportTask: TaskSpec = {
      id: "review-fixture",
      title: "Review fixture",
      taskFamily: "report-review",
      workMode: "diagnosis-first",
      riskClass: "routine",
      targetAgent: "codex-reviewer",
      targetFiles: [],
      forbiddenChanges: ["**/*"],
      verifyCommands: [],
      instructions: "Review evidence and report only.",
      resultMode: "report",
      status: "pending",
    };
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed by reviewer > dirty-before-review.txt",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"report only","commit":""}'`,
    ]);

    const result = await executeWorkerDispatch({
      task: reportTask,
      agent: reviewer,
      repoRoot: repo,
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(false);
    expect(result.evaluation?.changedFiles).toEqual(["dirty-before-review.txt"]);
    expect(result.evaluation?.scopeViolations).toContainEqual({
      file: "dirty-before-review.txt",
      reason: "forbidden",
      matchedPattern: "**/*",
    });
    expect(result.commit).toBeUndefined();
  });

  test("stops before Codex when setup fails", async () => {
    const repo = await makeRepo();
    const fakeCodex = await makeFakeCodex(["echo should-not-run"]);

    const result = await executeWorkerDispatch({
      task: { ...task, setupCommands: ["test -f missing.txt"] },
      agent,
      repoRoot: repo,
      worktreesDir: "worktrees",
      codexBin: fakeCodex,
    });

    expect(result.pass).toBe(false);
    expect(result.setupResults[0]?.exitCode).not.toBe(0);
    expectCommandTiming(result.setupResults[0]!);
    expect(result.command).toBeUndefined();
    expect(result.evaluation).toBeUndefined();
    expect(result.commit).toBeUndefined();
  });

  test("does not commit failed verification and still writes a failed run log", async () => {
    const repo = await makeRepo();
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed > README.md",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"verify should fail","commit":""}'`,
    ]);
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(
      taskPath,
      `${JSON.stringify({ ...task, verifyCommands: ["grep -q missing README.md"] }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
      codexBin: fakeCodex,
      runtimeKind: "exec-json",
    });
    const rawLog = await readFile(result.runLog.path, "utf8");
    const parsed = JSON.parse(rawLog);

    expect(result.execution.pass).toBe(false);
    expect(result.execution.hookEvidence).toBeUndefined();
    expect(result.execution.runtime).toEqual({ kind: "exec-json", approvalPolicy: "never" });
    expect(result.execution.commit).toBeUndefined();
    expect(result.execution.evaluation?.verifyResults[0]).toMatchObject({
      command: "grep -q missing README.md",
      exitCode: 1,
    });
    expectCommandTiming(result.execution.evaluation?.verifyResults[0]!);
    expect(parsed.result.pass).toBe(false);
    expect(Object.hasOwn(parsed, "hookEvidence")).toBe(false);
    expect(Object.hasOwn(parsed.result, "hookEvidence")).toBe(false);
    expect(result.execution.preparation.allocation).toBeDefined();
    expect(await gitHead(result.execution.preparation.worktreePath)).toBe(
      result.execution.preparation.allocation!.baseCommit,
    );
  });

  test("runs worker.pre_dispatch allow hooks before setup and records top-level run-log evidence", async () => {
    const repo = await makeRepo();
    await addWorkerPreDispatchHook(repo, {
      command: boundedContextHookCommand(),
    });
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed > README.md",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"changed readme","commit":""}'`,
    ]);
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
      codexBin: fakeCodex,
      runtimeKind: "exec-json",
    });
    const parsed = JSON.parse(await readFile(result.runLog.path, "utf8"));
    const hookEvidence = parsed.hookEvidence;
    const invocation = hookEvidence.events[0].invocations[0];
    const summary = JSON.parse(invocation.summary);

    expect(result.execution.pass).toBe(true);
    expect(result.execution.setupResults).toHaveLength(1);
    expect(result.execution.command?.command[0]).toBe(fakeCodex);
    expect(result.execution.evaluation?.changedFiles).toEqual(["README.md"]);
    expect(result.execution.commit?.commitHash).toHaveLength(40);
    expect(result.execution.hookEvidence).toEqual(hookEvidence);
    expect(Object.hasOwn(parsed.result, "hookEvidence")).toBe(false);
    expect(hookEvidence.policy.path.endsWith(HOOK_POLICY_PATH)).toBe(true);
    expect(hookEvidence.policy.digest.startsWith("sha256:")).toBe(true);
    expect(hookEvidence.definitions).toHaveLength(1);
    expect(hookEvidence.definitions[0]).toMatchObject({
      hookId: "pre-dispatch-gate",
    });
    expect(hookEvidence.definitions[0].path.endsWith("pre-dispatch-gate.json")).toBe(true);
    expect(hookEvidence.definitions[0].digest.startsWith("sha256:")).toBe(true);
    expect(hookEvidence.events[0]).toMatchObject({
      event: "worker.pre_dispatch",
      eventVersion: 1,
      trustGate: {
        decision: "allow",
        blockingHookId: null,
      },
    });
    expect(invocation).toMatchObject({
      hookId: "pre-dispatch-gate",
      event: "worker.pre_dispatch",
      cwd: result.execution.preparation.worktreePath,
      status: "passed",
      decision: "allow",
    });
    expect(invocation.contextKeys.sort()).toEqual(["agent", "dispatch", "task"]);
    expect(summary.keys).toEqual(["agent", "dispatch", "task"]);
    expect(summary.taskKeys).toEqual([
      "expectedCommitSubject",
      "forbiddenChanges",
      "id",
      "resultMode",
      "riskClass",
      "setupCommands",
      "status",
      "targetAgent",
      "targetFiles",
      "taskFamily",
      "title",
      "verifyCommands",
      "workMode",
    ]);
    expect(summary.agentKeys).toEqual(["id", "mergePolicy", "role", "worktreePolicy", "writerClass"]);
    expect(summary.dispatchKeys).toEqual([
      "allocationExists",
      "baseCommit",
      "branch",
      "runtimeKind",
      "worktreePath",
    ]);
    expect(summary.runtimeKind).toBe("exec-json");
  });

  test("records present disabled worker.pre_dispatch policy evidence without blocking dispatch", async () => {
    const repo = await makeRepo();
    await writeJson(
      join(repo, HOOK_POLICY_PATH),
      hookPolicy({
        enabled: false,
        hooks: ["pre-dispatch-gate"],
      }),
    );
    await commitRepo(repo, "test: add disabled hook policy");
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo changed > README.md",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"changed readme","commit":""}'`,
    ]);
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
      codexBin: fakeCodex,
      runtimeKind: "exec-json",
    });
    const parsed = JSON.parse(await readFile(result.runLog.path, "utf8"));

    expect(result.execution.pass).toBe(true);
    expect(parsed.hookEvidence.events[0]).toMatchObject({
      event: "worker.pre_dispatch",
      eventVersion: 1,
      trustGate: {
        decision: "allow",
        blockingHookId: null,
      },
      invocations: [],
    });
    expect(parsed.hookEvidence.policy.digest.startsWith("sha256:")).toBe(true);
    expect(parsed.hookEvidence.definitions).toEqual([]);
    expect(Object.hasOwn(parsed.result, "hookEvidence")).toBe(false);
  });

  test("blocks worker.pre_dispatch hooks before setup, worker execution, evaluation, or commit", async () => {
    const repo = await makeRepo();
    await addWorkerPreDispatchHook(repo, {
      command: workerPreDispatchResultCommand({
        status: "blocked",
        decision: "block",
        summary: "worker dispatch denied",
      }),
    });
    const fakeCodex = await makeFakeCodex(["echo should-not-run"]);
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
      codexBin: fakeCodex,
      runtimeKind: "exec-json",
    });
    const parsed = JSON.parse(await readFile(result.runLog.path, "utf8"));

    expect(result.execution.pass).toBe(false);
    expect(result.execution.dispatchError).toContain("worker.pre_dispatch hook gate blocked dispatch");
    expect(result.execution.dispatchError).toContain("worker dispatch denied");
    expect(result.execution.setupResults).toEqual([]);
    expect(result.execution.command).toBeUndefined();
    expect(result.execution.evaluation).toBeUndefined();
    expect(result.execution.commit).toBeUndefined();
    expect(parsed.hookEvidence.events[0].trustGate).toMatchObject({
      decision: "block",
      blockingHookId: "pre-dispatch-gate",
    });
    expect(parsed.hookEvidence.events[0].invocations[0]).toMatchObject({
      hookId: "pre-dispatch-gate",
      event: "worker.pre_dispatch",
      status: "blocked",
      decision: "block",
      summary: "worker dispatch denied",
    });
    expect(Object.hasOwn(parsed.result, "hookEvidence")).toBe(false);
  });

  test("fails closed on present invalid worker.pre_dispatch hook policy before worker execution", async () => {
    const repo = await makeRepo();
    await writeJson(join(repo, HOOK_POLICY_PATH), {
      ...hookPolicy(),
      extraAuthority: true,
    });
    await commitRepo(repo, "test: add invalid hook policy");
    const fakeCodex = await makeFakeCodex(["echo should-not-run"]);
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
      codexBin: fakeCodex,
      runtimeKind: "exec-json",
    });
    const parsed = JSON.parse(await readFile(result.runLog.path, "utf8"));

    expect(result.execution.pass).toBe(false);
    expect(result.execution.dispatchError).toContain("worker.pre_dispatch hook gate blocked dispatch");
    expect(result.execution.dispatchError).toContain("Hook policy invalid");
    expect(result.execution.setupResults).toEqual([]);
    expect(result.execution.command).toBeUndefined();
    expect(result.execution.evaluation).toBeUndefined();
    expect(result.execution.commit).toBeUndefined();
    expect(parsed.hookEvidence.policy.path.endsWith(HOOK_POLICY_PATH)).toBe(true);
    expect(parsed.hookEvidence.policy.digest.startsWith("sha256:")).toBe(true);
    expect(parsed.hookEvidence.definitions).toEqual([]);
    expect(parsed.hookEvidence.events[0]).toMatchObject({
      event: "worker.pre_dispatch",
      eventVersion: 1,
      trustGate: {
        decision: "block",
        blockingHookId: null,
      },
      invocations: [],
    });
    expect(Object.hasOwn(parsed.result, "hookEvidence")).toBe(false);
  });

  test("records dispatch-blocked tasks before worker start with run-task defaulting to codex-sdk", async () => {
    const repo = await makeRepo();
    await writeJson(join(repo, HOOK_POLICY_PATH), {
      ...hookPolicy(),
      extraAuthority: true,
    });
    const taskPath = join(repo, "task.json");
    const agentPath = join(repo, "agent.json");
    await writeFile(
      taskPath,
      `${JSON.stringify(
        {
          ...task,
          targetFiles: ["src/core/<module>.ts"],
          verifyCommands: ["bun test tests/<module>.test.ts"],
          expectedCommitSubject: "feat: add <module> core behavior",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(agentPath, `${JSON.stringify(agent, null, 2)}\n`, "utf8");

    const result = await runTaskCommand({
      taskPath,
      agentPath,
      repoRoot: repo,
      worktreesDir: "worktrees",
      runsDir: join(repo, "runs"),
    });
    const parsed = JSON.parse(await readFile(result.runLog.path, "utf8"));

    expect(result.execution.pass).toBe(false);
    expect(result.execution.dispatchError).toContain("task contains unresolved dispatch placeholders");
    expect(result.execution.dispatchError).not.toContain("worker.pre_dispatch hook gate");
    expect(result.execution.hookEvidence).toBeUndefined();
    expect(result.execution.preparation.worktreePath).toBe(repo);
    expect(result.execution.preparation.allocation).toBeUndefined();
    expect(result.execution.preparation.codex.command[0]).toBe("codex-sdk");
    expect(result.execution.preparation.codex.command).not.toContain("--json");
    expect(result.execution.command).toBeUndefined();
    expect(result.runSummary).toMatchObject({
      outcome: "blocked",
      pass: false,
      failureReason: result.execution.dispatchError,
      worktreePath: repo,
    });
    expect(parsed.trajectory[0]).toMatchObject({
      event: "planned",
      status: "failed",
      note: "dispatch blocked before worker start",
    });
    expect(Object.hasOwn(parsed, "hookEvidence")).toBe(false);
    expect(Object.hasOwn(parsed.result, "hookEvidence")).toBe(false);
  });

  test("captures command stdout, stderr, and exit code", async () => {
    const result = await runCommand(["bash", "-lc", "echo out && echo err >&2"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("out");
    expect(result.stderr.trim()).toBe("err");
    expectCommandTiming(result);
  });

  test("runs setup commands in order and stops after first failure", async () => {
    const pass = await runSetupCommands(["echo one", "echo two"], "/tmp");
    const fail = await runSetupCommands(["echo one", "exit 7", "echo skipped"], "/tmp");

    expect(pass.map((result) => result.stdout.trim())).toEqual(["one", "two"]);
    for (const result of pass) expectCommandTiming(result);
    expect(fail).toHaveLength(2);
    expect(fail[1]?.exitCode).toBe(7);
    for (const result of fail) expectCommandTiming(result);
  });

  test("creates a Samantha-owned commit from evaluated worker files", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "README.md"), "changed\n", "utf8");

    const result = await commitWorkerChanges({
      task,
      cwd: repo,
      files: ["README.md"],
    });

    expect(result.add.exitCode).toBe(0);
    expect(result.commit.exitCode).toBe(0);
    expectCommandTiming(result.add);
    expectCommandTiming(result.commit);
    expect(result.commitHash).toHaveLength(40);
    expect(await git(["log", "-1", "--pretty=%s"], repo)).toBe("test: dispatch worker fixture");
  });
});
