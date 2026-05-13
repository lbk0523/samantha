import { dirname, join, resolve } from "node:path";
import { runTaskCommand, type RunTaskCommandInput } from "./commands/run-task";
import { draftLessonFromRunLog } from "./core/lesson-draft";
import { evaluateMergeGate, readWorkerRunLog } from "./core/merge-gate";
import {
  recordCleanupFinished,
  recordLifecycleMarked,
  recordMergeChecked,
} from "./core/post-run-trajectory";
import {
  lifecycleBaseFromRunLog,
  RunLifecycleStore,
  type RunLifecycleEvent,
} from "./core/run-lifecycle-store";
import { acceptRun, type RunAcceptInput } from "./core/run-accept";
import { listRuns } from "./core/run-list";
import { showRun } from "./core/run-show";
import { createTaskFromTemplate } from "./core/task-from-template";
import { cleanupCompletedWorktree } from "./core/worktree-cleanup";
import { diagnoseRun } from "./core/run-diagnose";
import { createTaskFromRun } from "./core/task-from-run";

export interface RunTaskCliArgs extends RunTaskCommandInput {
  command: "run-task";
}

export interface RunsListCliArgs {
  command: "runs:list";
  runsDir?: string;
}

export interface RunsShowCliArgs {
  command: "runs:show";
  runId: string;
  runsDir?: string;
}

export interface MergeCheckCliArgs {
  command: "merge:check";
  runLogPath: string;
  repoRoot: string;
  targetBranch?: string;
}

export interface RunsMarkLifecycleCliArgs {
  command: "runs:mark-lifecycle";
  runLogPath: string;
  repoRoot: string;
  event: RunLifecycleEvent;
  stateDir?: string;
}

export interface WorktreeCleanupCliArgs {
  command: "worktree:cleanup";
  runLogPath: string;
  repoRoot: string;
  targetBranch?: string;
  stateDir?: string;
}

export interface RunsAcceptCliArgs extends RunAcceptInput {
  command: "runs:accept";
}

export interface RunsDiagnoseCliArgs {
  command: "runs:diagnose";
  runLogPath: string;
}

export interface LessonsDraftCliArgs {
  command: "lessons:draft";
  runLogPath: string;
}

export interface TasksFromTemplateCliArgs {
  command: "tasks:from-template";
  templateId: string;
  taskId: string;
  title: string;
}

export interface TasksFromRunCliArgs {
  command: "tasks:from-run";
  runLogPath: string;
  taskId: string;
  title: string;
}

export type SamanthaCliArgs =
  | RunTaskCliArgs
  | RunsListCliArgs
  | RunsShowCliArgs
  | MergeCheckCliArgs
  | RunsMarkLifecycleCliArgs
  | WorktreeCleanupCliArgs
  | RunsAcceptCliArgs
  | RunsDiagnoseCliArgs
  | LessonsDraftCliArgs
  | TasksFromTemplateCliArgs
  | TasksFromRunCliArgs;

function parseFlags(args: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      throw new Error(`flag requires --name=value form: ${arg}`);
    }
    flags.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  return flags;
}

