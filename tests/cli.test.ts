import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseCliArgs } from "../src/cli";
import type { BatchSpec } from "../src/core/batch-spec";
import { DEFAULT_SERIAL_ONLY_RULES } from "../src/core/batch-spec";
import type { TaskSpec } from "../src/core/contracts";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

function cliBatchTask(
  taskId: string,
  overrides: Partial<BatchSpec["tasks"][number]> = {},
): BatchSpec["tasks"][number] {
  return {
    taskId,
    taskSpecPath: `references/tasks/${taskId}.json`,
    targetAgent: "codex-worker",
    declaredTargetFiles: [`tests/${taskId}.test.ts`],
    declaredForbiddenChanges: ["runs/**"],
    expectedVerifyCommands: [`bun test ${taskId}`],
    writeSetClassification: "parallel_eligible",
    classificationReasons: [],
    dispatchGroup: "group-1",
    status: "planned",
    ...overrides,
  };
}

function cliTaskSpecFor(batchTask: BatchSpec["tasks"][number], overrides: Partial<TaskSpec> = {}): TaskSpec {
  return {
    id: batchTask.taskId,
    title: `Task ${batchTask.taskId}`,
    targetAgent: batchTask.targetAgent,
    targetFiles: batchTask.declaredTargetFiles,
    forbiddenChanges: batchTask.declaredForbiddenChanges,
    verifyCommands: batchTask.expectedVerifyCommands,
    instructions: "Make the requested focused change.",
    status: "pending",
    ...overrides,
  };
}

async function writeCliBatchStoreFixture(
  taskSpecOverrides: Partial<TaskSpec> = {},
  batchOverrides: Partial<BatchSpec> = {},
): Promise<{ batchPath: string; batchesDir: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "samantha-cli-batch-"));
  tmpRoots.push(root);
  await mkdir(join(root, "references", "tasks"), { recursive: true });
  const batchesDir = join(root, "references", "batch-specs");
  await mkdir(batchesDir, { recursive: true });
  const batchTask = cliBatchTask("task-a");
  await writeFile(
    join(root, batchTask.taskSpecPath),
    `${JSON.stringify(cliTaskSpecFor(batchTask, taskSpecOverrides), null, 2)}\n`,
    "utf8",
  );
  const batch: BatchSpec = {
    schemaVersion: 1,
    batchId: "cli-preflight",
    repoRoot: root,
    baseCommit: "0123456789abcdef0123456789abcdef01234567",
    status: "planned",
    serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES,
    tasks: [batchTask],
    dependencies: [],
    integrationQueue: [
      {
        order: 1,
        taskId: "task-a",
        requiresAccepted: [],
        focusedVerifyCommands: ["bun test task-a"],
        status: "pending",
      },
    ],
    ...batchOverrides,
  };
  const batchPath = join(batchesDir, "cli-preflight.json");
  await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  return { batchPath, batchesDir, root };
}

async function writeCliBatchPreflightFixture(taskSpecOverrides: Partial<TaskSpec> = {}): Promise<string> {
  return (await writeCliBatchStoreFixture(taskSpecOverrides)).batchPath;
}

