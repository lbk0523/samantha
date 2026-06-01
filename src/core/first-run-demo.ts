import { access, cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { runTaskCommand, type RunTaskCommandInput, type RunTaskCommandResult } from "../commands/run-task";
import type { TaskSpec } from "./contracts";
import { git } from "./git";
import { runCommand, type CommandRunResult } from "./command-runner";
import type { WorkerRuntimeKind } from "./worker-runtime-metadata";

export type FirstRunDemoStage =
  | "preflight"
  | "fixture_setup"
  | "dispatch"
  | "worker"
  | "harness_result"
  | "verification"
  | "commit";

export type FirstRunDemoStatus = "pass" | "failed" | "blocked";

export interface FirstRunDemoPaths {
  demoId: string;
  repoRoot: string;
  packageAssetRoot: string;
  demoRoot: string;
  fixtureSource: string;
  agentProfile: string;
  fixtureRepo: string;
  worktreesDir: string;
  runsDir: string;
  taskPath: string;
  cleanupCommand: string;
}

export interface FirstRunDemoInput {
  repoRoot?: string;
  packageAssetRoot?: string;
  demoRoot?: string;
  demoId?: string;
  runtimeKind?: WorkerRuntimeKind;
  executeRunTask?: (input: RunTaskCommandInput) => Promise<RunTaskCommandResult>;
  runPreflightCommand?: (command: string[], cwd?: string) => Promise<CommandRunResult>;
}

export interface FirstRunDemoResult {
  status: FirstRunDemoStatus;
  stage?: FirstRunDemoStage;
  reason?: string;
  nextAction?: string;
  paths?: FirstRunDemoPaths;
  workerWorktree?: string;
  runLog?: string;
  harnessStatus?: string;
  verificationStatus?: string;
  candidateCommit?: string;
}

function timestampDemoId(): string {
  return `demo-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function pathInside(parent: string, child: string): boolean {
  const normalized = relative(parent, child);
  return normalized === "" || (!normalized.startsWith("..") && !isAbsolute(normalized));
}

function cleanupCommandFor(input: { repoRoot: string; demoRoot: string; explicitDemoRoot: boolean }): string {
  if (!input.explicitDemoRoot && pathInside(input.repoRoot, input.demoRoot)) {
    return `rm -rf ${relative(input.repoRoot, input.demoRoot).replaceAll("\\", "/")}`;
  }
  return `rm -rf ${input.demoRoot}`;
}

export function buildFirstRunDemoPaths(input: {
  repoRoot?: string;
  packageAssetRoot?: string;
  demoRoot?: string;
  demoId?: string;
} = {}): FirstRunDemoPaths {
  const repoRoot = resolve(input.repoRoot ?? ".");
  const packageAssetRoot = resolve(input.packageAssetRoot ?? repoRoot);
  const demoId = input.demoId ?? timestampDemoId();
  const demoRoot = resolve(input.demoRoot ?? join(repoRoot, ".samantha-demo", demoId));
  const paths = {
    demoId,
    repoRoot,
    packageAssetRoot,
    demoRoot,
    fixtureSource: join(packageAssetRoot, "examples", "first-run-demo", "fixture-repo"),
    agentProfile: join(packageAssetRoot, "references", "agent-profiles", "codex-worker.json"),
    fixtureRepo: join(demoRoot, "fixture-repo"),
    worktreesDir: join(demoRoot, "worktrees"),
    runsDir: join(demoRoot, "runs"),
    taskPath: join(demoRoot, "task.json"),
    cleanupCommand: cleanupCommandFor({
      repoRoot,
      demoRoot,
      explicitDemoRoot: input.demoRoot !== undefined,
    }),
  };

  for (const path of [paths.fixtureRepo, paths.worktreesDir, paths.runsDir, paths.taskPath]) {
    if (!pathInside(demoRoot, path)) {
      throw new Error(`generated demo path escapes demo root: ${path}`);
    }
  }
  return paths;
}

function firstRunTaskSpec(): TaskSpec {
  return {
    id: "open-source-first-run-demo",
    title: "Create the first-run demo output file",
    taskFamily: "docs-only",
    workMode: "minimal-change",
    riskClass: "routine",
    targetAgent: "codex-worker",
    targetFiles: ["demo-output.txt"],
    forbiddenChanges: ["README.md", "demo-input.txt", ".git/**"],
    verifyCommands: [
      "test -f demo-output.txt",
      "grep -Fx \"Samantha first-run demo passed\" demo-output.txt",
    ],
    instructions:
      "Create demo-output.txt containing the exact line: Samantha first-run demo passed. Do not edit any other file. End with exactly one HARNESS_RESULT line.",
    expectedCommitSubject: "docs: add first-run demo output",
    status: "pending",
  };
}

async function assertPathExists(path: string, message: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(message);
  }
}

async function defaultPreflightCommand(command: string[], cwd?: string): Promise<CommandRunResult> {
  return runCommand(command, { cwd, timeoutMs: 10_000 });
}

async function runPreflight(input: {
  paths: FirstRunDemoPaths;
  runPreflightCommand: (command: string[], cwd?: string) => Promise<CommandRunResult>;
  runtimeKind: WorkerRuntimeKind;
}): Promise<void> {
  if (input.runtimeKind !== "codex-sdk" && input.runtimeKind !== "exec-json") {
    throw new Error("runtime must be exec-json or codex-sdk");
  }
  await assertPathExists(input.paths.fixtureSource, "first-run demo fixture is missing");
  await assertPathExists(input.paths.agentProfile, "first-run demo agent profile is missing");
  for (const command of [["bun", "--version"], ["git", "--version"]]) {
    const result = await input.runPreflightCommand(command, input.paths.repoRoot);
    if (result.exitCode !== 0) {
      throw new Error(`${command[0]} is unavailable: ${result.stderr.trim() || result.stdout.trim()}`);
    }
  }
}

async function setupFixture(paths: FirstRunDemoPaths): Promise<void> {
  await mkdir(dirname(paths.demoRoot), { recursive: true });
  await mkdir(paths.demoRoot, { recursive: false });
  await cp(paths.fixtureSource, paths.fixtureRepo, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await mkdir(paths.worktreesDir, { recursive: true });
  await mkdir(paths.runsDir, { recursive: true });
  await git(["init"], paths.fixtureRepo);
  await git(["config", "user.email", "first-run-demo@samantha.local"], paths.fixtureRepo);
  await git(["config", "user.name", "Samantha First Run Demo"], paths.fixtureRepo);
  await git(["add", "README.md", "demo-input.txt"], paths.fixtureRepo);
  await git(["commit", "-m", "chore: baseline first-run demo fixture"], paths.fixtureRepo);
}

async function writeTask(paths: FirstRunDemoPaths): Promise<void> {
  await mkdir(dirname(paths.taskPath), { recursive: true });
  await writeFile(paths.taskPath, `${JSON.stringify(firstRunTaskSpec(), null, 2)}\n`, "utf8");
}

function failure(input: {
  status?: FirstRunDemoStatus;
  stage: FirstRunDemoStage;
  reason: string;
  nextAction: string;
  paths?: FirstRunDemoPaths;
  runLog?: string;
  workerWorktree?: string;
}): FirstRunDemoResult {
  return {
    status: input.status ?? "failed",
    stage: input.stage,
    reason: input.reason,
    nextAction: input.nextAction,
    ...(input.paths ? { paths: input.paths } : {}),
    ...(input.runLog ? { runLog: input.runLog } : {}),
    ...(input.workerWorktree ? { workerWorktree: input.workerWorktree } : {}),
  };
}

function verificationStatus(result: RunTaskCommandResult): "pass" | "failed" {
  const verifyResults = result.execution.evaluation?.verifyResults ?? [];
  return verifyResults.length > 0 && verifyResults.every((verify) => verify.exitCode === 0)
    ? "pass"
    : "failed";
}

function classifyWorkerFailure(paths: FirstRunDemoPaths, result: RunTaskCommandResult): FirstRunDemoResult {
  const execution = result.execution;
  const runLog = result.runLog.path;
  const workerWorktree = execution.preparation.worktreePath;
  if (execution.dispatchError) {
    return failure({
      status: "blocked",
      stage: "dispatch",
      reason: execution.dispatchError,
      nextAction: "Inspect the run log and fix the blocked dispatch condition.",
      paths,
      runLog,
      workerWorktree,
    });
  }
  if (!execution.command || execution.command.exitCode !== 0) {
    return failure({
      stage: "worker",
      reason: execution.command
        ? `worker command failed (${execution.command.exitCode})`
        : "worker command did not run",
      nextAction: "Inspect the worker output in the run log, then rerun the demo.",
      paths,
      runLog,
      workerWorktree,
    });
  }
  if (execution.evaluation?.parseError || execution.evaluation?.harness?.status !== "pass") {
    return failure({
      stage: "harness_result",
      reason: execution.evaluation?.parseError ?? `HARNESS_RESULT status was ${execution.evaluation?.harness?.status ?? "missing"}`,
      nextAction: "Report the malformed or rejected worker result with the run log.",
      paths,
      runLog,
      workerWorktree,
    });
  }
  const scopeViolation = execution.evaluation.scopeViolations[0];
  if (scopeViolation) {
    return failure({
      stage: "verification",
      reason: `scope violation: ${scopeViolation.file} (${scopeViolation.reason})`,
      nextAction: "Inspect the run log; Samantha rejected out-of-scope worker changes.",
      paths,
      runLog,
      workerWorktree,
    });
  }
  const failedVerify = execution.evaluation.verifyResults.find((verify) => verify.exitCode !== 0);
  if (failedVerify) {
    return failure({
      stage: "verification",
      reason: `verify command failed (${failedVerify.exitCode}): ${failedVerify.command}`,
      nextAction: "Inspect the fixture worktree output and rerun the demo after fixing the worker result.",
      paths,
      runLog,
      workerWorktree,
    });
  }
  return failure({
    stage: "commit",
    reason: "worker candidate commit was not created",
    nextAction: "Inspect the run log commit stage before trusting the demo result.",
    paths,
    runLog,
    workerWorktree,
  });
}

export async function runFirstRunDemo(input: FirstRunDemoInput = {}): Promise<FirstRunDemoResult> {
  let paths: FirstRunDemoPaths | undefined;
  const runtimeKind = input.runtimeKind ?? "codex-sdk";
  try {
    paths = buildFirstRunDemoPaths({
      repoRoot: input.repoRoot,
      packageAssetRoot: input.packageAssetRoot,
      demoRoot: input.demoRoot,
      demoId: input.demoId,
    });
    await runPreflight({
      paths,
      runPreflightCommand: input.runPreflightCommand ?? defaultPreflightCommand,
      runtimeKind,
    });
  } catch (err) {
    return failure({
      status: "blocked",
      stage: "preflight",
      reason: err instanceof Error ? err.message : String(err),
      nextAction: "Install the missing local prerequisite or rerun from the Samantha repository root.",
      ...(paths ? { paths } : {}),
    });
  }

  try {
    await setupFixture(paths);
    await writeTask(paths);
  } catch (err) {
    return failure({
      status: "blocked",
      stage: "fixture_setup",
      reason: err instanceof Error ? err.message : String(err),
      nextAction: "Remove the generated demo directory if it already exists, then rerun demo:first-run.",
      paths,
    });
  }

  const executeRunTask = input.executeRunTask ?? runTaskCommand;
  let workerResult: RunTaskCommandResult;
  try {
    workerResult = await executeRunTask({
      taskPath: paths.taskPath,
      repoRoot: paths.fixtureRepo,
      agentPath: paths.agentProfile,
      worktreesDir: paths.worktreesDir,
      runsDir: paths.runsDir,
      runtimeKind,
    });
  } catch (err) {
    return failure({
      stage: "dispatch",
      reason: err instanceof Error ? err.message : String(err),
      nextAction: "Inspect generated artifacts and rerun with the same runtime after fixing dispatch setup.",
      paths,
    });
  }

  if (!workerResult.execution.pass) {
    return classifyWorkerFailure(paths, workerResult);
  }

  return {
    status: "pass",
    paths,
    workerWorktree: workerResult.execution.preparation.worktreePath,
    runLog: workerResult.runLog.path,
    harnessStatus: workerResult.execution.evaluation?.harness?.status ?? "missing",
    verificationStatus: verificationStatus(workerResult),
    candidateCommit: workerResult.execution.commit?.commitHash ?? "",
  };
}

function displayPath(paths: FirstRunDemoPaths, path: string | undefined): string {
  if (!path) return "";
  if (pathInside(paths.repoRoot, path)) return relative(paths.repoRoot, path).replaceAll("\\", "/");
  return path;
}

export function formatFirstRunDemoResult(result: FirstRunDemoResult): string[] {
  const paths = result.paths;
  if (result.status === "pass" && paths) {
    return [
      "Samantha first-run demo: pass",
      `demo id: ${paths.demoId}`,
      `fixture repo: ${displayPath(paths, paths.fixtureRepo)}`,
      `worker worktree: ${displayPath(paths, result.workerWorktree)}`,
      `run log: ${displayPath(paths, result.runLog)}`,
      `HARNESS_RESULT: ${result.harnessStatus ?? "missing"}`,
      `verification: ${result.verificationStatus ?? "failed"}`,
      `candidate commit: ${result.candidateCommit ?? ""}`,
      "merge: not performed (disposable worker worktree only)",
      `cleanup: ${paths.cleanupCommand}`,
    ];
  }

  return [
    `Samantha first-run demo: ${result.status}`,
    `stage: ${result.stage ?? "preflight"}`,
    `reason: ${result.reason ?? "unknown failure"}`,
    `next action: ${result.nextAction ?? "Inspect generated artifacts and rerun."}`,
    `demo id: ${paths?.demoId ?? ""}`,
    `run log: ${paths ? displayPath(paths, result.runLog) : ""}`,
    `cleanup: ${paths ? paths.cleanupCommand : "none required"}`,
  ];
}
