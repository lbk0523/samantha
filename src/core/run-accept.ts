import { dirname, join, resolve } from "node:path";
import { evaluateMergeGate, readWorkerRunLog, type MergeGateResult } from "./merge-gate";
import {
  recordCleanupFinished,
  recordLifecycleMarked,
  recordMergeChecked,
} from "./post-run-trajectory";
import {
  lifecycleBaseFromRunLog,
  RunLifecycleStore,
  type RunLifecycleRecord,
} from "./run-lifecycle-store";
import { cleanupCompletedWorktree, type WorktreeCleanupResult } from "./worktree-cleanup";

export interface RunAcceptInput {
  runLogPath: string;
  repoRoot: string;
  targetBranch?: string;
  stateDir?: string;
}

export interface RunAcceptCommandResult {
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type RunAcceptStatus = "accepted" | "not_mergeable" | "merge_failed";

export interface RunAcceptResult {
  accepted: boolean;
  status: RunAcceptStatus;
  gate: MergeGateResult;
  merge?: RunAcceptCommandResult;
  lifecycle?: {
    merged: RunLifecycleRecord;
    cleaned?: RunLifecycleRecord;
  };
  cleanup?: WorktreeCleanupResult;
}

interface RunAcceptDependencies {
  runCommand?: (command: string[], cwd: string) => Promise<RunAcceptCommandResult>;
}

function lifecyclePath(input: { runLogPath: string; stateDir?: string }): string {
  return join(resolve(input.stateDir ?? dirname(resolve(input.runLogPath))), "run-lifecycle.jsonl");
}

async function runCommand(command: string[], cwd: string): Promise<RunAcceptCommandResult> {
  const child = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { command, exitCode, stdout, stderr };
}

async function markLifecycle(input: {
  runLogPath: string;
  repoRoot: string;
  event: "merged" | "cleaned";
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
    input.event,
    at,
  );
  await recordLifecycleMarked(input.runLogPath, input.event, record);
  return record;
}

export async function acceptRun(
  input: RunAcceptInput,
  deps: RunAcceptDependencies = {},
): Promise<RunAcceptResult> {
  const runLogPath = resolve(input.runLogPath);
  const repoRoot = resolve(input.repoRoot);
  const run = deps.runCommand ?? runCommand;
  const gate = await evaluateMergeGate({
    runLogPath,
    repoRoot,
    targetBranch: input.targetBranch,
  });

  await recordMergeChecked(runLogPath, gate);

  if (!gate.mayMerge || !gate.command) {
    return {
      accepted: false,
      status: "not_mergeable",
      gate,
    };
  }

  const merge = await run(gate.command, repoRoot);
  if (merge.exitCode !== 0) {
    return {
      accepted: false,
      status: "merge_failed",
      gate,
      merge,
    };
  }

  const merged = await markLifecycle({
    runLogPath,
    repoRoot,
    event: "merged",
    stateDir: input.stateDir,
  });
  const cleanup = await cleanupCompletedWorktree({
    runLogPath,
    repoRoot,
    targetBranch: input.targetBranch,
  });
  await recordCleanupFinished(runLogPath, cleanup);
  const cleaned = cleanup.cleaned
    ? await markLifecycle({
        runLogPath,
        repoRoot,
        event: "cleaned",
        stateDir: input.stateDir,
      })
    : undefined;

  return {
    accepted: true,
    status: "accepted",
    gate,
    merge,
    lifecycle: {
      merged,
      ...(cleaned ? { cleaned } : {}),
    },
    cleanup,
  };
}