describe("samantha cli", () => {
  test("parses run-task arguments", () => {
    expect(
      parseCliArgs([
        "run-task",
        "references/tasks/fixture-single-writer.json",
        "--repo-root=.",
        "--agent=references/agent-profiles/codex-worker.json",
        "--worktrees-dir=worktrees",
        "--runs-dir=runs",
        "--codex-bin=/tmp/fake-codex",
      ]),
    ).toEqual({
      command: "run-task",
      taskPath: "references/tasks/fixture-single-writer.json",
      repoRoot: ".",
      agentPath: "references/agent-profiles/codex-worker.json",
      worktreesDir: "worktrees",
      runsDir: "runs",
      codexBin: "/tmp/fake-codex",
    });
  });

  test("parses run inspection and merge check arguments", () => {
    expect(parseCliArgs(["runs:list", "--runs-dir=runs"])).toEqual({
      command: "runs:list",
      runsDir: "runs",
    });
    expect(parseCliArgs(["runs:show", "run-1", "--runs-dir=runs"])).toEqual({
      command: "runs:show",
      runId: "run-1",
      runsDir: "runs",
    });
    expect(
      parseCliArgs([
        "merge:check",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
      ]),
    ).toEqual({
      command: "merge:check",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
    });
  });

  test("parses lifecycle and cleanup arguments", () => {
    expect(
      parseCliArgs([
        "runs:mark-lifecycle",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--event=merged",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "runs:mark-lifecycle",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      event: "merged",
      stateDir: "state",
    });
    expect(
      parseCliArgs([
        "runs:accept",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "runs:accept",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
      stateDir: "state",
    });
    expect(parseCliArgs(["runs:diagnose", "--run-log=runs/run-1.json"])).toEqual({
      command: "runs:diagnose",
      runLogPath: "runs/run-1.json",
    });
    expect(
      parseCliArgs([
        "reports:summarize",
        "--run-log=runs/review-a.json",
        "--run-log=runs/review-b.json",
      ]),
    ).toEqual({
      command: "reports:summarize",
      runLogPaths: ["runs/review-a.json", "runs/review-b.json"],
    });
    expect(
      parseCliArgs([
        "reports:orchestrate",
        "--repo-root=.",
        "--task=references/tasks/fixture-report-reviewer.json",
        "--task=references/tasks/dogfood-report-reviewer.json",
        "--agent=references/agent-profiles/codex-reviewer.json",
        "--runs-dir=runs",
        "--codex-bin=/tmp/fake-codex",
      ]),
    ).toEqual({
      command: "reports:orchestrate",
      repoRoot: ".",
      taskPaths: [
        "references/tasks/fixture-report-reviewer.json",
        "references/tasks/dogfood-report-reviewer.json",
      ],
      agentPath: "references/agent-profiles/codex-reviewer.json",
      runsDir: "runs",
      codexBin: "/tmp/fake-codex",
    });
    expect(
      parseCliArgs([
        "worktree:cleanup",
        "--run-log=runs/run-1.json",
        "--repo-root=.",
        "--target-branch=main",
        "--state-dir=state",
      ]),
    ).toEqual({
      command: "worktree:cleanup",
      runLogPath: "runs/run-1.json",
      repoRoot: ".",
      targetBranch: "main",
      stateDir: "state",
    });
  });

  test("parses lesson draft arguments", () => {
    expect(parseCliArgs(["lessons:draft", "--run-log=runs/run-1.json"])).toEqual({
      command: "lessons:draft",
      runLogPath: "runs/run-1.json",
    });
  });

  test("parses lesson review and promotion arguments", () => {
    expect(parseCliArgs(["lessons:review", "references/lessons/inbox/run-1.md"])).toEqual({
      command: "lessons:review",
      candidatePath: "references/lessons/inbox/run-1.md",
    });
    expect(parseCliArgs(["lessons:review-inbox", "--repo-root=/tmp/samantha-repo"])).toEqual({
      command: "lessons:review-inbox",
      repoRoot: "/tmp/samantha-repo",
    });
    expect(
      parseCliArgs([
        "lessons:promote",
        "references/lessons/inbox/run-1.md",
        "--playbook-id=cli-command-addition",
      ]),
    ).toEqual({
      command: "lessons:promote",
      candidatePath: "references/lessons/inbox/run-1.md",
      playbookId: "cli-command-addition",
    });
    expect(
      parseCliArgs([
        "lessons:record-evidence",
        "references/playbooks/cli-command-addition.md",
        "--run-log=runs/run-2.json",
        "--assessment=helped",
        "--note=Passed again with the same task shape.",
      ]),
    ).toEqual({
      command: "lessons:record-evidence",
      playbookPath: "references/playbooks/cli-command-addition.md",
      runLogPath: "runs/run-2.json",
      assessment: "helped",
      note: "Passed again with the same task shape.",
    });
  });

  test("lesson review command writes a review artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-"));
    tmpRoots.push(root);
    const candidateDir = join(root, "references", "lessons", "inbox");
    const candidatePath = join(candidateDir, "run-1.md");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      candidatePath,
      `# Lesson Candidate: run-1

## Source
- Source run id: run-1
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/run-1.json

## Evidence
- Observed outcome: stale evidence

### Superseded Context
- Superseded status: superseded by accepted and cleaned run
- Superseding run id: run-2

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["lessons:review", candidatePath])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    const artifactPath = join(root, "references", "lessons", "reviews", "run-1.json");
    expect(result.path).toBe(artifactPath);
    expect(JSON.parse(await readFile(artifactPath, "utf8"))).toMatchObject({
      candidatePath,
      runId: "run-1",
      taskId: "inspect-only",
      observedOutcome: "stale evidence",
      suggestedArtifactType: "run summary / no promotion",
      superseded: {
        stale: true,
        status: "superseded by accepted and cleaned run",
        supersedingRunId: "run-2",
      },
      recommendedAction: "reject",
      classification: "auto_rejected",
      reason: "superseded: superseded by accepted and cleaned run; suggested artifact type marks no promotion",
    });
  });

  test("lesson inbox review command writes review index", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-cli-"));
    tmpRoots.push(root);
    const candidateDir = join(root, "references", "lessons", "inbox");
    await mkdir(candidateDir, { recursive: true });
    await writeFile(
      join(candidateDir, "run-1.md"),
      `# Lesson Candidate: run-1

## Source
- Source run id: run-1
- Task id: inspect-only
- Task title: Inspect only
- Run log: /repo/runs/run-1.json

## Evidence
- Observed outcome: stale evidence

### Superseded Context
- Superseded status: not detected

## Proposed Lesson
- Proposed lesson: Keep as evidence only.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Adds process without reusable value.
`,
      "utf8",
    );

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["lessons:review-inbox", `--repo-root=${root}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    const indexPath = join(root, "references", "lessons", "reviews", "index.json");
    expect(result.indexPath).toBe(indexPath);
    expect(JSON.parse(await readFile(indexPath, "utf8"))).toMatchObject({
      schemaVersion: 1,
      summary: {
        total: 1,
        autoRejected: 1,
        needsMoreEvidence: 0,
        promotionCandidates: 0,
        manualReview: 0,
      },
      candidates: [
        {
          runId: "run-1",
          classification: "auto_rejected",
        },
      ],
    });
  });

  test("parses task creation from template arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-template",
        "core-module-with-tests",
        "--task-id=add-task-template-command",
        "--title=Add task template command",
        "--set=module:task-from-template",
        "--set=command:tasks:from-template",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "tasks:from-template",
      templateId: "core-module-with-tests",
      taskId: "add-task-template-command",
      title: "Add task template command",
      replacements: {
        command: "tasks:from-template",
        module: "task-from-template",
      },
      repoRoot: "/tmp/samantha-repo",
    });
  });

  test("parses task creation from run arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-run",
        "--run-log=runs/run-1.json",
        "--task-id=follow-up-task",
        "--title=Follow up task",
        "--repo-root=/tmp/samantha-repo",
      ]),
    ).toEqual({
      command: "tasks:from-run",
      runLogPath: "runs/run-1.json",
      taskId: "follow-up-task",
      title: "Follow up task",
      repoRoot: "/tmp/samantha-repo",
    });
  });

  test("parses batch preflight arguments", () => {
    expect(parseCliArgs(["batches:preflight", "--batch=references/batches/batch-1.json"])).toEqual({
      command: "batches:preflight",
      batchPath: "references/batches/batch-1.json",
    });
    expect(
      parseCliArgs([
        "batches:preflight",
        "--batch-id=cli-preflight",
        "--batches-dir=references/batch-specs",
      ]),
    ).toEqual({
      command: "batches:preflight",
      batchId: "cli-preflight",
      batchesDir: "references/batch-specs",
    });
    expect(() => parseCliArgs(["batches:preflight"])).toThrow(
      "usage: bun run samantha batches:preflight --batch=<path> OR --batch-id=<id> [--batches-dir=<dir>]",
    );
  });

  test("parses batch list and show arguments", () => {
    expect(parseCliArgs(["batches:list", "--batches-dir=references/batch-specs"])).toEqual({
      command: "batches:list",
      batchesDir: "references/batch-specs",
    });
    expect(parseCliArgs(["batches:show", "--batch-id=cli-preflight"])).toEqual({
      command: "batches:show",
      batchId: "cli-preflight",
    });
  });

  test("batch preflight command prints passing preflight result", async () => {
    const batchPath = await writeCliBatchPreflightFixture();

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:preflight", `--batch=${batchPath}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      mayDispatch: true,
      violations: [],
      tasks: [
        {
          taskId: "task-a",
          taskSpecPath: "references/tasks/task-a.json",
          normalizedTargetFiles: ["tests/task-a.test.ts"],
          normalizedForbiddenChanges: ["runs/**"],
          serialOnlyMatches: [],
        },
      ],
    });
    expect(result.writeSetProofs).toContainEqual({
      dispatchGroup: "group-1",
      taskIds: ["task-a"],
      normalizedTargetFilesByTaskId: {
        "task-a": ["tests/task-a.test.ts"],
      },
    });
  });

  test("batch preflight command returns non-zero when preflight rejects dispatch", async () => {
    const batchPath = await writeCliBatchPreflightFixture({ targetFiles: ["src/different.ts"] });

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:preflight", `--batch=${batchPath}`])).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    const result = JSON.parse(stdout);
    expect(result.mayDispatch).toBe(false);
    expect(result.violations).toContain(
      "tasks[].declaredTargetFiles must match referenced TaskSpec targetFiles: task-a",
    );
  });

  test("batch list command prints store summaries in stable order", async () => {
    const { batchesDir, root } = await writeCliBatchStoreFixture();
    const secondBatch = {
      schemaVersion: 1,
      batchId: "alpha-batch",
      repoRoot: root,
      baseCommit: "0123456789abcdef0123456789abcdef01234567",
      status: "planned",
      serialOnlyRules: DEFAULT_SERIAL_ONLY_RULES,
      tasks: [cliBatchTask("task-a")],
      dependencies: [],
      integrationQueue: [
        {
          order: 1,
          taskId: "task-a",
          requiresAccepted: [],
          focusedVerifyCommands: ["bun test task-a"],
          status: "pending",
        },
      ],
    } satisfies BatchSpec;
    await writeFile(join(batchesDir, "alpha-batch.json"), `${JSON.stringify(secondBatch, null, 2)}\n`, "utf8");

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:list", `--batches-dir=${batchesDir}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout).map((item: { batchId: string }) => item.batchId)).toEqual([
      "alpha-batch",
      "cli-preflight",
    ]);
  });

  test("batch show command prints BatchSpec JSON by id", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture();

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(main(["batches:show", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`])).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout)).toMatchObject({
      batchId: "cli-preflight",
      status: "planned",
      tasks: [{ taskId: "task-a" }],
    });
  });

  test("batch show command fails clearly when id is missing from the store", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture();

    await expect(main(["batches:show", "--batch-id=missing-batch", `--batches-dir=${batchesDir}`])).rejects.toThrow(
      "batch not found: missing-batch",
    );
  });

  test("batch preflight command can read BatchSpec by id", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture();

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main(["batches:preflight", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`]),
      ).resolves.toBe(0);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout)).toMatchObject({
      mayDispatch: true,
      violations: [],
    });
  });

  test("batch preflight by id returns non-zero when preflight rejects dispatch", async () => {
    const { batchesDir } = await writeCliBatchStoreFixture({ targetFiles: ["src/different.ts"] });

    const originalLog = console.log;
    let stdout = "";
    console.log = (message?: unknown) => {
      stdout = String(message);
    };
    try {
      await expect(
        main(["batches:preflight", "--batch-id=cli-preflight", `--batches-dir=${batchesDir}`]),
      ).resolves.toBe(1);
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(stdout).violations).toContain(
      "tasks[].declaredTargetFiles must match referenced TaskSpec targetFiles: task-a",
    );
  });
});