export function parseCliArgs(argv: string[]): SamanthaCliArgs {
  const [command, first, ...rest] = argv;

  if (command === "run-task") {
    if (!first) {
      throw new Error("usage: bun run samantha run-task <task.json> --repo-root=<repo> [--agent=<profile.json>] [--worktrees-dir=<dir>] [--runs-dir=<dir>] [--codex-bin=<path>]");
    }
    const flags = parseFlags(rest);
    const repoRoot = flags.get("repo-root");
    if (!repoRoot) {
      throw new Error("usage: run-task requires --repo-root=<repo>");
    }

    return {
      command: "run-task",
      taskPath: first,
      repoRoot,
      ...(flags.get("agent") ? { agentPath: flags.get("agent") } : {}),
      ...(flags.get("worktrees-dir") ? { worktreesDir: flags.get("worktrees-dir") } : {}),
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
      ...(flags.get("codex-bin") ? { codexBin: flags.get("codex-bin") } : {}),
    };
  }

  if (command === "runs:list") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    return {
      command: "runs:list",
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
    };
  }

  if (command === "runs:show") {
    if (!first) {
      throw new Error("usage: bun run samantha runs:show <run-id> [--runs-dir=<dir>]");
    }
    const flags = parseFlags(rest);
    return {
      command: "runs:show",
      runId: first,
      ...(flags.get("runs-dir") ? { runsDir: flags.get("runs-dir") } : {}),
    };
  }

  if (command === "merge:check") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!runLogPath || !repoRoot) {
      throw new Error("usage: bun run samantha merge:check --run-log=<path> --repo-root=<repo> [--target-branch=<branch>]");
    }
    return {
      command: "merge:check",
      runLogPath,
      repoRoot,
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
    };
  }

  if (command === "runs:mark-lifecycle") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    const event = flags.get("event");
    if (!runLogPath || !repoRoot || !isRunLifecycleEvent(event)) {
      throw new Error("usage: bun run samantha runs:mark-lifecycle --run-log=<path> --repo-root=<repo> --event=merged|cleaned [--state-dir=<dir>]");
    }
    return {
      command: "runs:mark-lifecycle",
      runLogPath,
      repoRoot,
      event,
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
    };
  }

  if (command === "worktree:cleanup") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!runLogPath || !repoRoot) {
      throw new Error("usage: bun run samantha worktree:cleanup --run-log=<path> --repo-root=<repo> [--target-branch=<branch>] [--state-dir=<dir>]");
    }
    return {
      command: "worktree:cleanup",
      runLogPath,
      repoRoot,
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
    };
  }

  if (command === "runs:accept") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const repoRoot = flags.get("repo-root");
    if (!runLogPath || !repoRoot) {
      throw new Error("usage: bun run samantha runs:accept --run-log=<path> --repo-root=<repo> [--target-branch=<branch>] [--state-dir=<dir>]");
    }
    return {
      command: "runs:accept",
      runLogPath,
      repoRoot,
      ...(flags.get("target-branch") ? { targetBranch: flags.get("target-branch") } : {}),
      ...(flags.get("state-dir") ? { stateDir: flags.get("state-dir") } : {}),
    };
  }

  if (command === "runs:diagnose") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    if (!runLogPath) {
      throw new Error("usage: bun run samantha runs:diagnose --run-log=<path>");
    }
    return {
      command: "runs:diagnose",
      runLogPath,
    };
  }

  if (command === "lessons:draft") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    if (!runLogPath) {
      throw new Error("usage: bun run samantha lessons:draft --run-log=<path>");
    }
    return {
      command: "lessons:draft",
      runLogPath,
    };
  }

  if (command === "tasks:from-template") {
    if (!first) {
      throw new Error("usage: bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title>");
    }
    const flags = parseFlags(rest);
    const taskId = flags.get("task-id");
    const title = flags.get("title");
    if (!taskId || !title) {
      throw new Error("usage: bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title>");
    }
    return {
      command: "tasks:from-template",
      templateId: first,
      taskId,
      title,
    };
  }

  if (command === "tasks:from-run") {
    const flags = parseFlags([first, ...rest].filter((arg): arg is string => Boolean(arg)));
    const runLogPath = flags.get("run-log");
    const taskId = flags.get("task-id");
    const title = flags.get("title");
    if (!runLogPath || !taskId || !title) {
      throw new Error("usage: bun run samantha tasks:from-run --run-log=<path> --task-id=<id> --title=<title>");
    }
    return {
      command: "tasks:from-run",
      runLogPath,
      taskId,
      title,
    };
  }

  throw new Error("usage: bun run samantha run-task|runs:list|runs:show|merge:check|runs:mark-lifecycle|worktree:cleanup|runs:accept|runs:diagnose|lessons:draft|tasks:from-template|tasks:from-run");
}

