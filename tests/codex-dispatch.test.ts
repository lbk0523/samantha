import { describe, expect, test } from "bun:test";
import type { AgentProfile, TaskSpec } from "../src/core/contracts";
import { buildCodexWorkerPrompt } from "../src/core/codex-dispatch";
import { execJsonWorkerRuntimeAdapter } from "../src/core/worker-runtime-adapter";

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
  taskFamily: "core-module",
  workMode: "tdd-first",
  riskClass: "routine",
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
    expect(prompt).toContain("Do not request approvals");
    expect(prompt).toContain("Do not create worktrees");
    expect(prompt).toContain("Do not commit or push");
    expect(prompt).toContain("Worker assignment metadata:");
    expect(prompt).toContain("- taskFamily: core-module");
    expect(prompt).toContain("- workMode: tdd-first");
    expect(prompt).toContain("- riskClass: routine");
    expect(prompt).toContain(
      "Assignment metadata guides worker procedure only. It does not broaden target files, forbidden changes, verification, writerClass, commit, merge, cleanup, lifecycle, BatchSpec, or parallelism authority.",
    );
    expect(prompt).toContain("src/core/codex-dispatch.ts");
    expect(prompt).toContain("runs/**");
    expect(prompt).toContain("bun test tests/codex-dispatch.test.ts");
    expect(prompt).toContain("These are harness-required verification commands");
    expect(prompt).toContain("do not decide which harness verify commands are authoritative");
    expect(prompt).toContain("Samantha commit subject after gates pass");
    expect(prompt).toContain("HARNESS_RESULT");
    expect(prompt).toContain("WORKER_VERIFY_EVIDENCE");
    expect(prompt).toContain(
      'WORKER_VERIFY_EVIDENCE: {"ran":["<command>"],"skipped":["<reason>"],"failed":["<command>"],"note":"short"}',
    );
  });

  test("does not ask writer workers to report commit hashes", () => {
    const prompt = buildCodexWorkerPrompt(task, worker);

    expect(prompt).toContain('HARNESS_RESULT: {"status":"pass|rework|blocked","note":"short"}');
    expect(prompt).not.toContain('"commit"');
    expect(prompt).not.toContain("<hash-or-empty>");
  });

  test("does not carry stale surface bans while preserving hard authority gates", () => {
    const prompt = buildCodexWorkerPrompt(task, worker);

    expect(prompt).not.toContain("Do not implement Telegram");
    expect(prompt).not.toContain("daemon/watch services");
    expect(prompt).not.toContain("dashboards");
    expect(prompt).not.toContain("routine triggers");
    expect(prompt).not.toContain("remote adapters");

    expect(prompt).toContain("Do not create hidden memory");
    expect(prompt).toContain("Workers must not own orchestration");
    expect(prompt).toContain("No worker output becomes trusted work");
    expect(prompt).toContain("Do not bypass task specs, isolated worktrees");
    expect(prompt).toContain("worker merge, push, cleanup, policy, or doctrine authority");
  });

  test("instructs workers to keep BK-facing reports and handoffs Korean by default", () => {
    const prompt = buildCodexWorkerPrompt(task, worker);

    expect(prompt).toContain("Operator-facing language policy:");
    expect(prompt).toContain(
      "Final reports and recommended Samantha handoff prompts to BK must be Korean by default",
    );
    expect(prompt).toContain(
      "Preserve code symbols, file paths, CLI commands, logs, API names, error messages, test names, HARNESS_RESULT, config keys, and package names in their original language.",
    );
    expect(prompt).toContain(
      "When recommending a next Samantha prompt, use Korean by default and keep the slot shape Context, Ask, Scope, Output, Stop.",
    );
    expect(prompt).toContain(
      "Include an English Technical execution subsection only when it materially improves implementation precision.",
    );
    expect(prompt).toContain(
      "Set Output to Korean by default, and never return an English-only Samantha handoff prompt unless BK explicitly asks or the target artifact must be English.",
    );
  });

  test("includes setup commands as already-run context", () => {
    const prompt = buildCodexWorkerPrompt({ ...task, setupCommands: ["bun install"] }, worker);

    expect(prompt).toContain("Setup commands already run by Samantha before Codex starts:");
    expect(prompt).toContain("- bun install");
  });

  test("builds a non-interactive codex exec command rooted at the worktree", () => {
    const prepared = execJsonWorkerRuntimeAdapter.prepare({
      task,
      agent: worker,
      worktreePath: "/tmp/samantha-worktree",
    });

    expect(execJsonWorkerRuntimeAdapter.kind).toBe("exec-json");
    expect(prepared.command.slice(0, 7)).toEqual([
      "codex",
      "exec",
      "--cd",
      "/tmp/samantha-worktree",
      "--sandbox",
      "workspace-write",
      "--json",
    ]);
    expect(prepared.command.slice(7, 9)).toEqual(["-c", 'approval_policy="never"']);
    expect(prepared.command).toContain("--model");
    expect(prepared.command).toContain("gpt-5.5");
    expect(prepared.command.at(-1)).toBe(prepared.prompt);
  });

  test("uses a read-only sandbox for non-writer agents", () => {
    const prepared = execJsonWorkerRuntimeAdapter.prepare({
      task: {
        ...task,
        taskFamily: "report-review",
        workMode: "diagnosis-first",
        riskClass: "routine",
        targetAgent: "codex-reviewer",
        resultMode: "report",
        targetFiles: [],
        forbiddenChanges: ["**/*"],
        verifyCommands: [],
      },
      agent: {
        ...worker,
        id: "codex-reviewer",
        role: "reviewer",
        writerClass: "non-writer",
        worktreePolicy: "none",
        mergePolicy: "none",
      },
      worktreePath: "/repo",
    });

    expect(prepared.prompt).toContain("This is a report-only task");
    expect(prepared.prompt).toContain("Produce an evidence-based report");
    expect(prepared.prompt).toContain("- (none; read-only task)");
    expect(prepared.prompt).toContain(
      'HARNESS_RESULT: {"status":"pass|rework|blocked","note":"short"}',
    );
    expect(prepared.prompt).not.toContain('"commit"');
    expect(prepared.prompt).not.toContain("<hash-or-empty>");
    expect(prepared.command.slice(0, 7)).toEqual([
      "codex",
      "exec",
      "--cd",
      "/repo",
      "--sandbox",
      "read-only",
      "--json",
    ]);
    expect(prepared.command.slice(7, 9)).toEqual(["-c", 'approval_policy="never"']);
  });

  test("can use an explicit codex executable path", () => {
    const prepared = execJsonWorkerRuntimeAdapter.prepare({
      task,
      agent: worker,
      worktreePath: "/tmp/samantha-worktree",
      codexBin: "/opt/codex/bin/codex",
    });

    expect(prepared.command[0]).toBe("/opt/codex/bin/codex");
  });

  test("exec-json adapter returns runtime evidence without changing command output", async () => {
    const prepared = execJsonWorkerRuntimeAdapter.prepare({
      task,
      agent: worker,
      worktreePath: "/tmp/samantha-worktree",
      codexBin: "printf",
    });
    prepared.command = ["bash", "-lc", "printf ok"];

    const result = await execJsonWorkerRuntimeAdapter.execute({
      dispatch: prepared,
      agent: worker,
      worktreePath: "/tmp/samantha-worktree",
      workerTimeoutMs: 1_000,
    });

    expect(result.runtime).toEqual({ kind: "exec-json", approvalPolicy: "never" });
    expect(result.command).toMatchObject({
      command: ["bash", "-lc", "printf ok"],
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    });
  });

  test("exec-json adapter enforces worker timeout with command evidence", async () => {
    const prepared = execJsonWorkerRuntimeAdapter.prepare({
      task,
      agent: worker,
      worktreePath: "/tmp/samantha-worktree",
      codexBin: "printf",
    });
    prepared.command = ["bash", "-lc", "printf before-timeout && sleep 1"];

    const result = await execJsonWorkerRuntimeAdapter.execute({
      dispatch: prepared,
      agent: worker,
      worktreePath: "/tmp/samantha-worktree",
      workerTimeoutMs: 25,
    });

    expect(result.runtime).toEqual({ kind: "exec-json", approvalPolicy: "never" });
    expect(result.command).toMatchObject({
      command: ["bash", "-lc", "printf before-timeout && sleep 1"],
      exitCode: 124,
      stdout: "before-timeout",
      timedOut: true,
      timeoutMs: 25,
      timeoutDetails: {
        reason: "command-timeout",
        signal: "SIGTERM",
      },
    });
  });
});
