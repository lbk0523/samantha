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
});
