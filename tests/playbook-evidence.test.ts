import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { recordPlaybookEvidence } from "../src/core/lesson-promote";
import type { WorkerRunLog } from "../src/core/run-log";
import type { WorkerDispatchExecution } from "../src/core/worker-dispatch";

let tmpRoots: string[] = [];

const task: TaskSpec = {
  id: "later-evidence-task",
  title: "Later evidence task",
  taskFamily: "core-module",
  workMode: "minimal-change",
  riskClass: "routine",
  targetAgent: "codex-worker",
  targetFiles: ["src/example.ts"],
  forbiddenChanges: ["runs/**"],
  setupCommands: [],
  verifyCommands: ["bun test tests/example.test.ts"],
  instructions: "Fixture.",
  status: "pending",
};

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

function execution(): WorkerDispatchExecution {
  return {
    preparation: {
      taskId: task.id,
      agentId: agent.id,
      worktreePath: "/repo/worktrees/later-evidence-task",
      codex: { prompt: "prompt", command: ["codex", "exec"] },
    },
    setupResults: [],
    command: { command: ["codex", "exec"], exitCode: 0, stdout: "", stderr: "" },
    evaluation: {
      pass: true,
      harness: { status: "pass", note: "ok", commit: "" },
      changedFiles: ["src/example.ts"],
      scopeViolations: [],
      verifyResults: [
        {
          command: "bun test tests/example.test.ts",
          exitCode: 0,
          stdout: "",
          stderr: "",
        },
      ],
    },
    commit: {
      subject: "test: later evidence",
      files: ["src/example.ts"],
      add: { command: ["git", "add", "--", "src/example.ts"], exitCode: 0, stdout: "", stderr: "" },
      commit: { command: ["git", "commit", "-m", "test: later evidence"], exitCode: 0, stdout: "", stderr: "" },
      commitHash: "a".repeat(40),
    },
    pass: true,
  };
}

function runLog(): WorkerRunLog {
  return {
    schemaVersion: 1,
    runId: "later-run",
    startedAt: "2026-05-13T10:00:00.000Z",
    finishedAt: "2026-05-13T10:01:00.000Z",
    task,
    agent,
    input: { repoRoot: "/repo", worktreesDir: "worktrees" },
    result: execution(),
  };
}

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

describe("playbook evidence", () => {
  test("records later run evidence in a promoted playbook", async () => {
    const root = await mkdtemp(join(tmpdir(), "samantha-playbook-evidence-"));
    tmpRoots.push(root);
    const playbookPath = join(root, "references", "playbooks", "cli-command-addition.md");
    const runLogPath = join(root, "runs", "later-run.json");
    await mkdir(join(root, "references", "playbooks"), { recursive: true });
    await mkdir(join(root, "runs"), { recursive: true });
    await writeFile(
      playbookPath,
      `# Playbook: cli-command-addition

## Source
- Source run id: source-run

## Later Evidence
- none recorded
`,
      "utf8",
    );
    await writeFile(runLogPath, `${JSON.stringify(runLog(), null, 2)}\n`, "utf8");

    const result = await recordPlaybookEvidence({
      playbookPath,
      runLogPath,
      assessment: "helped",
      note: "The same parser-plus-core-test shape passed again.",
    });

    const markdown = await readFile(playbookPath, "utf8");
    expect(result).toEqual({
      recorded: true,
      playbookPath,
      runLogPath,
      runId: "later-run",
      taskId: "later-evidence-task",
      outcome: "pass",
      assessment: "helped",
    });
    expect(markdown).toContain("## Later Evidence\n- Run id: later-run");
    expect(markdown).toContain("  - Run log: ");
    expect(markdown).toContain("  - Task id: later-evidence-task");
    expect(markdown).toContain("  - Outcome: pass");
    expect(markdown).toContain("  - Assessment: helped");
    expect(markdown).toContain("  - Note: The same parser-plus-core-test shape passed again.");
    expect(markdown).not.toContain("- none recorded");
  });
});
