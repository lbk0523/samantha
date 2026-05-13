import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "../src/cli";

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
  });

  test("parses task creation from template arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-template",
        "core-module-with-tests",
        "--task-id=add-task-template-command",
        "--title=Add task template command",
      ]),
    ).toEqual({
      command: "tasks:from-template",
      templateId: "core-module-with-tests",
      taskId: "add-task-template-command",
      title: "Add task template command",
    });
  });

  test("parses task creation from run arguments", () => {
    expect(
      parseCliArgs([
        "tasks:from-run",
        "--run-log=runs/run-1.json",
        "--task-id=follow-up-task",
        "--title=Follow up task",
      ]),
    ).toEqual({
      command: "tasks:from-run",
      runLogPath: "runs/run-1.json",
      taskId: "follow-up-task",
      title: "Follow up task",
    });
  });
});
