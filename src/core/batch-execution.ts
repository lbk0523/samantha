import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  preflightBatchSpec,
  type BatchPreflightResult,
  type BatchSpec,
} from "./batch-spec";
import {
  recordStaleBaseReplanEvidence,
  type BatchStaleBaseReplanEvidence,
} from "./batch-replan";
import type { AgentProfile, TaskSpec } from "./contracts";
import { git, gitHead, gitRaw } from "./git";
import { RunIndex, summarizeWorkerRun, type RunSummary } from "./ledger";
import { recordCleanupFinished, recordLifecycleMarked, recordMergeChecked } from "./post-run-trajectory";
import {
  lifecycleBaseFromRunLog,
  RunLifecycleStore,
  type RunLifecycleRecord,
} from "./run-lifecycle-store";
import {
  appendWorkerRunTrajectoryEntry,
  writeWorkerRunLog,
  type WorkerRunLogWrite,
} from "./run-log";
import { cleanupCompletedWorktree, type WorktreeCleanupResult } from "./worktree-cleanup";
import { readWorkerRunLog, type MergeGateResult } from "./merge-gate";
import {
  executeWorkerDispatch,
  runCommand,
  type CommandRunResult,
  type WorkerDispatchExecution,
} from "./worker-dispatch";

export interface ExecuteBatchInput {
  spec: BatchSpec;
  agentPath?: string;
  worktreesDir?: string;
  runsDir?: string;
  stateDir?: string;
  codexBin?: string;
  targetBranch?: string;
}

export type BatchTaskDecision =
  | "planned"
  | "dispatched"
  | "passed"
  | "failed"
  | "blocked"
  | "accepted"
  | "rejected"
  | "cleaned";

export interface BatchWorkerEvidence {
  taskId: string;
  dispatchGroup: string;
  runLog: WorkerRunLogWrite;
  runSummary: RunSummary;
  execution: WorkerDispatchExecution;
  candidateCommit: string;
}

export interface BatchIntegrationEvidence {
  order: number;
  taskId: string;
  status: "accepted" | "failed" | "blocked" | "skipped";
  candidateCommit: string;
  expectedIntegrationHead: string;
  merge?: CommandRunResult;
  focusedVerification: CommandRunResult[];
  lifecycle?: {
    merged?: RunLifecycleRecord;
    cleaned?: RunLifecycleRecord;
  };
  cleanup?: WorktreeCleanupResult;
  violations: string[];
}

export interface BatchExecutionResult {
  batchId: string;
  status:
    | "completed"
    | "partially_failed"
    | "failed"
    | "preflight_failed"
    | "stale_base";
  pass: boolean;
  preflight: BatchPreflightResult;
  dispatchGroups: Array<{ dispatchGroup: string; taskIds: string[]; status: "dispatched" | "blocked" }>;
  workers: BatchWorkerEvidence[];
  integration: BatchIntegrationEvidence[];
  finalVerification: CommandRunResult[];
  staleBaseReplan?: BatchStaleBaseReplanEvidence;
  taskDecisions: Record<string, BatchTaskDecision>;
  violations: string[];
}

const AUTHORITY_BOUNDARY_SERIAL_RULE_IDS = new Set([
  "contracts",
  "policy",
  "task-templates",
  "agent-profiles",
  "doctrine-agents",
  "doctrine-north-star",
  "doctrine-architecture",
  "doctrine-roadmap",
  "doctrine-work-rules",
]);

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function defaultAgentPath(repoRoot: string, task: TaskSpec): string {
  return join(repoRoot, "references", "agent-profiles", `${task.targetAgent}.json`);
}

function lifecyclePath(input: { runLogPath: string; stateDir?: string }): string {
  return join(resolve(input.stateDir ?? dirname(resolve(input.runLogPath))), "run-lifecycle.jsonl");
}