function lifecyclePath(input: { runLogPath: string; stateDir?: string }): string {
  return join(resolve(input.stateDir ?? dirname(resolve(input.runLogPath))), "run-lifecycle.jsonl");
}

function isRunLifecycleEvent(value: unknown): value is RunLifecycleEvent {
  return value === "merged" || value === "cleaned";
}

async function markLifecycle(input: {
  runLogPath: string;
  repoRoot: string;
  event: RunLifecycleEvent;
  stateDir?: string;
}) {
  const runLogPath = resolve(input.runLogPath);
  const repoRoot = resolve(input.repoRoot);
  const log = await readWorkerRunLog(runLogPath);
  const at = new Date().toISOString();
  const record = await new RunLifecycleStore(lifecyclePath({ runLogPath, stateDir: input.stateDir })).mark(
    lifecycleBaseFromRunLog({ log, runLogPath, repoRoot, updatedAt: at }),
    input.event,
    at,
  );
  await recordLifecycleMarked(runLogPath, input.event, record);
  return record;
}

async function main(argv: string[]): Promise<number> {
  const args = parseCliArgs(argv);
  if (args.command === "run-task") {
    const result = await runTaskCommand(args);
    console.log(
      JSON.stringify(
        {
          pass: result.execution.pass,
          runLog: result.runLog.path,
          runSummary: result.runSummary,
          commit: result.execution.commit?.commitHash ?? "",
        },
        null,
        2,
      ),
    );
    return result.execution.pass ? 0 : 1;
  }

  if (args.command === "runs:list") {
    console.log(JSON.stringify(await listRuns(args), null, 2));
    return 0;
  }

  if (args.command === "runs:show") {
    console.log(JSON.stringify(await showRun(args), null, 2));
    return 0;
  }

  if (args.command === "merge:check") {
    const runLogPath = resolve(args.runLogPath);
    const result = await evaluateMergeGate({
      runLogPath,
      repoRoot: resolve(args.repoRoot),
      targetBranch: args.targetBranch,
    });
    await recordMergeChecked(runLogPath, result);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  if (args.command === "runs:mark-lifecycle") {
    console.log(JSON.stringify(await markLifecycle(args), null, 2));
    return 0;
  }

  if (args.command === "lessons:draft") {
    console.log(
      JSON.stringify(
        await draftLessonFromRunLog({
          runLogPath: resolve(args.runLogPath),
        }),
        null,
        2,
      ),
    );
    return 0;
  }

  if (args.command === "runs:diagnose") {
    console.log(JSON.stringify(await diagnoseRun({ runLogPath: resolve(args.runLogPath) }), null, 2));
    return 0;
  }

  if (args.command === "tasks:from-template") {
    console.log(JSON.stringify(await createTaskFromTemplate(args), null, 2));
    return 0;
  }

  if (args.command === "tasks:from-run") {
    const result = await createTaskFromRun({
      runLogPath: resolve(args.runLogPath),
      taskId: args.taskId,
      title: args.title,
    });
    console.log(JSON.stringify(result, null, 2));
    return result.created ? 0 : 1;
  }

  if (args.command === "worktree:cleanup") {
    const runLogPath = resolve(args.runLogPath);
    const cleanup = await cleanupCompletedWorktree({
      runLogPath,
      repoRoot: resolve(args.repoRoot),
      targetBranch: args.targetBranch,
    });
    await recordCleanupFinished(runLogPath, cleanup);
    const lifecycle = cleanup.cleaned
      ? await markLifecycle({ ...args, event: "cleaned" })
      : undefined;
    console.log(JSON.stringify({ cleanup, lifecycle }, null, 2));
    return 0;
  }

  if (args.command === "runs:accept") {
    const result = await acceptRun(args);
    console.log(JSON.stringify(result, null, 2));
    return result.accepted ? 0 : 1;
  }

  const exhaustive: never = args;
  throw new Error(`unhandled command: ${JSON.stringify(exhaustive)}`);
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
