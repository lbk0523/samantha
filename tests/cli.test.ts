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
});
