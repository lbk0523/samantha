import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import type { RunTaskCommandResult } from "../src/commands/run-task";
import {
  buildFirstRunDemoPaths,
  formatFirstRunDemoResult,
  runFirstRunDemo,
} from "../src/core/first-run-demo";

let tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.map((root) => rm(root, { recursive: true, force: true })));
  tmpRoots = [];
});

async function tempRepoRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "samantha-first-run-demo-"));
  tmpRoots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "examples", "first-run-demo", "fixture-repo"), { recursive: true });
  await mkdir(join(root, "references", "agent-profiles"), { recursive: true });
  await writeFile(join(root, "src", "cli.ts"), "export {};\n", "utf8");
  await writeFile(join(root, "examples", "first-run-demo", "fixture-repo", "README.md"), "# Fixture\n", "utf8");
  await writeFile(
    join(root, "examples", "first-run-demo", "fixture-repo", "demo-input.txt"),
    "input\n",
    "utf8",
  );
  await writeFile(
    join(root, "references", "agent-profiles", "codex-worker.json"),
    "{}\n",
    "utf8",
  );
  return root;
}

function fakeRunTaskResult(input: {
  pass: boolean;
  worktreePath: string;
  runLogPath: string;
  harnessStatus?: "pass" | "rework" | "blocked";
  verifyExitCode?: number;
  commitHash?: string;
  dispatchError?: string;
}): RunTaskCommandResult {
  return {
    execution: {
      pass: input.pass,
      preparation: {
        taskId: "open-source-first-run-demo",
        agentId: "codex-worker",
        worktreePath: input.worktreePath,
        codex: {} as never,
      },
      setupResults: [],
      ...(input.dispatchError ? { dispatchError: input.dispatchError } : {}),
      evaluation: input.dispatchError
        ? undefined
        : {
            pass: input.pass,
            harness: {
              status: input.harnessStatus ?? "pass",
              note: "",
              commit: "",
            },
            changedFiles: ["demo-output.txt"],
            scopeViolations: [],
            verifyResults: [
              {
                command: "grep -Fx",
                exitCode: input.verifyExitCode ?? 0,
                stdout: "",
                stderr: "",
              },
            ],
          },
      commit: input.commitHash
        ? {
            subject: "docs: add first-run demo output",
            files: ["demo-output.txt"],
            add: { command: ["git", "add"], exitCode: 0, stdout: "", stderr: "" },
            commit: { command: ["git", "commit"], exitCode: 0, stdout: "", stderr: "" },
            commitHash: input.commitHash,
          }
        : undefined,
    },
    runLog: {
      path: input.runLogPath,
      runId: "run-1",
    },
    runSummary: {} as never,
  };
}

describe("first-run demo", () => {
  test("builds generated paths under the demo root", async () => {
    const repoRoot = await tempRepoRoot();
    const paths = buildFirstRunDemoPaths({ repoRoot, demoId: "demo-safe" });

    expect(paths.demoRoot).toBe(join(repoRoot, ".samantha-demo", "demo-safe"));
    expect(paths.fixtureRepo).toBe(join(paths.demoRoot, "fixture-repo"));
    expect(paths.worktreesDir).toBe(join(paths.demoRoot, "worktrees"));
    expect(paths.runsDir).toBe(join(paths.demoRoot, "runs"));
    expect(paths.taskPath).toBe(join(paths.demoRoot, "task.json"));

    for (const path of [paths.fixtureRepo, paths.worktreesDir, paths.runsDir, paths.taskPath]) {
      expect(relative(paths.demoRoot, path).startsWith("..")).toBe(false);
      expect(isAbsolute(relative(paths.demoRoot, path))).toBe(false);
    }
  });

  test("copies the dependency-free fixture and writes an inspectable task", async () => {
    const repoRoot = await tempRepoRoot();
    const result = await runFirstRunDemo({
      repoRoot,
      demoId: "demo-copy",
      executeRunTask: async ({ repoRoot: fixtureRepo, taskPath, worktreesDir, runsDir }) => {
        expect(fixtureRepo).toBe(join(repoRoot, ".samantha-demo", "demo-copy", "fixture-repo"));
        expect(taskPath).toBe(join(repoRoot, ".samantha-demo", "demo-copy", "task.json"));
        expect(worktreesDir).toBe(join(repoRoot, ".samantha-demo", "demo-copy", "worktrees"));
        expect(runsDir).toBe(join(repoRoot, ".samantha-demo", "demo-copy", "runs"));
        return fakeRunTaskResult({
          pass: true,
          worktreePath: join(worktreesDir!, "open-source-first-run-demo"),
          runLogPath: join(runsDir!, "run-1.json"),
          commitHash: "a".repeat(40),
        });
      },
    });

    expect(result.status).toBe("pass");
    await expect(stat(join(result.paths!.fixtureRepo, ".git"))).resolves.toBeTruthy();
    await expect(readFile(join(result.paths!.fixtureRepo, "README.md"), "utf8")).resolves.toBe("# Fixture\n");
    await expect(readFile(join(result.paths!.fixtureRepo, "demo-input.txt"), "utf8")).resolves.toBe("input\n");

    const task = JSON.parse(await readFile(result.paths!.taskPath, "utf8"));
    expect(task.targetFiles).toEqual(["demo-output.txt"]);
    expect(task.forbiddenChanges).toEqual(["README.md", "demo-input.txt", ".git/**"]);
    expect(task.verifyCommands).toEqual([
      "test -f demo-output.txt",
      "grep -Fx \"Samantha first-run demo passed\" demo-output.txt",
    ]);
    expect(task.instructions).toContain("End with exactly one HARNESS_RESULT line.");
  });

  test("formats structured failure output with cleanup guidance", async () => {
    const repoRoot = await tempRepoRoot();
    const result = await runFirstRunDemo({
      repoRoot,
      demoId: "demo-fail",
      executeRunTask: async ({ worktreesDir, runsDir }) =>
        fakeRunTaskResult({
          pass: false,
          worktreePath: join(worktreesDir!, "open-source-first-run-demo"),
          runLogPath: join(runsDir!, "run-1.json"),
          dispatchError: "dispatch blocked: fixture failure",
        }),
    });

    expect(result.status).toBe("blocked");
    const output = formatFirstRunDemoResult(result).join("\n");
    expect(output).toContain("Samantha first-run demo: blocked");
    expect(output).toContain("stage: dispatch");
    expect(output).toContain("reason: dispatch blocked: fixture failure");
    expect(output).toContain("demo id: demo-fail");
    expect(output).toContain("run log: .samantha-demo/demo-fail/runs/run-1.json");
    expect(output).toContain("cleanup: rm -rf .samantha-demo/demo-fail");
  });

  test("gitignore covers generated demo artifacts", async () => {
    const ignore = await readFile(join(import.meta.dir, "..", ".gitignore"), "utf8");
    expect(ignore.split("\n")).toContain(".samantha-demo/");
  });
});
