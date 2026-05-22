import type { AgentProfile, TaskSpec, WorktreeAllocation } from "./contracts";
import type { PreparedCodexDispatch } from "./codex-dispatch";
import { gitHead } from "./git";
import { validateDispatch } from "./policy";
import { unresolvedDispatchPlaceholders } from "./task-placeholders";
import {
  finishOperationTiming,
  runCommand as runProcessCommand,
  startOperationTiming,
  type CommandRunResult,
  type OperationTiming,
} from "./command-runner";
import {
  workerRuntimeAdapterForKind,
  type WorkerRuntimeAdapter,
} from "./worker-runtime-adapter";
import type { WorkerRuntimeKind, WorkerRuntimeMetadata } from "./worker-runtime-metadata";
import {
  collectChangedFileSnapshots,
  evaluateWorkerResult,
  type WorkerResultEvaluation,
} from "./worker-result";
import { allocateWorktree } from "./worktree";

export { runCommand, type CommandRunResult } from "./command-runner";

export interface PrepareWorkerDispatchInput {
  task: TaskSpec;
  agent: AgentProfile;
  repoRoot: string;
  worktreesDir?: string;
  codexBin?: string;
  baseRef?: string;
  runtimeKind?: WorkerRuntimeKind;
  runtimeAdapter?: WorkerRuntimeAdapter;
}

export interface WorkerDispatchPreparation {
  taskId: string;
  agentId: string;
  worktreePath: string;
  allocation?: WorktreeAllocation;
  allocationTiming?: OperationTiming;
  codex: PreparedCodexDispatch;
}

export interface WorkerCommitResult {
  subject: string;
  files: string[];
  add: CommandRunResult;
  commit: CommandRunResult;
  commitHash: string;
}

export interface WorkerDispatchExecution {
  preparation: WorkerDispatchPreparation;
  setupResults: CommandRunResult[];
  dispatchError?: string;
  command?: CommandRunResult;
  runtime?: WorkerRuntimeMetadata;
  evaluation?: WorkerResultEvaluation;
  commit?: WorkerCommitResult;
  pass: boolean;
}

export async function prepareWorkerDispatch(
  input: PrepareWorkerDispatchInput,
): Promise<WorkerDispatchPreparation> {
  const plan = validateDispatch(input.task, input.agent);
  const unresolvedPlaceholders = unresolvedDispatchPlaceholders(input.task);
  if (unresolvedPlaceholders.length > 0) {
    plan.violations.push(
      `task contains unresolved dispatch placeholders: ${unresolvedPlaceholders.join(", ")}`,
    );
  }
  if (plan.violations.length > 0) {
    throw new Error(`dispatch blocked:\n${plan.violations.join("\n")}`);
  }

  let allocation: WorktreeAllocation | undefined;
  let allocationTiming: OperationTiming | undefined;
  if (input.agent.worktreePolicy === "per-task") {
    const timing = startOperationTiming();
    allocation = await allocateWorktree({
      repoRoot: input.repoRoot,
      taskId: input.task.id,
      worktreesDir: input.worktreesDir,
      baseRef: input.baseRef,
    });
    allocationTiming = finishOperationTiming(timing);
  }
  const worktreePath = allocation?.worktreePath ?? input.repoRoot;
  const runtimeAdapter =
    input.runtimeAdapter ?? workerRuntimeAdapterForKind(input.runtimeKind ?? "exec-json");

  return {
    taskId: input.task.id,
    agentId: input.agent.id,
    worktreePath,
    allocation,
    ...(allocationTiming ? { allocationTiming } : {}),
    codex: runtimeAdapter.prepare({
      task: input.task,
      agent: input.agent,
      worktreePath,
      codexBin: input.codexBin,
    }),
  };
}

export async function runSetupCommands(commands: string[], cwd: string): Promise<CommandRunResult[]> {
  const results: CommandRunResult[] = [];

  for (const command of commands) {
    const result = await runProcessCommand(["bash", "-lc", command], { cwd });
    results.push(result);
    if (result.exitCode !== 0) break;
  }

  return results;
}

function commitSubjectForTask(task: TaskSpec): string {
  return task.expectedCommitSubject ?? `samantha: ${task.title}`;
}

export async function commitWorkerChanges(input: {
  task: TaskSpec;
  cwd: string;
  files: string[];
}): Promise<WorkerCommitResult> {
  const files = [...input.files].sort();
  const subject = commitSubjectForTask(input.task);
  const add =
    files.length > 0
      ? await runProcessCommand(["git", "add", "--", ...files], { cwd: input.cwd })
      : {
          command: ["git", "add", "--"],
          exitCode: 1,
          stdout: "",
          stderr: "no changed files to commit",
        };
  const commit =
    add.exitCode === 0
      ? await runProcessCommand(["git", "commit", "-m", subject], { cwd: input.cwd })
      : {
          command: ["git", "commit", "-m", subject],
          exitCode: 1,
          stdout: "",
          stderr: "skipped because git add failed",
        };
  const commitHash = commit.exitCode === 0 ? await gitHead(input.cwd) : "";

  return {
    subject,
    files,
    add,
    commit,
    commitHash,
  };
}

export async function executeWorkerDispatch(
  input: PrepareWorkerDispatchInput,
): Promise<WorkerDispatchExecution> {
  const preparation = await prepareWorkerDispatch(input);
  const baseCommit = preparation.allocation?.baseCommit ?? (await gitHead(preparation.worktreePath));
  const baselineChangedFiles =
    input.task.resultMode === "report" || input.agent.writerClass === "non-writer"
      ? await collectChangedFileSnapshots({ baseCommit, cwd: preparation.worktreePath })
      : [];
  const setupResults = await runSetupCommands(input.task.setupCommands ?? [], preparation.worktreePath);

  if (setupResults.some((result) => result.exitCode !== 0)) {
    return {
      preparation,
      setupResults,
      pass: false,
    };
  }

  const runtimeAdapter =
    input.runtimeAdapter ?? workerRuntimeAdapterForKind(input.runtimeKind ?? "exec-json");
  const runtimeExecution = await runtimeAdapter.execute({
    dispatch: preparation.codex,
    agent: input.agent,
    worktreePath: preparation.worktreePath,
    codexBin: input.codexBin,
  });
  const command = runtimeExecution.command;
  const output = [command.stdout, command.stderr].filter(Boolean).join("\n");
  const evaluation = await evaluateWorkerResult({
    task: input.task,
    cwd: preparation.worktreePath,
    baseCommit,
    output,
    baselineChangedFiles,
  });
  const shouldCommit =
    evaluation.pass &&
    input.task.resultMode !== "report" &&
    input.agent.writerClass === "writer" &&
    preparation.allocation !== undefined &&
    evaluation.changedFiles.length > 0;
  const commit = shouldCommit
    ? await commitWorkerChanges({
        task: input.task,
        cwd: preparation.worktreePath,
        files: evaluation.changedFiles,
      })
    : undefined;
  const commitPassed = !commit || (commit.add.exitCode === 0 && commit.commit.exitCode === 0);

  return {
    preparation,
    setupResults,
    command,
    runtime: runtimeExecution.runtime,
    evaluation,
    commit,
    pass: command.exitCode === 0 && evaluation.pass && commitPassed,
  };
}
