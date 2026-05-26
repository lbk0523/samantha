import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentProfile, TaskSpec, WorktreeAllocation } from "./contracts";
import type { PreparedCodexDispatch } from "./codex-dispatch";
import { gitHead } from "./git";
import {
  HOOK_EVENT_VERSION,
  HOOK_POLICY_PATH,
  loadHookPolicy,
  runTrustGateHooks,
  type LoadedHookPolicy,
  type TrustGateHookRunResult,
} from "./hooks";
import { validateDispatch } from "./policy";
import type {
  WorkerRunHookDefinitionDigest,
  WorkerRunHookEvidence,
  WorkerRunHookFileDigest,
} from "./run-log";
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
  hookRunId?: string;
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
  hookEvidence?: WorkerRunHookEvidence;
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

function workerPreDispatchDispatchError(summary: string): string {
  return `worker.pre_dispatch hook gate blocked dispatch: ${summary}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function buildWorkerPreDispatchContext(input: {
  task: TaskSpec;
  agent: AgentProfile;
  preparation: WorkerDispatchPreparation;
  runtimeKind: WorkerRuntimeKind;
}): Record<string, unknown> {
  return {
    task: {
      id: input.task.id,
      title: input.task.title,
      taskFamily: input.task.taskFamily,
      workMode: input.task.workMode,
      riskClass: input.task.riskClass,
      targetAgent: input.task.targetAgent,
      resultMode: input.task.resultMode ?? "write",
      status: input.task.status,
      targetFiles: input.task.targetFiles,
      forbiddenChanges: input.task.forbiddenChanges,
      verifyCommands: input.task.verifyCommands,
      setupCommands: input.task.setupCommands ?? [],
      ...(input.task.allowNoop === undefined
        ? {}
        : { allowNoop: input.task.allowNoop }),
      ...(input.task.noopRationale === undefined
        ? {}
        : { noopRationale: input.task.noopRationale }),
      expectedCommitSubject: input.task.expectedCommitSubject ?? null,
    },
    agent: {
      id: input.agent.id,
      role: input.agent.role,
      writerClass: input.agent.writerClass,
      worktreePolicy: input.agent.worktreePolicy,
      mergePolicy: input.agent.mergePolicy,
    },
    dispatch: {
      worktreePath: input.preparation.worktreePath,
      allocationExists: input.preparation.allocation !== undefined,
      ...(input.preparation.allocation
        ? {
            branch: input.preparation.allocation.branch,
            baseCommit: input.preparation.allocation.baseCommit,
          }
        : {}),
      runtimeKind: input.runtimeKind,
    },
  };
}

async function sha256FileDigest(path: string): Promise<string> {
  return `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`;
}

async function hookFileDigest(path: string): Promise<WorkerRunHookFileDigest> {
  try {
    return {
      path,
      digest: await sha256FileDigest(path),
    };
  } catch (err) {
    return {
      path,
      digest: `unavailable:${errorMessage(err)}`,
    };
  }
}

async function hookDefinitionDigests(
  loadedPolicy: LoadedHookPolicy,
): Promise<WorkerRunHookDefinitionDigest[]> {
  return Promise.all(
    loadedPolicy.hooks.map(async (hook) => ({
      hookId: hook.id,
      ...(await hookFileDigest(join(loadedPolicy.definitionDir, `${hook.id}.json`))),
    })),
  );
}

function workerPreDispatchEventEvidence(
  result: TrustGateHookRunResult,
): WorkerRunHookEvidence["events"][number] {
  const contextKeys = Array.from(new Set(result.evidence.flatMap((evidence) => evidence.contextKeys))).sort();
  const contextBytes = result.evidence.reduce(
    (max, evidence) => Math.max(max, evidence.contextBytes),
    0,
  );

  return {
    event: "worker.pre_dispatch",
    eventVersion: HOOK_EVENT_VERSION,
    contextKeys,
    contextBytes,
    trustGate: result.final,
    invocations: result.evidence,
  };
}

async function workerPreDispatchHookEvidence(input: {
  loadedPolicy: LoadedHookPolicy;
  result: TrustGateHookRunResult;
}): Promise<WorkerRunHookEvidence> {
  return {
    policy: await hookFileDigest(input.loadedPolicy.policyPath),
    definitions: await hookDefinitionDigests(input.loadedPolicy),
    events: [workerPreDispatchEventEvidence(input.result)],
  };
}

async function invalidWorkerPreDispatchHookEvidence(input: {
  worktreePath: string;
  summary: string;
}): Promise<WorkerRunHookEvidence> {
  return {
    policy: await hookFileDigest(join(resolve(input.worktreePath), HOOK_POLICY_PATH)),
    definitions: [],
    events: [
      {
        event: "worker.pre_dispatch",
        eventVersion: HOOK_EVENT_VERSION,
        contextKeys: [],
        contextBytes: 0,
        trustGate: {
          decision: "block",
          summary: input.summary,
          blockingHookId: null,
        },
        invocations: [],
      },
    ],
  };
}

async function runWorkerPreDispatchHookGate(input: {
  task: TaskSpec;
  agent: AgentProfile;
  preparation: WorkerDispatchPreparation;
  runtimeKind: WorkerRuntimeKind;
  runId: string;
}): Promise<{ dispatchError?: string; hookEvidence?: WorkerRunHookEvidence }> {
  let loadedPolicy: LoadedHookPolicy;
  try {
    loadedPolicy = await loadHookPolicy({ repoRoot: input.preparation.worktreePath });
  } catch (err) {
    const summary = `worker.pre_dispatch hook policy failed closed: ${errorMessage(err)}`;
    return {
      dispatchError: workerPreDispatchDispatchError(summary),
      hookEvidence: await invalidWorkerPreDispatchHookEvidence({
        worktreePath: input.preparation.worktreePath,
        summary,
      }),
    };
  }

  if (loadedPolicy.status === "disabled" && loadedPolicy.reason === "policy_missing") {
    return {};
  }

  const result = await runTrustGateHooks({
    repoRoot: input.preparation.worktreePath,
    loadedPolicy,
    event: "worker.pre_dispatch",
    runId: input.runId,
    context: buildWorkerPreDispatchContext(input),
    eventTimeoutMs: loadedPolicy.eventDefaults["worker.pre_dispatch"].timeoutMs,
  });
  const hookEvidence = await workerPreDispatchHookEvidence({ loadedPolicy, result });

  return {
    ...(result.final.decision === "block"
      ? { dispatchError: workerPreDispatchDispatchError(result.final.summary) }
      : {}),
    hookEvidence,
  };
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
  const runtimeKind = input.runtimeKind ?? "exec-json";
  const hookGate = await runWorkerPreDispatchHookGate({
    task: input.task,
    agent: input.agent,
    preparation,
    runtimeKind,
    runId: input.hookRunId ?? `worker-pre-dispatch:${input.task.id}`,
  });

  if (hookGate.dispatchError) {
    return {
      preparation,
      setupResults: [],
      dispatchError: hookGate.dispatchError,
      ...(hookGate.hookEvidence ? { hookEvidence: hookGate.hookEvidence } : {}),
      pass: false,
    };
  }

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
      ...(hookGate.hookEvidence ? { hookEvidence: hookGate.hookEvidence } : {}),
      pass: false,
    };
  }

  const runtimeAdapter =
    input.runtimeAdapter ?? workerRuntimeAdapterForKind(runtimeKind);
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
    ...(hookGate.hookEvidence ? { hookEvidence: hookGate.hookEvidence } : {}),
    pass: command.exitCode === 0 && evaluation.pass && commitPassed,
  };
}
