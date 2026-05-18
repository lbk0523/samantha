import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SERIAL_ONLY_RULES, type BatchSpec } from "../src/core/batch-spec";
import { executeBatch } from "../src/core/batch-execution";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { git, gitHead } from "../src/core/git";
import type { WorkerRuntimeAdapter } from "../src/core/worker-runtime-adapter";

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

function batchTask(
  taskId: string,
  targetFile: string,
  overrides: Partial<BatchSpec["tasks"][number]> = {},
): BatchSpec["tasks"][number] {
  return {
    taskId,
    taskSpecPath: `references/tasks/${taskId}.json`,
    targetAgent: "codex-worker",
    declaredTargetFiles: [targetFile],
    declaredForbiddenChanges: ["runs/**", ".worktrees/**"],
    expectedVerifyCommands: [`grep -q ${taskId} ${targetFile}`],
    writeSetClassification: "parallel_eligible",
    classificationReasons: [],
    dispatchGroup: "group-1",
    status: "planned",
    ...overrides,
  };
}

function taskSpecFor(batchTask: BatchSpec["tasks"][number]): TaskSpec {
  return {
    id: batchTask.taskId,
    title: `Task ${batchTask.taskId}`,
    taskFamily: "core-module",
    workMode: "tdd-first",
    riskClass: "routine",
    targetAgent: batchTask.targetAgent,
    targetFiles: batchTask.declaredTargetFiles,
    forbiddenChanges: batchTask.declaredForbiddenChanges,
    verifyCommands: batchTask.expectedVerifyCommands,
    instructions: `Write ${batchTask.taskId} into its target file.`,
    expectedCommitSubject: `test: ${batchTask.taskId}`,
    status: "pending",
  };
}

function verification(afterFinalAcceptedMerge: string[] = ["test -f a.txt", "test -f b.txt"]): BatchSpec["verification"] {
  return {
    preflightChecks: [
      "validate batch identity and baseCommit",
      "validate task references against TaskSpec",
      "validate dependency DAG",
      "validate disjoint write sets",
      "validate serial-only classifications",
      "validate integration queue",
    ],
    afterEachAcceptedMerge: ["run focused verify commands for the accepted queue item"],
    afterFinalAcceptedMerge,
  };
}

function lifecyclePolicy(): BatchSpec["lifecyclePolicy"] {
  return {
    staleBase: "block_and_replan",
    rebase: "explicit_samantha_owned_rebase_only",
    partialFailure: "block_dependents_allow_independent_candidates",
    cleanup: "explicit_per_worker_lifecycle_after_resolution",
  };
}

async function makeRepo(tasks: BatchSpec["tasks"]): Promise<{ root: string; baseCommit: string }> {
  const root = await mkdtemp(join(tmpdir(), "samantha-batch-execution-"));
  tmpRoots.push(root);
  await git(["init"], root);
  await git(["checkout", "-b", "main"], root);
  await git(["config", "user.email", "samantha@example.local"], root);
  await git(["config", "user.name", "Samantha Test"], root);
  await mkdir(join(root, "references", "tasks"), { recursive: true });
  await mkdir(join(root, "references", "agent-profiles"), { recursive: true });
  await writeFile(join(root, ".gitignore"), "runs/\n.worktrees/\n", "utf8");
  await writeFile(
    join(root, "references", "agent-profiles", "codex-worker.json"),
    `${JSON.stringify(agent, null, 2)}\n`,
    "utf8",
  );
  for (const task of tasks) {
    await writeFile(join(root, task.taskSpecPath), `${JSON.stringify(taskSpecFor(task), null, 2)}\n`, "utf8");
  }
  await git(["add", "."], root);
  await git(["commit", "-m", "chore: initial batch execution fixture"], root);
  return { root, baseCommit: await gitHead(root) };
}

