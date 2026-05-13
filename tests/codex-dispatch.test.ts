import { describe, expect, test } from "bun:test";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { buildCodexWorkerPrompt, prepareCodexDispatch } from "../src/core/codex-dispatch";

const worker: AgentProfile = {
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
  id: "task-dispatch-fixture",
  title: "Prepare a Codex dispatch",
  targetAgent: "codex-worker",
  targetFiles: ["src/core/codex-dispatch.ts"],
  forbiddenChanges: ["runs/**", "worktrees/**"],
  verifyCommands: ["bun test tests/codex-dispatch.test.ts"],
  instructions: "Keep dispatch prompt construction deterministic.",
  expectedCommitSubject: "feat: prepare codex dispatch",
  status: "pending",
};

describe("codex dispatch preparation", () => {
  test("builds a prompt with task scope, verification, and HARNESS_RESULT", () => {
    const prompt = buildCodexWorkerPrompt(task, worker);

    expect(prompt).toContain("Samantha owns orchestration");
    expect(prompt).toContain("Do not create worktrees");
    expect(prompt).toContain("Do not commit or push");
    expect(prompt).toContain("src/core/codex-dispatch.ts");
    expect(prompt).toContain("runs/**");
    expect(prompt).toContain("bun test tests/codex-dispatch.test.ts");
    expect(prompt).toContain("Samantha commit subject after gates pass");
    expect(prompt).toContain("HARNESS_RESULT");
  });

  test("includes setup commands as already-run context", () => {
    const prompt = buildCodexWorkerPrompt({ ...task, setupCommands: ["bun install"] }, worker);

    expect(prompt).toContain("Setup commands already run by Samantha before Codex starts:");
    expect(prompt).toContain("- bun install");
  });

  test("builds a non-interactive codex exec command rooted at the worktree", () => {
    const prepared = prepareCodexDispatch(task, worker, "/tmp/samantha-worktree");

    expect(prepared.command.slice(0, 7)).toEqual([
      "codex",
      "exec",
      "--cd",
      "/tmp/samantha-worktree",
      "--sandbox",
      "workspace-write",
      "--json",
    ]);
    expect(prepared.command).toContain("--model");
    expect(prepared.command).toContain("gpt-5.5");
    expect(prepared.command.at(-1)).toBe(prepared.prompt);
  });

  test("uses a read-only sandbox for non-writer agents", () => {
    const prepared = prepareCodexDispatch(
      {
        ...task,
        targetAgent: "codex-reviewer",
        resultMode: "report",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: [],
      },
      {
        ...worker,
        id: "codex-reviewer",
        role: "reviewer",
        writerClass: "non-writer",
        worktreePolicy: "none",
        mergePolicy: "none",
      },
      "/repo",
    );

    expect(prepared.prompt).toContain("This is a report-only task");
    expect(prepared.prompt).toContain("Produce an evidence-based report");
    expect(prepared.prompt).toContain("- (none; read-only task)");
    expect(prepared.command.slice(0, 7)).toEqual([
      "codex",
      "exec",
      "--cd",
      "/repo",
      "--sandbox",
      "read-only",
      "--json",
    ]);
  });

  test("can use an explicit codex executable path", () => {
    const prepared = prepareCodexDispatch(task, worker, "/tmp/samantha-worktree", "/opt/codex/bin/codex");

    expect(prepared.command[0]).toBe("/opt/codex/bin/codex");
  });
});