async function markRunLifecycle(input: {
  runLogPath: string;
  repoRoot: string;
  stateDir?: string;
}): Promise<RunLifecycleRecord> {
  const log = await readWorkerRunLog(input.runLogPath);
  const at = new Date().toISOString();
  const record = await new RunLifecycleStore(lifecyclePath(input)).mark(
    lifecycleBaseFromRunLog({
      log,
      runLogPath: input.runLogPath,
      repoRoot: input.repoRoot,
      updatedAt: at,
    }),
    "merged",
    at,
  );
  await recordLifecycleMarked(input.runLogPath, "merged", record);
  return record;
}

async function markRunCleaned(input: {
  runLogPath: string;
  repoRoot: string;
  stateDir?: string;
}): Promise<RunLifecycleRecord> {
  const log = await readWorkerRunLog(input.runLogPath);
  const at = new Date().toISOString();
  const record = await new RunLifecycleStore(lifecyclePath(input)).mark(
    lifecycleBaseFromRunLog({
      log,
      runLogPath: input.runLogPath,
      repoRoot: input.repoRoot,
      updatedAt: at,
    }),
    "cleaned",
    at,
  );
  await recordLifecycleMarked(input.runLogPath, "cleaned", record);
  return record;
}

function dependenciesByAfter(spec: BatchSpec): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const task of spec.tasks) {
    map.set(task.taskId, []);
  }
  for (const dependency of spec.dependencies) {
    map.set(dependency.after, [...(map.get(dependency.after) ?? []), dependency.before]);
  }
  return map;
}

function dependentsByBefore(spec: BatchSpec): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const task of spec.tasks) {
    map.set(task.taskId, []);
  }
  for (const dependency of spec.dependencies) {
    map.set(dependency.before, [...(map.get(dependency.before) ?? []), dependency.after]);
  }
  return map;
}

function dispatchGroups(spec: BatchSpec): Array<{ dispatchGroup: string; taskIds: string[] }> {
  const groups = new Map<string, string[]>();
  for (const task of spec.tasks) {
    groups.set(task.dispatchGroup, [...(groups.get(task.dispatchGroup) ?? []), task.taskId]);
  }
  return [...groups.entries()].map(([dispatchGroup, taskIds]) => ({ dispatchGroup, taskIds }));
}

function taskBlockedByAuthorityBoundary(input: {
  preflight: BatchPreflightResult;
  taskId: string;
}): string[] {
  const task = input.preflight.tasks.find((item) => item.taskId === input.taskId);
  const blockedRules = (task?.serialOnlyMatches ?? []).filter((rule) =>
    AUTHORITY_BOUNDARY_SERIAL_RULE_IDS.has(rule.id),
  );
  return blockedRules.map(
    (rule) =>
      `authority-boundary serial_only task requires a separate doctrine/policy task: ${input.taskId} matches ${rule.id}`,
  );
}

function allDependenciesAccepted(
  taskId: string,
  dependencies: Map<string, string[]>,
  decisions: Map<string, BatchTaskDecision>,
): boolean {
  return (dependencies.get(taskId) ?? []).every((dependency) => decisions.get(dependency) === "accepted");
}

function hasFailedDependency(
  taskId: string,
  dependencies: Map<string, string[]>,
  decisions: Map<string, BatchTaskDecision>,
): boolean {
  return (dependencies.get(taskId) ?? []).some((dependency) => {
    const decision = decisions.get(dependency);
    return decision === "failed" || decision === "blocked" || decision === "rejected";
  });
}

async function runVerificationCommands(commands: string[], cwd: string): Promise<CommandRunResult[]> {
  const results: CommandRunResult[] = [];
  for (const command of commands) {
    const result = await runCommand(["bash", "-lc", command], { cwd });
    results.push(result);
    if (result.exitCode !== 0) break;
  }
  return results;
}

function commandResultsPassed(results: CommandRunResult[]): boolean {
  return results.every((result) => result.exitCode === 0);
}

function hasStaleBaseViolation(violations: string[]): boolean {
  return violations.some((violation) => violation.startsWith("repoRoot HEAD must match baseCommit before dispatch:"));
}