async function makeFakeCodex(scriptLines: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-fake-batch-codex-"));
  tmpRoots.push(root);
  const path = join(root, "fake-codex");
  await writeFile(path, ["#!/usr/bin/env bash", ...scriptLines, ""].join("\n"), "utf8");
  await chmod(path, 0o755);
  return path;
}

function batchSpec(input: {
  root: string;
  baseCommit: string;
  tasks: BatchSpec["tasks"];
  dependencies?: BatchSpec["dependencies"];
  integrationQueue: BatchSpec["integrationQueue"];
  finalVerify?: string[];
}): BatchSpec {
  return {
    schemaVersion: 1,
    batchId: "batch-execution-fixture",
    repoRoot: input.root,
    baseCommit: input.baseCommit,
    status: "planned",
    serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES,
    tasks: input.tasks,
    dependencies: input.dependencies ?? [],
    integrationQueue: input.integrationQueue,
    verification: verification(input.finalVerify),
    lifecyclePolicy: lifecyclePolicy(),
  };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("batch execution", () => {
  test("dispatches a ready writer group from baseCommit, integrates in queue order, verifies, and cleans up", async () => {
    const tasks = [batchTask("task-a", "a.txt"), batchTask("task-b", "b.txt")];
    const { root, baseCommit } = await makeRepo(tasks);
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      'case "$PWD" in',
      '  *task-a) echo task-a > a.txt ;;',
      '  *task-b) echo task-b > b.txt ;;',
      '  *) echo unknown task >&2; exit 2 ;;',
      "esac",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"batch fixture","commit":""}'`,
    ]);

    const result = await executeBatch({
      spec: batchSpec({
        root,
        baseCommit,
        tasks,
        integrationQueue: [
          {
            order: 1,
            taskId: "task-a",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-a a.txt"],
            status: "pending",
          },
          {
            order: 2,
            taskId: "task-b",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-b b.txt"],
            status: "pending",
          },
        ],
      }),
      worktreesDir: ".worktrees",
      runsDir: join(root, "runs"),
      codexBin: fakeCodex,
      targetBranch: "main",
    });

    expect(result.pass).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.dispatchGroups).toEqual([{ dispatchGroup: "group-1", taskIds: ["task-a", "task-b"], status: "dispatched" }]);
    expect(result.workers.map((worker) => worker.execution.runtime?.kind)).toEqual(["exec-json", "exec-json"]);
    expect(result.workers.map((worker) => worker.execution.preparation.allocation?.baseCommit)).toEqual([
      baseCommit,
      baseCommit,
    ]);
    expect(result.integration.map((item) => [item.taskId, item.status])).toEqual([
      ["task-a", "accepted"],
      ["task-b", "accepted"],
    ]);
    expect(result.integration.every((item) => item.lifecycle?.merged?.mergedAt)).toBe(true);
    expect(result.integration.every((item) => item.cleanup?.cleaned)).toBe(true);
    expect(await git(["log", "--pretty=%s", "--max-count=2"], root)).toContain("Merge commit");
  });

  test("blocks failed task dependents but keeps independent candidates eligible", async () => {
    const tasks = [
      batchTask("task-a", "a.txt"),
      batchTask("task-b", "b.txt"),
      batchTask("task-c", "c.txt", { dispatchGroup: "group-2" }),
    ];
    const { root, baseCommit } = await makeRepo(tasks);
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      'case "$PWD" in',
      '  *task-a) echo task-a failed >&2; exit 7 ;;',
      '  *task-b) echo task-b > b.txt ;;',
      '  *task-c) echo task-c > c.txt ;;',
      "esac",
      `echo 'HARNESS_RESULT: {"status":"pass","note":"batch fixture","commit":""}'`,
    ]);

    const result = await executeBatch({
      spec: batchSpec({
        root,
        baseCommit,
        tasks,
        dependencies: [{ before: "task-a", after: "task-c" }],
        integrationQueue: [
          {
            order: 1,
            taskId: "task-a",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-a a.txt"],
            status: "pending",
          },
          {
            order: 2,
            taskId: "task-b",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-b b.txt"],
            status: "pending",
          },
          {
            order: 3,
            taskId: "task-c",
            requiresAccepted: ["task-a"],
            focusedVerifyCommands: ["grep -q task-c c.txt"],
            status: "pending",
          },
        ],
        finalVerify: ["test -f b.txt"],
      }),
      worktreesDir: ".worktrees",
      runsDir: join(root, "runs"),
      codexBin: fakeCodex,
      targetBranch: "main",
    });

    expect(result.pass).toBe(false);
    expect(result.status).toBe("partially_failed");
    expect(result.taskDecisions["task-a"]).toBe("failed");
    expect(result.taskDecisions["task-b"]).toBe("cleaned");
    expect(result.taskDecisions["task-c"]).toBe("blocked");
    expect(result.integration.map((item) => [item.taskId, item.status])).toEqual([
      ["task-a", "skipped"],
      ["task-b", "accepted"],
      ["task-c", "blocked"],
    ]);
  });

  test("rejects stale base before dispatch through the BatchSpec preflight gate", async () => {
    const tasks = [batchTask("task-a", "a.txt")];
    const { root, baseCommit } = await makeRepo(tasks);
    await writeFile(join(root, "advanced.txt"), "advanced\n", "utf8");
    await git(["add", "advanced.txt"], root);
    await git(["commit", "-m", "chore: advance fixture"], root);

    const result = await executeBatch({
      spec: batchSpec({
        root,
        baseCommit,
        tasks,
        integrationQueue: [
          {
            order: 1,
            taskId: "task-a",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-a a.txt"],
            status: "pending",
          },
        ],
      }),
      worktreesDir: ".worktrees",
      runsDir: join(root, "runs"),
      codexBin: "/bin/false",
      targetBranch: "main",
    });

    expect(result.status).toBe("preflight_failed");
    expect(result.pass).toBe(false);
    expect(result.staleBaseReplan).toMatchObject({
      batchId: "batch-execution-fixture",
      policy: "block_and_replan",
      decision: "blocked_for_replan",
      trigger: "preflight",
      sourceBaseCommit: baseCommit,
      observedHead: await gitHead(root),
      sourceBatchSpecMutation: "not_performed",
      replanArtifactPath: null,
    });
    expect(result.preflight.violations).toContain(
      `repoRoot HEAD must match baseCommit before dispatch: HEAD ${await gitHead(root)} != baseCommit ${baseCommit}`,
    );
    const evidence = JSON.parse(await readFile(join(root, "runs", "batch-replan-evidence.jsonl"), "utf8"));
    expect(evidence).toEqual(result.staleBaseReplan);
  });

  test("records block_and_replan evidence when target HEAD moves during integration", async () => {
    const tasks = [batchTask("task-a", "a.txt")];
    const { root, baseCommit } = await makeRepo(tasks);
    const fakeCodex = await makeFakeCodex([
      'while [ "$1" != "--cd" ]; do shift; done',
      "shift",
      'cd "$1"',
      "echo task-a > a.txt",
      'target_root="$(cd "$PWD/../.." && pwd)"',
      'echo advanced > "$target_root/advanced.txt"',
      'git -C "$target_root" add advanced.txt',
      'git -C "$target_root" commit -m "chore: advance target during batch"',
      `echo 'HARNESS_RESULT: {"status":"pass","note":"batch fixture","commit":""}'`,
    ]);

    const result = await executeBatch({
      spec: batchSpec({
        root,
        baseCommit,
        tasks,
        integrationQueue: [
          {
            order: 1,
            taskId: "task-a",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-a a.txt"],
            status: "pending",
          },
        ],
      }),
      worktreesDir: ".worktrees",
      runsDir: join(root, "runs"),
      codexBin: fakeCodex,
      targetBranch: "main",
    });

    const head = await gitHead(root);
    expect(result.status).toBe("stale_base");
    expect(result.pass).toBe(false);
    expect(result.taskDecisions["task-a"]).toBe("blocked");
    expect(result.staleBaseReplan).toMatchObject({
      batchId: "batch-execution-fixture",
      policy: "block_and_replan",
      decision: "blocked_for_replan",
      trigger: "integration",
      sourceBaseCommit: baseCommit,
      observedHead: head,
      expectedIntegrationHead: baseCommit,
      sourceBatchSpecMutation: "not_performed",
      replanArtifactPath: null,
    });
    expect(result.violations).toContain(
      `target repo HEAD changed outside batch integration: HEAD ${head} != expected ${baseCommit}`,
    );
    const evidence = JSON.parse(await readFile(join(root, "runs", "batch-replan-evidence.jsonl"), "utf8"));
    expect(evidence).toEqual(result.staleBaseReplan);
  });

  test("blocks authority-boundary serial-only tasks from routine batch execution", async () => {
    const tasks = [
      batchTask("task-policy", "src/core/policy.ts", {
        writeSetClassification: "serial_only",
        classificationReasons: ["policy changes control dispatch authority"],
        dispatchGroup: "serial-policy",
      }),
    ];
    const { root, baseCommit } = await makeRepo(tasks);

    const result = await executeBatch({
      spec: batchSpec({
        root,
        baseCommit,
        tasks,
        integrationQueue: [
          {
            order: 1,
            taskId: "task-policy",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-policy src/core/policy.ts"],
            status: "pending",
          },
        ],
        finalVerify: ["true"],
      }),
      worktreesDir: ".worktrees",
      runsDir: join(root, "runs"),
      codexBin: "/bin/false",
      targetBranch: "main",
    });

    expect(result.status).toBe("partially_failed");
    expect(result.taskDecisions["task-policy"]).toBe("blocked");
    expect(result.violations).toContain(
      "authority-boundary serial_only task requires a separate doctrine/policy task: task-policy matches policy",
    );
  });

  test("propagates explicit codex-sdk runtime to worker dispatch without BatchSpec policy", async () => {
    const tasks = [batchTask("task-a", "a.txt")];
    const { root, baseCommit } = await makeRepo(tasks);
    const sdkAdapter: WorkerRuntimeAdapter = {
      kind: "codex-sdk",
      prepare(input) {
        return {
          prompt: input.task.instructions,
          command: ["codex-sdk", "run", "--cd", input.worktreePath],
        };
      },
      async execute(input) {
        return {
          command: {
            command: input.dispatch.command,
            exitCode: 1,
            stdout: "",
            stderr: "intentional fake sdk failure",
          },
          runtime: { kind: "codex-sdk", approvalPolicy: "never" },
        };
      },
    };

    const result = await executeBatch({
      spec: batchSpec({
        root,
        baseCommit,
        tasks,
        integrationQueue: [
          {
            order: 1,
            taskId: "task-a",
            requiresAccepted: [],
            focusedVerifyCommands: ["grep -q task-a a.txt"],
            status: "pending",
          },
        ],
      }),
      worktreesDir: ".worktrees",
      runsDir: join(root, "runs"),
      runtimeKind: "codex-sdk",
      runtimeAdapter: sdkAdapter,
      targetBranch: "main",
    });

    expect(result.preflight.mayDispatch).toBe(true);
    expect(result.dispatchGroups).toEqual([{ dispatchGroup: "group-1", taskIds: ["task-a"], status: "dispatched" }]);
    expect(result.workers).toHaveLength(1);
    expect(result.workers[0].execution.runtime?.kind).toBe("codex-sdk");
    expect(result.workers[0].execution.command?.command[0]).toBe("codex-sdk");
    expect(result.taskDecisions["task-a"]).toBe("failed");
  });
});