function mergeGateResult(input: {
  targetBranch: string;
  commit: string;
  command: string[];
}): MergeGateResult {
  return {
    mayMerge: true,
    alreadyMerged: false,
    status: "mergeable",
    targetBranch: input.targetBranch,
    commit: input.commit,
    command: input.command,
    violations: [],
  };
}

async function runBatchWorker(input: {
  taskPath: string;
  repoRoot: string;
  agentPath?: string;
  worktreesDir?: string;
  runsDir: string;
  codexBin?: string;
  baseCommit: string;
}): Promise<BatchWorkerEvidence> {
  const task = await readJson<TaskSpec>(input.taskPath);
  const agent = await readJson<AgentProfile>(
    input.agentPath ? resolve(input.agentPath) : defaultAgentPath(input.repoRoot, task),
  );
  const startedAt = new Date().toISOString();
  const execution = await executeWorkerDispatch({
    task,
    agent,
    repoRoot: input.repoRoot,
    worktreesDir: input.worktreesDir,
    codexBin: input.codexBin,
    baseRef: input.baseCommit,
  });
  const finishedAt = new Date().toISOString();
  const logInput = {
    task,
    agent,
    repoRoot: input.repoRoot,
    worktreesDir: input.worktreesDir,
    startedAt,
    finishedAt,
    execution,
  };
  const runLog = await writeWorkerRunLog(input.runsDir, logInput);
  const runSummary = summarizeWorkerRun({
    ...logInput,
    runId: runLog.runId,
    logPath: runLog.path,
  });
  await new RunIndex(join(input.runsDir, "index.jsonl")).append(runSummary);

  return {
    taskId: task.id,
    dispatchGroup: execution.preparation.taskId,
    runLog,
    runSummary,
    execution,
    candidateCommit: execution.commit?.commitHash ?? "",
  };
}

function resultStatus(input: {
  staleBase: boolean;
  preflightFailed: boolean;
  finalVerification: CommandRunResult[];
  decisions: Map<string, BatchTaskDecision>;
  violations: string[];
}): BatchExecutionResult["status"] {
  if (input.preflightFailed) return "preflight_failed";
  if (input.staleBase) return "stale_base";
  const failed = [...input.decisions.values()].some((decision) =>
    ["failed", "blocked", "rejected"].includes(decision),
  );
  if (failed) return "partially_failed";
  if (input.violations.length > 0 || !commandResultsPassed(input.finalVerification)) return "failed";
  return "completed";
}

async function ensureTargetBranch(input: {
  repoRoot: string;
  targetBranch: string;
  violations: string[];
}): Promise<void> {
  const branch = await git(["branch", "--show-current"], input.repoRoot);
  if (branch !== input.targetBranch) {
    input.violations.push(`target repo is on ${branch || "(detached)"}, expected ${input.targetBranch}`);
  }
}

async function ensureCleanTarget(input: { repoRoot: string; violations: string[] }): Promise<void> {
  const status = await gitRaw(["status", "--porcelain"], input.repoRoot);
  if (status.trim().length > 0) {
    input.violations.push("target repo has uncommitted changes");
  }
}

export async function executeBatch(input: ExecuteBatchInput): Promise<BatchExecutionResult> {
  const spec = input.spec;
  const repoRoot = resolve(spec.repoRoot);
  const targetBranch = input.targetBranch ?? "main";
  const runsDir = resolve(input.runsDir ?? join(repoRoot, "runs"));
  const stateDir = resolve(input.stateDir ?? runsDir);
  const preflight = await preflightBatchSpec(spec);
  const decisions = new Map(spec.tasks.map((task) => [task.taskId, "planned" as BatchTaskDecision]));
  const violations: string[] = [];
  const workers: BatchWorkerEvidence[] = [];
  const workersByTaskId = new Map<string, BatchWorkerEvidence>();
  const integration: BatchIntegrationEvidence[] = [];
  const integrationByTaskId = new Map<string, BatchIntegrationEvidence>();
  const dispatchEvidence: BatchExecutionResult["dispatchGroups"] = [];
  const dependencies = dependenciesByAfter(spec);
  const dependents = dependentsByBefore(spec);
  const groups = dispatchGroups(spec);
  let staleBase = false;
  let staleBaseReplan: BatchStaleBaseReplanEvidence | undefined;
  let expectedIntegrationHead = spec.baseCommit;

  await mkdir(runsDir, { recursive: true });

  if (!preflight.mayDispatch) {
    if (hasStaleBaseViolation(preflight.violations)) {
      staleBaseReplan = await recordStaleBaseReplanEvidence({
        stateDir,
        spec,
        targetBranch,
        trigger: "preflight",
        observedHead: await gitHead(repoRoot),
        violations: preflight.violations,
      });
    }
    return {
      batchId: spec.batchId,
      status: "preflight_failed",
      pass: false,
      preflight,
      dispatchGroups: [],
      workers: [],
      integration: [],
      finalVerification: [],
      ...(staleBaseReplan ? { staleBaseReplan } : {}),
      taskDecisions: Object.fromEntries(decisions),
      violations: preflight.violations,
    };
  }

  await ensureTargetBranch({ repoRoot, targetBranch, violations });
  await ensureCleanTarget({ repoRoot, violations });
  if (violations.length > 0) {
    return {
      batchId: spec.batchId,
      status: "failed",
      pass: false,
      preflight,
      dispatchGroups: [],
      workers: [],
      integration: [],
      finalVerification: [],
      taskDecisions: Object.fromEntries(decisions),
      violations,
    };
  }

  async function integrateReadyCandidates(): Promise<boolean> {
    let progressed = false;
    for (const item of [...spec.integrationQueue].sort((left, right) => left.order - right.order)) {
      if (integrationByTaskId.has(item.taskId)) continue;

      const decision = decisions.get(item.taskId);
      const failedRequirement = item.requiresAccepted.find(
        (required) => decisions.get(required) !== "accepted",
      );
      if (failedRequirement) {
        if (hasFailedDependency(item.taskId, dependencies, decisions)) {
          decisions.set(item.taskId, "blocked");
          const evidence: BatchIntegrationEvidence = {
            order: item.order,
            taskId: item.taskId,
            status: "blocked",
            candidateCommit: "",
            expectedIntegrationHead,
            focusedVerification: [],
            violations: [`required task was not accepted: ${failedRequirement}`],
          };
          integrationByTaskId.set(item.taskId, evidence);
          integration.push(evidence);
          progressed = true;
        }
        continue;
      }
      if (decision !== "passed") {
        if (decision === "failed" || decision === "blocked" || decision === "rejected") {
          const evidence: BatchIntegrationEvidence = {
            order: item.order,
            taskId: item.taskId,
            status: "skipped",
            candidateCommit: "",
            expectedIntegrationHead,
            focusedVerification: [],
            violations: [`task is ${decision}`],
          };
          integrationByTaskId.set(item.taskId, evidence);
          integration.push(evidence);
          progressed = true;
        }
        continue;
      }

      const worker = workersByTaskId.get(item.taskId);
      const candidateCommit = worker?.candidateCommit ?? "";
      const itemViolations: string[] = [];
      if (!worker) itemViolations.push("worker run evidence is missing");
      if (!candidateCommit) itemViolations.push("worker run did not produce a candidate commit");
      if (item.expectedCandidateCommit && item.expectedCandidateCommit !== candidateCommit) {
        itemViolations.push(
          `integrationQueue expectedCandidateCommit does not match run log: ${item.expectedCandidateCommit} != ${candidateCommit}`,
        );
      }

      const head = await gitHead(repoRoot);
      if (head !== expectedIntegrationHead) {
        staleBase = true;
        itemViolations.push(
          `target repo HEAD changed outside batch integration: HEAD ${head} != expected ${expectedIntegrationHead}`,
        );
        staleBaseReplan = await recordStaleBaseReplanEvidence({
          stateDir,
          spec,
          targetBranch,
          trigger: "integration",
          observedHead: head,
          expectedIntegrationHead,
          violations: itemViolations,
        });
      }

      if (itemViolations.length > 0) {
        decisions.set(item.taskId, staleBase ? "blocked" : "failed");
        const evidence: BatchIntegrationEvidence = {
          order: item.order,
          taskId: item.taskId,
          status: staleBase ? "blocked" : "failed",
          candidateCommit,
          expectedIntegrationHead,
          focusedVerification: [],
          violations: itemViolations,
        };
        integrationByTaskId.set(item.taskId, evidence);
        integration.push(evidence);
        violations.push(...itemViolations);
        progressed = true;
        if (staleBase) return progressed;
        continue;
      }

      const command = ["git", "merge", "--no-ff", "--no-edit", candidateCommit];
      if (worker) {
        await recordMergeChecked(
          worker.runLog.path,
          mergeGateResult({ targetBranch, commit: candidateCommit, command }),
        );
      }
      const merge = await runCommand(command, { cwd: repoRoot });
      if (merge.exitCode !== 0) {
        decisions.set(item.taskId, "failed");
        const evidence: BatchIntegrationEvidence = {
          order: item.order,
          taskId: item.taskId,
          status: "failed",
          candidateCommit,
          expectedIntegrationHead,
          merge,
          focusedVerification: [],
          violations: [`batch merge failed (${merge.exitCode})`],
        };
        integrationByTaskId.set(item.taskId, evidence);
        integration.push(evidence);
        progressed = true;
        continue;
      }

      if (worker) {
        await appendWorkerRunTrajectoryEntry(worker.runLog.path, {
          event: "verification_started",
          status: "completed",
          note: "batch focused verification started after integration",
          details: { commandCount: item.focusedVerifyCommands.length },
        });
      }
      const focusedVerification = await runVerificationCommands(item.focusedVerifyCommands, repoRoot);
      if (worker) {
        await appendWorkerRunTrajectoryEntry(worker.runLog.path, {
          event: "verification_finished",
          status: commandResultsPassed(focusedVerification) ? "completed" : "failed",
          note: "batch focused verification finished after integration",
          details: {
            passed: focusedVerification.filter((result) => result.exitCode === 0).length,
            failed: focusedVerification.filter((result) => result.exitCode !== 0).length,
          },
        });
      }

      if (!commandResultsPassed(focusedVerification)) {
        decisions.set(item.taskId, "rejected");
        const evidence: BatchIntegrationEvidence = {
          order: item.order,
          taskId: item.taskId,
          status: "failed",
          candidateCommit,
          expectedIntegrationHead,
          merge,
          focusedVerification,
          violations: ["focused verification failed after integration"],
        };
        integrationByTaskId.set(item.taskId, evidence);
        integration.push(evidence);
        progressed = true;
        continue;
      }

      decisions.set(item.taskId, "accepted");
      expectedIntegrationHead = await gitHead(repoRoot);
      const merged = worker
        ? await markRunLifecycle({ runLogPath: worker.runLog.path, repoRoot, stateDir })
        : undefined;
      const evidence: BatchIntegrationEvidence = {
        order: item.order,
        taskId: item.taskId,
        status: "accepted",
        candidateCommit,
        expectedIntegrationHead,
        merge,
        focusedVerification,
        lifecycle: merged ? { merged } : undefined,
        violations: [],
      };
      integrationByTaskId.set(item.taskId, evidence);
      integration.push(evidence);
      progressed = true;
    }
    return progressed;
  }

  while ([...decisions.values()].some((decision) => decision === "planned")) {
    for (const task of spec.tasks) {
      if (decisions.get(task.taskId) === "planned" && hasFailedDependency(task.taskId, dependencies, decisions)) {
        decisions.set(task.taskId, "blocked");
      }
    }

    const readyGroup = groups.find((group) => {
      const groupDecisions = group.taskIds.map((taskId) => decisions.get(taskId));
      if (!groupDecisions.every((decision) => decision === "planned")) return false;
      return group.taskIds.every((taskId) => allDependenciesAccepted(taskId, dependencies, decisions));
    });

    if (!readyGroup) break;

    const groupViolations = readyGroup.taskIds.flatMap((taskId) =>
      taskBlockedByAuthorityBoundary({ preflight, taskId }),
    );
    if (groupViolations.length > 0) {
      for (const taskId of readyGroup.taskIds) {
        decisions.set(taskId, "blocked");
      }
      violations.push(...groupViolations);
      dispatchEvidence.push({ ...readyGroup, status: "blocked" });
      continue;
    }

    dispatchEvidence.push({ ...readyGroup, status: "dispatched" });
    for (const taskId of readyGroup.taskIds) {
      decisions.set(taskId, "dispatched");
    }

    const groupWorkers = await Promise.all(
      readyGroup.taskIds.map(async (taskId) => {
        const task = spec.tasks.find((item) => item.taskId === taskId);
        if (!task) throw new Error(`missing task in batch: ${taskId}`);
        return runBatchWorker({
          taskPath: join(repoRoot, task.taskSpecPath),
          repoRoot,
          agentPath: input.agentPath,
          worktreesDir: input.worktreesDir,
          runsDir,
          codexBin: input.codexBin,
          baseCommit: spec.baseCommit,
        });
      }),
    );

    for (const worker of groupWorkers) {
      worker.dispatchGroup = readyGroup.dispatchGroup;
      workers.push(worker);
      workersByTaskId.set(worker.taskId, worker);
      decisions.set(worker.taskId, worker.execution.pass && worker.candidateCommit ? "passed" : "failed");
    }

    await integrateReadyCandidates();
    if (staleBase) break;
  }

  await integrateReadyCandidates();

  for (const task of spec.tasks) {
    if (decisions.get(task.taskId) === "planned") {
      decisions.set(task.taskId, "blocked");
      const blockedDependents = dependents.get(task.taskId) ?? [];
      violations.push(
        `no eligible dispatch group remained for ${task.taskId}${
          blockedDependents.length > 0 ? `; dependents: ${blockedDependents.join(", ")}` : ""
        }`,
      );
    }
  }

  const acceptedCount = [...decisions.values()].filter((decision) => decision === "accepted").length;
  const finalVerification =
    acceptedCount > 0 && !staleBase
      ? await runVerificationCommands(spec.verification.afterFinalAcceptedMerge, repoRoot)
      : [];
  if (finalVerification.length > 0 && !commandResultsPassed(finalVerification)) {
    violations.push("final batch verification failed");
  }

  if (finalVerification.length === 0 || commandResultsPassed(finalVerification)) {
    for (const item of integration.filter((entry) => entry.status === "accepted")) {
      const worker = workersByTaskId.get(item.taskId);
      if (!worker) continue;
      const cleanup = await cleanupCompletedWorktree({
        runLogPath: worker.runLog.path,
        repoRoot,
        targetBranch,
      });
      await recordCleanupFinished(worker.runLog.path, cleanup);
      item.cleanup = cleanup;
      if (cleanup.cleaned) {
        const cleaned = await markRunCleaned({ runLogPath: worker.runLog.path, repoRoot, stateDir });
        item.lifecycle = { ...(item.lifecycle ?? {}), cleaned };
        decisions.set(item.taskId, "cleaned");
      } else {
        violations.push(`cleanup failed for ${item.taskId}: ${cleanup.violations.join("; ")}`);
      }
    }
  }

  const status = resultStatus({
    staleBase,
    preflightFailed: false,
    finalVerification,
    decisions,
    violations,
  });
  const pass =
    status === "completed" &&
    [...decisions.values()].every((decision) => decision === "cleaned" || decision === "accepted") &&
    commandResultsPassed(finalVerification);

  return {
    batchId: spec.batchId,
    status,
    pass,
    preflight,
    dispatchGroups: dispatchEvidence,
    workers,
    integration,
    finalVerification,
    ...(staleBaseReplan ? { staleBaseReplan } : {}),
    taskDecisions: Object.fromEntries(decisions),
    violations,
  };
}
